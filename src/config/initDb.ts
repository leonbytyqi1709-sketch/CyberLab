import bcrypt from 'bcryptjs';
import pool from './neon';

const schema = `
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS simulated_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY',
    cpu_usage INT DEFAULT 0,
    ram_usage INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES simulated_nodes(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id UUID REFERENCES system_logs(id) ON DELETE CASCADE,
    ai_analysis TEXT,
    action_taken TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor VARCHAR(120) NOT NULL,
    action_type VARCHAR(60) NOT NULL,
    resource_type VARCHAR(40),
    resource_id UUID,
    outcome VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS node_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID NOT NULL REFERENCES simulated_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES simulated_nodes(id) ON DELETE CASCADE,
    link_type VARCHAR(40) NOT NULL DEFAULT 'NETWORK',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_node_id, target_node_id)
);

CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(40) NOT NULL,
    model VARCHAR(60) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    input_tokens INT,
    output_tokens INT,
    duration_ms INT,
    estimated_cost_usd NUMERIC(12, 8),
    error_kind VARCHAR(40),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_source  ON api_usage(source, created_at DESC);

CREATE TABLE IF NOT EXISTS api_call_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(40) NOT NULL,
    model VARCHAR(60) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'in_flight',
    system_instruction_preview TEXT,
    prompt_preview TEXT,
    response_preview TEXT,
    input_tokens INT,
    output_tokens INT,
    duration_ms INT,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_traces_started ON api_call_traces(started_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(80) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(120)
);

CREATE TABLE IF NOT EXISTS siem_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_type VARCHAR(60) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    summary TEXT NOT NULL,
    affected_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_action VARCHAR(40),
    action_parameter TEXT,
    incident_count INT DEFAULT 0,
    resolved BOOLEAN DEFAULT false,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE simulated_nodes
    ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS parent_node_id UUID REFERENCES simulated_nodes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS spawned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor     ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_logs_created    ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_status ON incident_responses(status);
CREATE INDEX IF NOT EXISTS idx_links_source    ON node_links(source_node_id);
CREATE INDEX IF NOT EXISTS idx_links_target    ON node_links(target_node_id);
CREATE INDEX IF NOT EXISTS idx_siem_detected   ON siem_alerts(detected_at DESC);
`;

const seedAdminUser = async (): Promise<void> => {
  const email = process.env.ADMIN_EMAIL || 'admin@aegis.local';
  const password = process.env.ADMIN_PASSWORD || 'aegis-admin-2026';

  const { rowCount } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (rowCount && rowCount > 0) {
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
    [email, hash, 'admin']
  );

  console.log('[database]: ────────────────────────────────────────');
  console.log('[database]: Admin user seeded. LOGIN CREDENTIALS:');
  console.log(`[database]:   email    : ${email}`);
  console.log(`[database]:   password : ${password}`);
  console.log('[database]: Change ADMIN_EMAIL / ADMIN_PASSWORD in .env to override.');
  console.log('[database]: ────────────────────────────────────────');
};

export const initDatabase = async () => {
  try {
    console.log('[database]: Initializing schema...');
    await pool.query(schema);
    console.log('[database]: Schema initialized successfully');
    await seedAdminUser();
  } catch (err) {
    console.error('[database]: Schema initialization failed', err);
    throw err;
  }
};
