import pool from '../config/neon';
import genAI, { GEMINI_MODEL } from '../config/gemini';
import {
  SIEM_SYSTEM_INSTRUCTION,
  SIEM_RESPONSE_SCHEMA,
  buildSiemPrompt,
  SiemIncidentInput,
  SiemContextLog,
} from './siemPrompts';
import { SiemCorrelationResult, IncidentVerdict } from './types';
import { writeAudit } from '../services/auditLog';
import { isSimulationActive } from '../services/systemControl';
import { recordGeminiCall } from '../services/usageTracker';
import { beginTrace, endTrace } from '../services/aiActivity';

const SIEM_INTERVAL_MS = 15000;
const BATCH_LIMIT = 10;

interface PendingRow {
  incident_id: string;
  node_id: string;
  node_name: string;
  ip_address: string;
  cpu_usage: number;
  ram_usage: number;
  status: string;
  severity: string;
  message: string;
  payload: Record<string, unknown> | null;
  log_created_at: Date;
}

interface ContextRow {
  node_name: string;
  severity: string;
  message: string;
  seconds_ago: number;
}

const CLAIM_PENDING = `
  WITH claimed AS (
    UPDATE incident_responses
       SET status = 'IN_PROGRESS'
     WHERE id IN (
       SELECT ir.id
         FROM incident_responses ir
         JOIN system_logs sl ON sl.id = ir.log_id
        WHERE ir.status = 'PENDING'
          AND sl.severity = 'CRITICAL'
        ORDER BY sl.created_at ASC
        LIMIT $1
     )
     RETURNING id, log_id
  )
  SELECT
    claimed.id     AS incident_id,
    sn.id          AS node_id,
    sn.node_name   AS node_name,
    sn.ip_address  AS ip_address,
    sn.cpu_usage   AS cpu_usage,
    sn.ram_usage   AS ram_usage,
    sn.status      AS status,
    sl.severity    AS severity,
    sl.message     AS message,
    sl.payload     AS payload,
    sl.created_at  AS log_created_at
  FROM claimed
  JOIN system_logs sl     ON sl.id = claimed.log_id
  JOIN simulated_nodes sn ON sn.id = sl.node_id
  ORDER BY sl.created_at ASC;
`;

const CONTEXT_QUERY = `
  SELECT
    sn.node_name,
    sl.severity,
    sl.message,
    EXTRACT(EPOCH FROM (NOW() - sl.created_at))::int AS seconds_ago
  FROM system_logs sl
  LEFT JOIN simulated_nodes sn ON sn.id = sl.node_id
  WHERE sl.created_at > NOW() - INTERVAL '3 minutes'
    AND sl.severity <> 'CRITICAL'
  ORDER BY sl.created_at DESC
  LIMIT 30;
`;

const rollbackIncident = async (incidentId: string): Promise<void> => {
  await pool.query(
    `UPDATE incident_responses
       SET status = 'PENDING'
     WHERE id = $1 AND status = 'IN_PROGRESS'`,
    [incidentId]
  );
};

const persistVerdict = async (verdict: IncidentVerdict): Promise<void> => {
  await pool.query(
    `UPDATE incident_responses
       SET ai_analysis = $1
     WHERE id = $2`,
    [JSON.stringify(verdict), verdict.incident_id]
  );
};

const persistCampaign = async (
  result: SiemCorrelationResult,
  incidentCount: number
): Promise<string | null> => {
  if (!result.campaign_detected) return null;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO siem_alerts
       (campaign_type, severity, summary, affected_nodes,
        recommended_action, action_parameter, incident_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      result.campaign_type,
      result.campaign_severity,
      result.campaign_summary,
      JSON.stringify(result.affected_nodes ?? []),
      result.recommended_campaign_action,
      result.campaign_action_parameter,
      incidentCount,
    ]
  );
  await writeAudit({
    actor: 'system:siem',
    actionType: 'CAMPAIGN_DETECTED',
    resourceType: 'siem_alert',
    resourceId: rows[0].id,
    details: {
      campaign_type: result.campaign_type,
      severity: result.campaign_severity,
      affected_nodes: result.affected_nodes,
      recommended_action: result.recommended_campaign_action,
    },
  });
  console.warn(
    `[siem]: CAMPAIGN ${result.campaign_severity} — ${result.campaign_type} ` +
      `(${result.affected_nodes.length} nodes) -> ${result.recommended_campaign_action}`
  );
  return rows[0].id;
};

