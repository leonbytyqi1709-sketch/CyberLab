import { Pool } from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// .env liegt im Projekt-Root (eine Ebene über studio/) — eine einzige
// Quelle für DATABASE_URL, keine Geheimnis-Duplikate.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon.tech
});

/* ── Schema ───────────────────────────────────────────────────────────
   Hinweis: Log-Tabelle heißt bewusst `device_logs` (nicht `system_logs`),
   da in derselben Neon-DB bereits eine inkompatible AEGIS-`system_logs`
   existiert. Felder entsprechen 1:1 der Spezifikation.
--------------------------------------------------------------------- */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS homelabs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(120) NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('ACTIVE', 'MAINTENANCE')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    homelab_id  UUID NOT NULL REFERENCES homelabs(id) ON DELETE CASCADE,
    name        VARCHAR(120) NOT NULL,
    type        VARCHAR(40)  NOT NULL
                CHECK (type IN (
                  'PROXMOX_NODE','UBUNTU_SERVER','WINDOWS_SERVER','MAC_STUDIO',
                  'RASPBERRY_PI','TRUENAS','SYNOLOGY','PFSENSE','MANAGED_SWITCH')),
    status      VARCHAR(20)  NOT NULL DEFAULT 'BOOTING'
                CHECK (status IN ('BOOTING','ONLINE','OFFLINE','CRITICAL')),
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    title       VARCHAR(160) NOT NULL,
    description TEXT,
    priority    VARCHAR(4)  NOT NULL DEFAULT 'P3'
                CHECK (priority IN ('P1','P2','P3')),
    status      VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','INVESTIGATING','RESOLVED')),
    kind        VARCHAR(30) NOT NULL DEFAULT 'system',
    process     VARCHAR(60),
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Spalten für bereits existierende device_logs (Schritt 4) nachziehen:
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS kind    VARCHAR(30) NOT NULL DEFAULT 'system';
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS process VARCHAR(60);

CREATE INDEX IF NOT EXISTS idx_devices_homelab   ON devices(homelab_id);
CREATE INDEX IF NOT EXISTS idx_devicelogs_device ON device_logs(device_id, created_at DESC);
`;

/** Stellt sicher, dass genau ein Standard-HomeLab existiert, und gibt dessen id zurück. */
export async function ensureDefaultHomelab(): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM homelabs ORDER BY created_at ASC LIMIT 1",
  );
  if (existing.rowCount && existing.rows[0]) return existing.rows[0].id;

  const created = await pool.query<{ id: string }>(
    "INSERT INTO homelabs (name, status) VALUES ($1, 'ACTIVE') RETURNING id",
    ["Main-Rack-01"],
  );
  console.log("[db]: Standard-HomeLab 'Main-Rack-01' angelegt.");
  return created.rows[0].id;
}

export async function initDb(): Promise<void> {
  console.log("[db]: initialisiere CyberLab-Schema…");
  await pool.query(SCHEMA);
  await ensureDefaultHomelab();
  console.log("[db]: Schema bereit.");
}
