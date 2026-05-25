export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: Date;
}

export interface SimulatedNode {
  id: string;
  node_name: string;
  ip_address: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'DOWN';
  cpu_usage: number;
  ram_usage: number;
  updated_at: Date;
}

export interface SystemLog {
  id: string;
  node_id: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  payload?: any;
  created_at: Date;
}

export interface IncidentResponse {
  id: string;
  log_id: string;
  ai_analysis?: string;
  action_taken?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'FAILED';
  resolved_at?: Date;
}
