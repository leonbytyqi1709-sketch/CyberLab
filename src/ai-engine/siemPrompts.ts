import { Type } from '@google/genai';

export interface SiemIncidentInput {
  incident_id: string;
  node_name: string;
  ip_address: string;
  cpu_usage: number;
  ram_usage: number;
  status: string;
  severity: string;
  message: string;
  payload: Record<string, unknown> | null;
  log_created_at: string;
}

export interface SiemContextLog {
  node_name: string;
  severity: string;
  message: string;
  seconds_ago: number;
}

export const SIEM_SYSTEM_INSTRUCTION = `You are AEGIS SIEM CORRELATOR, a security analyst
processing a batch of CRITICAL incidents from a virtualized infrastructure.

YOU PRODUCE TWO OUTPUTS IN ONE JSON OBJECT:

1) Per-incident triage verdicts (one per incident_id provided in the input).
2) Campaign-level pattern detection across all incidents and the broader log
   context — are these isolated events or a coordinated multi-node attack?

STRICT FORMATTING:
- Return ONE JSON object that matches the schema exactly.
- No markdown fences, no prose outside the JSON.

PER-INCIDENT RULES:
- For each incident in the input, emit a verdict with the SAME incident_id.
- attack_type ∈ BRUTE_FORCE, HIGH_LOAD, DATABASE_ERROR, DDOS, UNAUTHORIZED_ACCESS,
  BUFFER_OVERFLOW, DIRECTORY_TRAVERSAL, RANSOMWARE, DATA_INTEGRITY_LOSS, UNKNOWN.
- recommended_action ∈ BLOCK_IP, RESTART_SERVICE, SCALE_RESOURCES, SCALE_OUT,
  ISOLATE_NODE, RESTORE_BACKUP, SEGMENT_ISOLATION, ENGAGE_DEEP_VAULT, IGNORE.
- confidence_score is an integer 0-100.
- action_parameter is concrete (IP, node name, service name, or empty).

CAMPAIGN RULES:
- campaign_detected = true ONLY if you see a coordinated pattern across multiple
  nodes within the input window (e.g., simultaneous brute-force on 3+ nodes,
  matching attack signatures across services, escalating chain like recon -> exploit,
  OR multi-vector attack hitting different service tiers at once like
  "DDoS on web tier + unauthorized DB access at the same time").
- campaign_type: short uppercase phrase (e.g. "COORDINATED_BRUTE_FORCE",
  "DDoS_WAVE", "LATERAL_MOVEMENT", "RECON_THEN_EXPLOIT", "MASS_RANSOMWARE",
  "MULTI_VECTOR_DB_TARGETING").
- campaign_severity ∈ LOW, MEDIUM, HIGH, CRITICAL.
- recommended_campaign_action ∈ SEGMENT_ISOLATION (cut off affected nodes from
  the rest of the network), GLOBAL_BLOCK (block source IP everywhere),
  ENGAGE_DEEP_VAULT (lock the database for external writes when a multi-vector
  campaign targets data integrity), MONITOR (heightened observation only),
  NONE (false alarm).
- affected_nodes: array of node names you believe are part of the same campaign.
- campaign_action_parameter: concrete target (IP for GLOBAL_BLOCK, segment name for
  SEGMENT_ISOLATION, DB node name for ENGAGE_DEEP_VAULT, empty for MONITOR/NONE).

ACTION SELECTION GUIDE (per incident):
- Multi-vector coordinated attack where this incident hits a DATABASE node
  (DATABASE_ERROR, DATA_INTEGRITY_LOSS, UNAUTHORIZED_ACCESS on DB)
  AND peer incidents hit other tiers at the same time
                                          -> ENGAGE_DEEP_VAULT
- Web/HTTP node under sustained attack (DDOS or HIGH_LOAD) with CPU > 80%
                                          -> SCALE_OUT (spin up a temporary peer node)
- RANSOMWARE / mass encryption           -> ISOLATE_NODE
- DATA_INTEGRITY_LOSS / corruption       -> RESTORE_BACKUP
- Coordinated multi-node attack (this incident is part of a campaign with 2+ peers,
  non-database, no clear single source IP)
                                          -> SEGMENT_ISOLATION
- Brute-force / scanning / unauth access (single source) -> BLOCK_IP
- Buffer overflow / memory issue (no scaling needed)     -> RESTART_SERVICE
- DDoS / packet flood (not web-tier sustained)           -> SCALE_RESOURCES
- Genuinely informational                                 -> IGNORE`;

