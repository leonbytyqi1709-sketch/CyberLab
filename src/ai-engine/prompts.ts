import { Type } from '@google/genai';
import { PendingIncident } from './types';

export const SYSTEM_INSTRUCTION = `You are AEGIS, an autonomous cyber-defense analyst.
Your job is to analyze a single CRITICAL system log from a virtualized infrastructure
and decide what should happen next.

STRICT RULES:
- Respond ONLY with a single JSON object that matches the provided schema.
- Do NOT wrap the JSON in markdown fences or add any prose, headers, or comments.
- "confidence_score" is an integer between 0 and 100.
- Pick "attack_type" from: BRUTE_FORCE, HIGH_LOAD, DATABASE_ERROR, DDOS,
  UNAUTHORIZED_ACCESS, BUFFER_OVERFLOW, DIRECTORY_TRAVERSAL,
  RANSOMWARE, DATA_INTEGRITY_LOSS, UNKNOWN.
- Pick "recommended_action" from: BLOCK_IP, RESTART_SERVICE, SCALE_RESOURCES,
  SCALE_OUT, ISOLATE_NODE, RESTORE_BACKUP, SEGMENT_ISOLATION,
  ENGAGE_DEEP_VAULT, IGNORE.
- "action_parameter" must be the concrete target of the action (e.g. an IP address
  for BLOCK_IP, a service/node name for RESTART_SERVICE/ISOLATE_NODE,
  a backup tag or table name for RESTORE_BACKUP, or an empty string for IGNORE).
- "root_cause" is one short sentence in English.

ACTION SELECTION GUIDE:
- RANSOMWARE or unauthorized encryption activity -> ISOLATE_NODE (parameter: node name).
- DATA_INTEGRITY_LOSS, corrupted tables, checksum mismatches -> RESTORE_BACKUP
  (parameter: backup tag or affected table/service).
- Brute-force, scanning, unauthorized terminal -> BLOCK_IP (parameter: IP).
- High load, buffer overflow, memory issues -> RESTART_SERVICE (parameter: node/service).
- DDoS, packet floods, traffic spikes -> SCALE_RESOURCES (parameter: node/service).
- Genuinely informational -> IGNORE.`;

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'threat_detected',
    'attack_type',
    'confidence_score',
    'root_cause',
    'recommended_action',
    'action_parameter',
  ],
  properties: {
    threat_detected: { type: Type.BOOLEAN },
    attack_type: {
      type: Type.STRING,
      enum: [
        'BRUTE_FORCE',
        'HIGH_LOAD',
        'DATABASE_ERROR',
        'DDOS',
        'UNAUTHORIZED_ACCESS',
        'BUFFER_OVERFLOW',
        'DIRECTORY_TRAVERSAL',
        'RANSOMWARE',
        'DATA_INTEGRITY_LOSS',
        'UNKNOWN',
      ],
    },
    confidence_score: { type: Type.INTEGER },
    root_cause: { type: Type.STRING },
    recommended_action: {
      type: Type.STRING,
      enum: [
        'BLOCK_IP',
        'RESTART_SERVICE',
        'SCALE_RESOURCES',
        'SCALE_OUT',
        'ISOLATE_NODE',
        'RESTORE_BACKUP',
        'SEGMENT_ISOLATION',
        'ENGAGE_DEEP_VAULT',
        'IGNORE',
      ],
    },
    action_parameter: { type: Type.STRING },
  },
};

export const buildAnalysisPrompt = (incident: PendingIncident): string => {
  return `Analyze this CRITICAL incident and return the JSON verdict.

NODE CONTEXT:
- Name: ${incident.node_name}
- IP:   ${incident.ip_address}
- CPU:  ${incident.cpu_usage}%
- RAM:  ${incident.ram_usage}%

LOG ENTRY:
- Severity: ${incident.severity}
- Time:     ${incident.log_created_at.toISOString()}
- Message:  ${incident.message}
- Payload:  ${incident.payload ? JSON.stringify(incident.payload) : 'null'}`;
};

/* ====== Situation report prompts ====== */

export const SITUATION_SYSTEM_INSTRUCTION = `You are AEGIS, an autonomous cyber-defense analyst
producing executive briefings for a Security Operations Center.

OUTPUT RULES:
- Respond ONLY with a single JSON object matching the schema.
- "threat_level" is one of: GREEN (calm), YELLOW (elevated), ORANGE (active incidents),
  RED (mass attack or critical breach).
- "headline": ONE short sentence, max 12 words, military/SOC tone.
- "summary": 2-3 short sentences. Be specific about node names, attack types, and
  autopilot effectiveness if data is provided. Avoid filler.
- "recommendations": array of 1-3 short, actionable bullet strings for the human operator.`;

export const SITUATION_SCHEMA = {
  type: Type.OBJECT,
  required: ['threat_level', 'headline', 'summary', 'recommendations'],
  properties: {
    threat_level: {
      type: Type.STRING,
      enum: ['GREEN', 'YELLOW', 'ORANGE', 'RED'],
    },
    headline: { type: Type.STRING },
    summary: { type: Type.STRING },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
};

export interface SituationSnapshot {
  nodes: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    avg_cpu: number;
    avg_ram: number;
  };
  incidents: {
    pending: number;
    in_progress: number;
    resolved_last_5min: number;
    failed_last_5min: number;
  };
  recent_threats: Array<{
    node: string;
    attack_type: string;
    action: string;
    status: string;
    minutes_ago: number;
  }>;
}

export const buildSituationPrompt = (snap: SituationSnapshot): string => {
  const threats = snap.recent_threats.length === 0
    ? '(no recent threats)'
    : snap.recent_threats.map((t) =>
        `  - ${t.node}: ${t.attack_type} -> ${t.action} (${t.status}, ${t.minutes_ago}m ago)`
      ).join('\n');

  return `LIVE INFRASTRUCTURE SNAPSHOT:

Nodes: ${snap.nodes.healthy} healthy / ${snap.nodes.warning} warning / ${snap.nodes.critical} critical (of ${snap.nodes.total} total)
Average load: CPU ${snap.nodes.avg_cpu}% · RAM ${snap.nodes.avg_ram}%

Incidents: ${snap.incidents.pending} pending · ${snap.incidents.in_progress} in progress
Last 5 minutes: ${snap.incidents.resolved_last_5min} resolved · ${snap.incidents.failed_last_5min} failed

Recent autopilot activity:
${threats}

Produce the JSON briefing.`;
};
