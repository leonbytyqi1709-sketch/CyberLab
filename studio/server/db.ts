import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// .env liegt im Projekt-Root (eine Ebene über studio/) — eine einzige
// Quelle für DATABASE_URL, keine Geheimnis-Duplikate.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/* ─────────────────────────────────────────────────────────────────────
   DB-Backend mit automatischem Fallback:
   1. Neon (Cloud-PostgreSQL) — wenn erreichbar.
   2. PGlite (lokales, dateigestütztes PostgreSQL) — wenn Neon blockiert ist
      (z.B. durch eine Firewall/GPO). Keine Installation, persistent unter
      studio/.pgdata, netzunabhängig. Mit STUDIO_DB=local erzwingbar.
   Beide sprechen dieselbe SQL — der restliche Code bleibt unverändert.
--------------------------------------------------------------------- */

interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}
interface Db {
  query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  backend: "neon" | "pglite";
}

async function connectNeon(): Promise<Db | null> {
  if (process.env.STUDIO_DB === "local" || !process.env.DATABASE_URL) return null;
  const connectionString = process.env.DATABASE_URL;
  const useSsl = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech");
  const p = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
    max: 2, // Limit pool size to prevent Neon connection limits exhaustion
  });
  p.on("error", () => {}); // verhindert unhandled-error-Crashes bei Verlust
  try {
    await p.query("SELECT 1");
    console.log(`[db]: PostgreSQL verbunden (${useSsl ? "SSL" : "kein SSL"}).`);
    return {
      backend: "neon", // Wir behalten "neon" als Backend-ID für den restlichen Code bei
      query: (t, params) =>
        p.query(t, params as never[]) as unknown as Promise<QueryResult>,
      exec: async (sql) => {
        await p.query(sql);
      },
    } as Db;
  } catch (e) {
    console.warn(
      `[db]: PostgreSQL nicht erreichbar (${(e as Error).message || "Timeout"}) — Fallback auf lokale PGlite.`,
    );
    await p.end().catch(() => {});
    return null;
  }
}

async function connectLocal(): Promise<Db> {
  const dir = path.resolve(__dirname, "../.pgdata");
  const lite = new PGlite(dir);
  await lite.waitReady;
  console.log(`[db]: Lokale PGlite-DB aktiv (${dir}).`);
  return {
    backend: "pglite",
    query: async <T = unknown>(text: string, params?: unknown[]) => {
      const r = await lite.query<T>(text, params as never[]);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
    exec: async (sql) => {
      await lite.exec(sql);
    },
  };
}

let dbPromise: Promise<Db> | null = null;
function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => (await connectNeon()) ?? (await connectLocal()))();
  }
  return dbPromise;
}

/** Drop-in-Ersatz für das frühere pg-Pool-Objekt: `pool.query(text, params)`. */
export const pool = {
  query: async <T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> => {
    const d = await getDb();
    return d.query<T>(text, params);
  },
};

/* ── Schema ───────────────────────────────────────────────────────────
   Log-Tabelle heißt bewusst `device_logs` (nicht `system_logs`).
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

CREATE TABLE IF NOT EXISTS lab_commits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash        VARCHAR(12) NOT NULL,
    device_id   UUID REFERENCES devices(id) ON DELETE SET NULL,
    device_name VARCHAR(120),
    message     VARCHAR(200) NOT NULL,
    kind        VARCHAR(30) NOT NULL DEFAULT 'change',
    snapshot    JSONB,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_homelab   ON devices(homelab_id);
CREATE INDEX IF NOT EXISTS idx_devicelogs_device ON device_logs(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commits_created   ON lab_commits(created_at DESC);

-- Schritt 8: type-CHECK lockern (neue Hardware-Typen); Validierung erfolgt in der App.
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_type_check;
`;

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
  const d = await getDb();
  
  try {
    const check = await d.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'devices'");
    if (check.rowCount > 0) {
      console.log("[db]: Schema bereits vorhanden. Überspringe DDL-Initialisierung.");
      await ensureDefaultHomelab();
      return;
    }
  } catch (err) {
    console.warn("[db]: Fehler beim Prüfen der Tabellen-Existenz, fahre fort:", err);
  }

  console.log(`[db]: initialisiere CyberLab-Schema (Backend: ${d.backend})…`);
  await d.exec(SCHEMA);
  await ensureDefaultHomelab();
  console.log("[db]: Schema bereit.");
}
