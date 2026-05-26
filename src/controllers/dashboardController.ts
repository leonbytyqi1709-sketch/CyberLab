import { Request, Response } from 'express';
import pool from '../config/neon';
import { getCurrentSituation } from '../services/situationReporter';

export const getNodes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT
         sn.id,
         sn.node_name,
         sn.ip_address,
         sn.status,
         sn.cpu_usage,
         sn.ram_usage,
         sn.updated_at,
         COALESCE(sn.is_temporary, false) AS is_temporary,
         sn.parent_node_id,
         (
           SELECT json_build_object(
             'incident_id', ir.id,
             'attack_type', COALESCE((ir.ai_analysis::jsonb)->>'attack_type', 'ANALYZING'),
             'recommended_action', (ir.ai_analysis::jsonb)->>'recommended_action'
           )
           FROM incident_responses ir
           JOIN system_logs sl ON sl.id = ir.log_id
           WHERE sl.node_id = sn.id
             AND ir.status IN ('PENDING','IN_PROGRESS')
           ORDER BY sl.created_at DESC
           LIMIT 1
         ) AS active_action
       FROM simulated_nodes sn
       ORDER BY sn.node_name ASC`
    );
    res.json({ nodes: rows });
  } catch (error) {
    console.error('[dashboard]: getNodes failed', error);
    res.status(500).json({ error: 'Failed to load nodes' });
  }
};

export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '60'), 10) || 60, 200);
    const { rows } = await pool.query(
      `SELECT sl.id,
              sl.severity,
              sl.message,
              sl.payload,
              sl.created_at,
              sn.node_name,
              sn.ip_address
         FROM system_logs sl
         LEFT JOIN simulated_nodes sn ON sn.id = sl.node_id
        ORDER BY sl.created_at DESC
        LIMIT $1`,
      [limit]
    );
    res.json({ logs: rows });
  } catch (error) {
    console.error('[dashboard]: getLogs failed', error);
    res.status(500).json({ error: 'Failed to load logs' });
  }
};

export const getIncidents = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '40'), 10) || 40, 100);
    const { rows } = await pool.query(
      `SELECT ir.id,
              ir.status,
              ir.ai_analysis,
              ir.action_taken,
              ir.resolved_at,
              sl.id          AS log_id,
              sl.message     AS log_message,
              sl.severity    AS log_severity,
              sl.created_at  AS log_created_at,
              sn.node_name,
              sn.ip_address
         FROM incident_responses ir
         JOIN system_logs sl     ON sl.id = ir.log_id
         JOIN simulated_nodes sn ON sn.id = sl.node_id
        ORDER BY
          CASE ir.status
            WHEN 'PENDING'     THEN 1
            WHEN 'IN_PROGRESS' THEN 2
            WHEN 'FAILED'      THEN 3
            WHEN 'RESOLVED'    THEN 4
            ELSE 5
          END,
          sl.created_at DESC
        LIMIT $1`,
      [limit]
    );
    res.json({ incidents: rows });
  } catch (error) {
    console.error('[dashboard]: getIncidents failed', error);
    res.status(500).json({ error: 'Failed to load incidents' });
  }
};

export const getStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [nodeStats, incidentStats, recentResolved] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'HEALTHY')                          AS healthy,
           COUNT(*) FILTER (WHERE status = 'WARNING')                          AS warning,
           COUNT(*) FILTER (WHERE status IN ('CRITICAL','UNDER_ATTACK','DOWN','QUARANTINED')) AS critical,
           COUNT(*)                                                            AS total,
           COALESCE(ROUND(AVG(cpu_usage)::numeric, 0), 0)                      AS avg_cpu,
           COALESCE(ROUND(AVG(ram_usage)::numeric, 0), 0)                      AS avg_ram
         FROM simulated_nodes`
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'PENDING')     AS pending,
           COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
           COUNT(*) FILTER (WHERE status = 'RESOLVED')    AS resolved,
           COUNT(*) FILTER (WHERE status = 'FAILED')      AS failed,
           COUNT(*)                                       AS total
         FROM incident_responses`
      ),
      pool.query(
        `SELECT COUNT(*) AS count
           FROM incident_responses
          WHERE status = 'RESOLVED'
            AND resolved_at > NOW() - INTERVAL '5 minutes'`
      ),
    ]);

    res.json({
      nodes: nodeStats.rows[0],
      incidents: incidentStats.rows[0],
      recent_resolved_5min: Number(recentResolved.rows[0].count),
      server_time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[dashboard]: getStats failed', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
};

export const getSituation = async (_req: Request, res: Response): Promise<void> => {
  const situation = getCurrentSituation();
  if (!situation) {
    res.json({
      situation: {
        threat_level: 'GREEN',
        headline: 'AEGIS booting — first briefing in progress',
        summary: 'The autonomous defense core is online. The first executive briefing is being generated.',
        recommendations: ['Wait ~30 seconds for the first AI briefing.'],
        generated_at: new Date().toISOString(),
      },
    });
    return;
  }
  res.json({ situation });
};

export const getSiemAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
    const { rows } = await pool.query(
      `SELECT id, campaign_type, severity, summary, affected_nodes,
              recommended_action, action_parameter, incident_count, resolved, detected_at
         FROM siem_alerts
        ORDER BY detected_at DESC
        LIMIT $1`,
      [limit]
    );
    res.json({ alerts: rows });
  } catch (error) {
    console.error('[dashboard]: getSiemAlerts failed', error);
    res.status(500).json({ error: 'Failed to load SIEM alerts' });
  }
};

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const { rows } = await pool.query(
      `SELECT id, actor, action_type, resource_type, resource_id,
              outcome, details, ip_address, created_at
         FROM audit_logs
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit]
    );
    res.json({ audit: rows });
  } catch (error) {
    console.error('[dashboard]: getAuditLogs failed', error);
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
};
