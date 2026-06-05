import { pool } from "./db.ts";
import { initMetrics, initProcesses, type DeviceType } from "./catalog.ts";
import { recordCommit } from "./commits.ts";

/** Dauer der simulierten Boot-Phase in Millisekunden (Spec: exakt 5 Sekunden). */
export const BOOT_DURATION_MS = 5000;

/**
 * Schließt den Boot ab: Status BOOTING → ONLINE und initialisiert die
 * Live-Metriken im JSONB-`details`. Die WHERE-Klausel auf status='BOOTING'
 * macht das idempotent (kein Doppel-Flip bei Re-Arm nach Neustart).
 */
async function completeBoot(deviceId: string, type: DeviceType): Promise<void> {
  try {
    const metrics = initMetrics(type);
    const processes = initProcesses(type);
    const res = await pool.query<{ name: string }>(
      `UPDATE devices
         SET status = 'ONLINE',
             details = details || $2::jsonb
       WHERE id = $1 AND status = 'BOOTING'
       RETURNING name`,
      [deviceId, JSON.stringify({ metrics, processes })],
    );

    if (res.rowCount) {
      const name = res.rows[0]?.name ?? null;
      await pool.query(
        `INSERT INTO device_logs (device_id, title, description, priority, status)
         VALUES ($1, $2, $3, 'P3', 'RESOLVED')`,
        [
          deviceId,
          "Boot abgeschlossen",
          "Gerät ist online. Live-Ressourcen-Metriken wurden initialisiert.",
        ],
      );
      await recordCommit(deviceId, name, `boot: ${name} online (${type})`, "boot");
      console.log(`[boot]: Gerät ${deviceId} → ONLINE`);
    }
  } catch (err) {
    console.error(`[boot]: Boot-Abschluss für ${deviceId} fehlgeschlagen`, err);
  }
}

/** Startet den 5-Sekunden-Timer für ein frisch angelegtes Gerät. */
export function armBoot(deviceId: string, type: DeviceType): void {
  setTimeout(() => void completeBoot(deviceId, type), BOOT_DURATION_MS);
}

/**
 * Recovery nach Server-Neustart: Geräte, die noch BOOTING sind, werden
 * abhängig von ihrem Alter sofort online geschaltet oder mit Restlaufzeit
 * neu eingeplant — so bleibt kein Gerät für immer im Boot hängen.
 */
export async function rearmPendingBoots(): Promise<void> {
  const { rows } = await pool.query<{
    id: string;
    type: DeviceType;
    age_ms: number;
  }>(
    `SELECT id, type,
            EXTRACT(EPOCH FROM (now() - created_at)) * 1000 AS age_ms
       FROM devices
      WHERE status = 'BOOTING'`,
  );

  for (const row of rows) {
    const remaining = BOOT_DURATION_MS - Number(row.age_ms);
    if (remaining <= 0) {
      await completeBoot(row.id, row.type);
    } else {
      setTimeout(() => void completeBoot(row.id, row.type), remaining);
    }
  }

  if (rows.length) {
    console.log(`[boot]: ${rows.length} ausstehende Boot-Vorgänge wiederhergestellt.`);
  }
}