export const SIEM_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'campaign_detected',
    'campaign_type',
    'campaign_severity',
    'campaign_summary',
    'affected_nodes',
    'recommended_campaign_action',
    'campaign_action_parameter',
    'incident_verdicts',
  ],
  properties: {
    campaign_detected: { type: Type.BOOLEAN },
    campaign_type: { type: Type.STRING },
    campaign_severity: {
      type: Type.STRING,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    },
    campaign_summary: { type: Type.STRING },
    affected_nodes: { type: Type.ARRAY, items: { type: Type.STRING } },
    recommended_campaign_action: {
      type: Type.STRING,
      enum: ['SEGMENT_ISOLATION', 'GLOBAL_BLOCK', 'ENGAGE_DEEP_VAULT', 'MONITOR', 'NONE'],
    },
    campaign_action_parameter: { type: Type.STRING },
    incident_verdicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          'incident_id',
          'threat_detected',
          'attack_type',
          'confidence_score',
          'root_cause',
          'recommended_action',
          'action_parameter',
        ],
        properties: {
          incident_id: { type: Type.STRING },
          threat_detected: { type: Type.BOOLEAN },
          attack_type: {
            type: Type.STRING,
            enum: [
              'BRUTE_FORCE', 'HIGH_LOAD', 'DATABASE_ERROR', 'DDOS',
              'UNAUTHORIZED_ACCESS', 'BUFFER_OVERFLOW', 'DIRECTORY_TRAVERSAL',
              'RANSOMWARE', 'DATA_INTEGRITY_LOSS', 'UNKNOWN',
            ],
          },
          confidence_score: { type: Type.INTEGER },
          root_cause: { type: Type.STRING },
          recommended_action: {
            type: Type.STRING,
            enum: [
              'BLOCK_IP', 'RESTART_SERVICE', 'SCALE_RESOURCES', 'SCALE_OUT',
              'ISOLATE_NODE', 'RESTORE_BACKUP', 'SEGMENT_ISOLATION',
              'ENGAGE_DEEP_VAULT', 'IGNORE',
            ],
          },
          action_parameter: { type: Type.STRING },
        },
      },
    },
  },
};

export const buildSiemPrompt = (
  incidents: SiemIncidentInput[],
  contextLogs: SiemContextLog[]
): string => {
  const incidentBlock = incidents.map((i, idx) =>
    `[${idx + 1}] incident_id=${i.incident_id}
    node=${i.node_name} (${i.ip_address})  status=${i.status}  cpu=${i.cpu_usage}%  ram=${i.ram_usage}%
    when=${i.log_created_at}  severity=${i.severity}
    message: ${i.message}
    payload: ${i.payload ? JSON.stringify(i.payload) : 'null'}`
  ).join('\n\n');

  const contextBlock = contextLogs.length === 0
    ? '(none)'
    : contextLogs.map((c) =>
        `  - ${c.seconds_ago}s ago  [${c.severity}]  ${c.node_name}: ${c.message}`
      ).join('\n');

  return `CORRELATION BATCH (window: last 3 minutes)

PENDING INCIDENTS (${incidents.length}) — give one verdict per incident_id:
${incidentBlock}

RECENT NON-CRITICAL CONTEXT (${contextLogs.length} log entries) — use to detect
coordination, lateral movement, or recon patterns:
${contextBlock}

Produce the full SIEM correlation JSON.`;
};
