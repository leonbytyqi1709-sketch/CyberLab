export type AttackType =
  | 'BRUTE_FORCE'
  | 'HIGH_LOAD'
  | 'DATABASE_ERROR'
  | 'DDOS'
  | 'UNAUTHORIZED_ACCESS'
  | 'BUFFER_OVERFLOW'
  | 'DIRECTORY_TRAVERSAL'
  | 'RANSOMWARE'
  | 'DATA_INTEGRITY_LOSS'
  | 'UNKNOWN';

export type RecommendedAction =
  | 'BLOCK_IP'
  | 'RESTART_SERVICE'
  | 'SCALE_RESOURCES'
  | 'SCALE_OUT'
  | 'ISOLATE_NODE'
  | 'RESTORE_BACKUP'
  | 'SEGMENT_ISOLATION'
  | 'ENGAGE_DEEP_VAULT'
  | 'IGNORE';

export type CampaignAction =
  | 'SEGMENT_ISOLATION'
  | 'GLOBAL_BLOCK'
  | 'ENGAGE_DEEP_VAULT'
  | 'MONITOR'
  | 'NONE';

export type CampaignSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IncidentVerdict {
  incident_id: string;
  threat_detected: boolean;
  attack_type: AttackType;
  confidence_score: number;
  root_cause: string;
  recommended_action: RecommendedAction;
  action_parameter: string;
}

export interface SiemCorrelationResult {
  campaign_detected: boolean;
  campaign_type: string;
  campaign_severity: CampaignSeverity;
  campaign_summary: string;
  affected_nodes: string[];
  recommended_campaign_action: CampaignAction;
  campaign_action_parameter: string;
  incident_verdicts: IncidentVerdict[];
}

export interface GeminiAnalysisResult {
  threat_detected: boolean;
  attack_type: AttackType;
  confidence_score: number;
  root_cause: string;
  recommended_action: RecommendedAction;
  action_parameter: string;
}

export interface PendingIncident {
  incident_id: string;
  log_id: string;
  severity: string;
  message: string;
  payload: Record<string, unknown> | null;
  log_created_at: Date;
  node_id: string;
  node_name: string;
  ip_address: string;
  cpu_usage: number;
  ram_usage: number;
}

export type ThreatLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface SituationReport {
  threat_level: ThreatLevel;
  headline: string;
  summary: string;
  recommendations: string[];
  generated_at: string;
}