const overrideAffectedVerdicts = (
  result: SiemCorrelationResult,
  incidents: PendingRow[]
): SiemCorrelationResult => {
  if (!result.campaign_detected) return result;

  const verdictsById = new Map(result.incident_verdicts.map((v) => [v.incident_id, v]));

  /* Campaign-level SEGMENT_ISOLATION: override ALL affected node incidents */
  if (
    result.recommended_campaign_action === 'SEGMENT_ISOLATION' &&
    Array.isArray(result.affected_nodes) &&
    result.affected_nodes.length > 0
  ) {
    const affectedSet = new Set(result.affected_nodes);
    for (const inc of incidents) {
      if (affectedSet.has(inc.node_name)) {
        const existing = verdictsById.get(inc.incident_id);
        if (existing) {
          existing.recommended_action = 'SEGMENT_ISOLATION';
          existing.action_parameter = existing.action_parameter || inc.node_name;
        }
      }
    }
  }

  /* Campaign-level ENGAGE_DEEP_VAULT: force the most DB-relevant incident to vault */
  if (result.recommended_campaign_action === 'ENGAGE_DEEP_VAULT') {
    const dbIncident =
      incidents.find((i) => /database|db-core|^db\b/i.test(i.node_name)) ||
      incidents[0];
    if (dbIncident) {
      const existing = verdictsById.get(dbIncident.incident_id);
      if (existing) {
        existing.recommended_action = 'ENGAGE_DEEP_VAULT';
        existing.action_parameter =
          result.campaign_action_parameter || existing.action_parameter || dbIncident.node_name;
      }
    }
  }

  return { ...result, incident_verdicts: Array.from(verdictsById.values()) };
};

const runCorrelationCycle = async (): Promise<void> => {
  if (!isSimulationActive()) return;
  const { rows: incidents } = await pool.query<PendingRow>(CLAIM_PENDING, [BATCH_LIMIT]);
  if (incidents.length === 0) return;

  console.log(`[siem]: Correlating ${incidents.length} pending incident(s)...`);

  const { rows: contextRows } = await pool.query<ContextRow>(CONTEXT_QUERY);

  const incidentInputs: SiemIncidentInput[] = incidents.map((i) => ({
    incident_id: i.incident_id,
    node_name: i.node_name,
    ip_address: i.ip_address,
    cpu_usage: i.cpu_usage,
    ram_usage: i.ram_usage,
    status: i.status,
    severity: i.severity,
    message: i.message,
    payload: i.payload,
    log_created_at: new Date(i.log_created_at).toISOString(),
  }));

  const contextLogs: SiemContextLog[] = contextRows.map((c) => ({
    node_name: c.node_name ?? '—',
    severity: c.severity,
    message: c.message,
    seconds_ago: c.seconds_ago,
  }));

  let result: SiemCorrelationResult;
  const startTime = Date.now();
  const promptText = buildSiemPrompt(incidentInputs, contextLogs);
  const traceId = await beginTrace({
    source: 'siem_correlator',
    model: GEMINI_MODEL,
    systemInstruction: SIEM_SYSTEM_INSTRUCTION,
    prompt: promptText,
  });

  try {
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: promptText,
      config: {
        systemInstruction: SIEM_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: SIEM_RESPONSE_SCHEMA,
        temperature: 0.15,
      },
    });
    if (!response.text) throw new Error('Empty response');
    result = JSON.parse(response.text) as SiemCorrelationResult;
    const elapsed = Date.now() - startTime;

    await recordGeminiCall({
      source: 'siem_correlator',
      model: GEMINI_MODEL,
      success: true,
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
      durationMs: elapsed,
    });
    await endTrace({
      traceId,
      success: true,
      response: response.text,
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
      durationMs: elapsed,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const elapsed = Date.now() - startTime;
    const errorKind = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')
      ? 'rate_limit'
      : msg.includes('503') || msg.includes('UNAVAILABLE')
        ? 'unavailable'
        : 'other';
    console.warn(`[siem]: correlation failed — ${msg}`);
    await recordGeminiCall({
      source: 'siem_correlator',
      model: GEMINI_MODEL,
      success: false,
      durationMs: elapsed,
      errorKind,
    });
    await endTrace({
      traceId,
      success: false,
      durationMs: elapsed,
      errorMessage: msg,
    });
    await Promise.all(incidents.map((i) => rollbackIncident(i.incident_id)));
    return;
  }

  const corrected = overrideAffectedVerdicts(result, incidents);
  const verdictsById = new Map(corrected.incident_verdicts.map((v) => [v.incident_id, v]));

  for (const inc of incidents) {
    const verdict = verdictsById.get(inc.incident_id);
    if (!verdict) {
      console.warn(`[siem]: no verdict for incident ${inc.incident_id}, rolling back`);
      await rollbackIncident(inc.incident_id);
      continue;
    }
    await persistVerdict(verdict);
  }

  await persistCampaign(corrected, incidents.length);

  const summary = corrected.campaign_detected
    ? ` campaign=${corrected.campaign_type}(${corrected.campaign_severity})`
    : '';
  console.log(`[siem]: ${incidents.length} verdict(s) issued${summary}`);
};

export const startAnalyzer = async (): Promise<void> => {
  console.log('[siem]: SIEM correlator starting (15s interval, batched mode)...');
  setInterval(() => {
    runCorrelationCycle().catch((error) =>
      console.error('[siem]: cycle failed', error)
    );
  }, SIEM_INTERVAL_MS);
};
