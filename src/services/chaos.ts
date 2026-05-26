import pool from '../config/neon';
import { writeAudit } from './auditLog';

export type ChaosScenario = 'RANSOMWARE' | 'DATA_INTEGRITY_LOSS';

export interface ChaosResult {
  scenario: ChaosScenario;
  affected_node: string;
  log_id: string;
  incident_id: string;
}

const RANSOMWARE_MESSAGES = [
  'CRITICAL: Mass file encryption detected. 14,892 files encrypted in /var/data within 4 seconds.',
  'CRITICAL: Ransomware payload "CryptoLock.x86" executing. Shadow copies destroyed.',
  'CRITICAL: Unknown process encrypting database backups. Ransom note dropped: README_DECRYPT.txt',
  'CRITICAL: Crypto-ransomware behavior detected: rapid file rewrites with .locked extension.',
];

const INTEGRITY_MESSAGES = [
  'CRITICAL: Data integrity check FAILED. Checksum mismatch on 3,447 rows across 11 tables.',
  'CRITICAL: Database corruption detected: WAL log fork inconsistency, primary key violations cascading.',
  'CRITICAL: Storage subsystem returned conflicting reads for tablespace user_data. Silent corruption suspected.',
  'CRITICAL: Replication divergence detected. Primary and replicas disagree on 8,201 records.',
];

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const pickNode = async (preferredName?: string): Promise<{ id: string; name: string; ip: string }> => {
  if (preferredName) {
    const { rows } = await pool.query(
      'SELECT id, node_name, ip_address FROM simulated_nodes WHERE node_name = $1 LIMIT 1',
      [preferredName]
    );
    if (rows.length > 0) {
      return { id: rows[0].id, name: rows[0].node_name, ip: rows[0].ip_address };
    }
  }
  const { rows } = await pool.query(
    'SELECT id, node_name, ip_address FROM simulated_nodes ORDER BY RANDOM() LIMIT 1'
  );
  if (rows.length === 0) {
    throw new Error('No simulated nodes available to attack');
  }
  return { id: rows[0].id, name: rows[0].node_name, ip: rows[0].ip_address };
};

export const triggerChaos = async (
  scenario: ChaosScenario,
  options: { targetNode?: string; actor?: string; ipAddress?: string } = {}
): Promise<ChaosResult> => {
  const node = await pickNode(options.targetNode);
  const message =
    scenario === 'RANSOMWARE'
      ? pickRandom(RANSOMWARE_MESSAGES)
      : pickRandom(INTEGRITY_MESSAGES);

  const payload = {
    chaos_origin: true,
    scenario,
    target_node: node.name,
    triggered_at: new Date().toISOString(),
  };

  const newStatus = scenario === 'RANSOMWARE' ? 'UNDER_ATTACK' : 'CRITICAL';

  await pool.query(
    `UPDATE simulated_nodes
       SET status = $1,
           cpu_usage = LEAST(100, cpu_usage + 60),
           ram_usage = LEAST(100, ram_usage + 60),
           updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [newStatus, node.id]
  );

  const logResult = await pool.query(
    `INSERT INTO system_logs (node_id, severity, message, payload)
     VALUES ($1, 'CRITICAL', $2, $3)
     RETURNING id`,
    [node.id, message, JSON.stringify(payload)]
  );
  const logId = logResult.rows[0].id;

  const incidentResult = await pool.query(
    `INSERT INTO incident_responses (log_id, status)
     VALUES ($1, 'PENDING')
     RETURNING id`,
    [logId]
  );
  const incidentId = incidentResult.rows[0].id;

  await writeAudit({
    actor: options.actor ?? 'user:unknown',
    actionType: 'CHAOS_TRIGGER',
    resourceType: 'node',
    resourceId: node.id,
    details: {
      scenario,
      target_node: node.name,
      log_id: logId,
      incident_id: incidentId,
      message,
    },
    ipAddress: options.ipAddress,
  });

  console.warn(`[chaos]: ${scenario} injected on ${node.name} by ${options.actor ?? 'unknown'}`);

  return {
    scenario,
    affected_node: node.name,
    log_id: logId,
    incident_id: incidentId,
  };
};
