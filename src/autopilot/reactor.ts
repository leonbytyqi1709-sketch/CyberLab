import pool from '../config/neon';
import { ACTION_HANDLERS, ActionContext } from './actions';
import { GeminiAnalysisResult, RecommendedAction } from '../ai-engine/types';
import { writeAudit } from '../services/auditLog';

const REACTOR_INTERVAL_MS = 20000;

interface ReadyIncident {
  incident_id: string;
  ai_analysis: string;
  node_id: string;
  node_name: string;
  ip_address: string;
}

const READY_QUERY = `
  SELECT
    ir.id          AS incident_id,
    ir.ai_analysis AS ai_analysis,
    sn.id          AS node_id,
    sn.node_name   AS node_name,
    sn.ip_address  AS ip_address
  FROM incident_responses ir
  JOIN system_logs sl       ON sl.id = ir.log_id
  JOIN simulated_nodes sn   ON sn.id = sl.node_id
  WHERE ir.status = 'IN_PROGRESS'
    AND ir.ai_analysis IS NOT NULL
    AND ir.action_taken IS NULL
  ORDER BY sl.created_at ASC
  LIMIT 5;
`;

const finalize = async (
  incidentId: string,
  status: 'RESOLVED' | 'FAILED',
  actionTaken: string
): Promise<void> => {
  await pool.query(
    `UPDATE incident_responses
       SET status = $1,
           action_taken = $2,
           resolved_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [status, actionTaken, incidentId]
  );
};

const reactToIncident = async (incident: ReadyIncident): Promise<void> => {
  let analysis: GeminiAnalysisResult;
  try {
    analysis = JSON.parse(incident.ai_analysis) as GeminiAnalysisResult;
  } catch {
    await finalize(
      incident.incident_id,
      'FAILED',
      'Could not parse stored AI analysis as JSON'
    );
    return;
  }

  const action = analysis.recommended_action as RecommendedAction;
  const handler = ACTION_HANDLERS[action];

  if (!handler) {
    await finalize(
      incident.incident_id,
      'FAILED',
      `Unknown recommended_action: ${action}`
    );
    return;
  }

  const ctx: ActionContext = {
    nodeId: incident.node_id,
    nodeName: incident.node_name,
    ipAddress: incident.ip_address,
    parameter: analysis.action_parameter ?? '',
  };

  try {
    const result = await handler(ctx);
    await finalize(
      incident.incident_id,
      result.success ? 'RESOLVED' : 'FAILED',
      `[${action}] ${result.summary}`
    );
    await writeAudit({
      actor: 'system:autopilot',
      actionType: action,
      resourceType: 'node',
      resourceId: incident.node_id,
      outcome: result.success ? 'SUCCESS' : 'FAILURE',
      details: {
        incident_id: incident.incident_id,
        node_name: incident.node_name,
        action_parameter: analysis.action_parameter,
        attack_type: analysis.attack_type,
        confidence_score: analysis.confidence_score,
        summary: result.summary,
      },
    });
    console.log(
      `[autopilot]: ${incident.node_name} -> ${action} -> ` +
        `${result.success ? 'RESOLVED' : 'FAILED'}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[autopilot]: Handler threw for incident ${incident.incident_id}`,
      error
    );
    await finalize(
      incident.incident_id,
      'FAILED',
      `[${action}] Handler error: ${message}`
    );
    await writeAudit({
      actor: 'system:autopilot',
      actionType: action,
      resourceType: 'node',
      resourceId: incident.node_id,
      outcome: 'FAILURE',
      details: {
        incident_id: incident.incident_id,
        node_name: incident.node_name,
        error: message,
      },
    });
  }
};

const releaseVaultIfClear = async (): Promise<void> => {
  /* Check if there are still any unresolved incidents */
  const { rows } = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c
       FROM incident_responses
      WHERE status IN ('PENDING', 'IN_PROGRESS')`
  );
  const activeCount = Number(rows[0].c);
  if (activeCount > 0) return;

  /* No active threats — release any vault nodes */
  const released = await pool.query(
    `UPDATE simulated_nodes
        SET status = 'HEALTHY',
            cpu_usage = 15,
            ram_usage = 25,
            updated_at = CURRENT_TIMESTAMP
      WHERE status = 'DEEP_VAULT_MODE'
      RETURNING id, node_name`
  );

  if (released.rowCount && released.rowCount > 0) {
    const names = released.rows.map((r) => r.node_name).join(', ');
    console.log(`[vault]: Released ${released.rowCount} node(s) from DEEP_VAULT_MODE: ${names}`);
    for (const r of released.rows) {
      await writeAudit({
        actor: 'system:autopilot',
        actionType: 'VAULT_RELEASED',
        resourceType: 'node',
        resourceId: r.id,
        details: {
          node_name: r.node_name,
          reason: 'no active incidents remaining',
        },
      });
    }
  }
};

const processReadyIncidents = async (): Promise<void> => {
  const { rows } = await pool.query<ReadyIncident>(READY_QUERY);

  if (rows.length > 0) {
    console.log(`[autopilot]: Reacting to ${rows.length} analyzed incident(s)`);
    for (const incident of rows) {
      await reactToIncident(incident);
    }
  }

  /* After processing (or even on idle ticks), check for stale vaults */
  await releaseVaultIfClear();
};

export const startReactor = async (): Promise<void> => {
  console.log('[autopilot]: Reactor starting...');
  setInterval(() => {
    processReadyIncidents().catch((error) =>
      console.error('[autopilot]: Cycle failed', error)
    );
  }, REACTOR_INTERVAL_MS);
};
