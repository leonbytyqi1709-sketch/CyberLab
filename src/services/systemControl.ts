import pool from '../config/neon';
import { writeAudit } from './auditLog';

const KEY_SIMULATION = 'is_simulation_active';

let cachedActive = false;
let cachedUpdatedBy: string | null = null;
let cachedUpdatedAt: Date | null = null;
let loaded = false;

export const loadSystemSettings = async (): Promise<void> => {
  const { rows } = await pool.query<{ value: unknown; updated_by: string | null; updated_at: Date | null }>(
    `SELECT value, updated_by, updated_at FROM system_settings WHERE key = $1`,
    [KEY_SIMULATION]
  );

  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2::jsonb, 'system:bootstrap', CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO NOTHING`,
      [KEY_SIMULATION, JSON.stringify(false)]
    );
    cachedActive = false;
    cachedUpdatedBy = 'system:bootstrap';
    cachedUpdatedAt = new Date();
  } else {
    const raw = rows[0].value;
    cachedActive = raw === true || raw === 'true';
    cachedUpdatedBy = rows[0].updated_by ?? null;
    cachedUpdatedAt = rows[0].updated_at ?? null;
  }

  loaded = true;
  console.log(
    `[control]: System autopilot loaded — active=${cachedActive}` +
      (cachedUpdatedBy ? ` (last toggled by ${cachedUpdatedBy})` : '')
  );
};

export const isSimulationActive = (): boolean => loaded && cachedActive;

export interface SystemStatus {
  simulation_active: boolean;
  updated_by: string | null;
  updated_at: string | null;
}

export const getSystemStatus = (): SystemStatus => ({
  simulation_active: cachedActive,
  updated_by: cachedUpdatedBy,
  updated_at: cachedUpdatedAt ? cachedUpdatedAt.toISOString() : null,
});

export const setSimulationActive = async (
  next: boolean,
  actor: string,
  ipAddress?: string
): Promise<SystemStatus> => {
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
    [KEY_SIMULATION, JSON.stringify(next), actor]
  );

  cachedActive = next;
  cachedUpdatedBy = actor;
  cachedUpdatedAt = new Date();

  await writeAudit({
    actor,
    actionType: next ? 'AUTOPILOT_ENABLED' : 'AUTOPILOT_DISABLED',
    resourceType: 'system_setting',
    details: {
      key: KEY_SIMULATION,
      previous: !next,
      next,
    },
    ipAddress,
  });

  console.log(
    `[control]: System autopilot ${next ? 'ENABLED — engaging defenses' : 'PAUSED — entering idle state'} ` +
      `by ${actor}`
  );

  return getSystemStatus();
};
