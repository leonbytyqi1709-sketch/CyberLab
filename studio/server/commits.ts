import { randomBytes } from "node:crypto";
import { pool } from "./db.ts";

/** Git-artiger Kurz-Hash (7 hex). */
const newHash = () => randomBytes(4).toString("hex").slice(0, 7);

/**
 * Schreibt einen „Commit" in die Konfigurations-Historie. Snapshot = aktueller
 * Geräte-Zustand NACH der Änderung (für simuliertes `git revert`).
 */
export async function recordCommit(
  deviceId: string | null,
  deviceName: string | null,
  message: string,
  kind: string,
): Promise<string> {
  let snapshot: string | null = null;
  if (deviceId) {
    const r = await pool.query<{ name: string; status: string; details: unknown }>(
      "SELECT name, status, details FROM devices WHERE id = $1",
      [deviceId],
    );
    if (r.rows[0]) {
      snapshot = JSON.stringify({ status: r.rows[0].status, details: r.rows[0].details });
      if (!deviceName) deviceName = r.rows[0].name; // Name selbst nachschlagen
    }
  }
  const hash = newHash();
  await pool.query(
    `INSERT INTO lab_commits (hash, device_id, device_name, message, kind, snapshot)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [hash, deviceId, deviceName, message, kind, snapshot],
  );
  return hash;
}

export interface RevertResult {
  ok: boolean;
  error?: string;
  device_id?: string;
  device_name?: string | null;
  message?: string;
}

/**
 * Simuliertes `git revert <hash>`: setzt das betroffene Gerät auf den im
 * Commit gespeicherten Zustand zurück und löscht offene Fehler/Alarme.
 */
export async function revertToCommit(hash: string): Promise<RevertResult> {
  const c = (
    await pool.query<{
      device_id: string | null;
      device_name: string | null;
      message: string;
      snapshot: { status: string; details: unknown } | null;
    }>(
      "SELECT device_id, device_name, message, snapshot FROM lab_commits WHERE hash = $1 ORDER BY created_at DESC LIMIT 1",
      [hash],
    )
  ).rows[0];

  if (!c) return { ok: false, error: `Unbekannter Hash: ${hash}` };
  if (!c.device_id || !c.snapshot)
    return { ok: false, error: "Commit hat keinen Geräte-Snapshot." };

  // Gerätezustand wiederherstellen.
  await pool.query("UPDATE devices SET status = $2, details = $3::jsonb WHERE id = $1", [
    c.device_id,
    c.snapshot.status,
    JSON.stringify(c.snapshot.details),
  ]);
  // Offene Fehler/Alarme löschen.
  await pool.query(
    "DELETE FROM device_logs WHERE device_id = $1 AND status <> 'RESOLVED'",
    [c.device_id],
  );
  // Den Revert selbst als Commit festhalten.
  await recordCommit(c.device_id, c.device_name, `revert: zurück auf ${hash}`, "revert");

  return { ok: true, device_id: c.device_id, device_name: c.device_name, message: c.message };
}
