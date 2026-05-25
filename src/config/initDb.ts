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
`;

export const initDatabase = async () => {
  try {
    console.log('[database]: Initializing schema...');
    await pool.query(schema);
    console.log('[database]: Schema initialized successfully');
  } catch (err) {
    console.error('[database]: Schema initialization failed', err);
    throw err;
  }
};
