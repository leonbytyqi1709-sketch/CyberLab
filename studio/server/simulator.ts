import { pool } from "./db.ts";
import {
  isStorage,
  isNetwork,
  CONTAINERS,
  type DeviceType,
  type Metrics,
  type Process,
  type Disk,
  type Zpool,
} from "./catalog.ts";
import { GENERIC_INCIDENTS } from "./incidents.ts";

/* ── Tuning (per ENV überschreibbar — Defaults = Spezifikation) ──────── */
const METRICS_MS = Number(process.env.STUDIO_METRICS_MS ?? 2000); // alle 2 s
const INCIDENT_MIN_MS = Number(process.env.STUDIO_INCIDENT_MIN_MS ?? 120_000); // 2 min
const INCIDENT_MAX_MS = Number(process.env.STUDIO_INCIDENT_MAX_MS ?? 180_000); // 3 min

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const walk = (cur: number, step: number, min: number, max: number) =>
  clamp(cur + (Math.random() * 2 - 1) * step, min, max);
const r1 = (v: number) => Math.round(v * 10) / 10;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/* ── Metriken ───────────────────────────────────────────────────────── */
function nextMetrics(type: DeviceType, prev: Metrics): Metrics {
  const stepS = METRICS_MS / 1000;
  const m: Metrics = {
    cpu_usage: Math.round(walk(prev.cpu_usage ?? 10, 7, 2, 98)),
    ram_usage: Math.round(walk(prev.ram_usage ?? 30, 4, 5, 95)),
    disk_usage: Math.round(walk(prev.disk_usage ?? 20, 0.6, 3, 96)),
    temp_c: Math.round(walk(prev.temp_c ?? 42, 2, 30, 86)),
    uptime_s: (prev.uptime_s ?? 0) + stepS,
    net_rx_mbps: Math.round(walk(prev.net_rx_mbps ?? 20, 14, 0, 940)),
    net_tx_mbps: Math.round(walk(prev.net_tx_mbps ?? 12, 10, 0, 620)),
  };
  if (isStorage(type)) m.iops = Math.round(walk(prev.iops ?? 800, 250, 0, 6000));
  if (type === "MAC_STUDIO") {
    const total = prev.unified_mem_total_gb ?? 192;
    m.unified_mem_total_gb = total;
    m.unified_mem_used_gb = r1(walk(prev.unified_mem_used_gb ?? 48, 6, 12, total - 8));
    m.gpu_usage = Math.round(walk(prev.gpu_usage ?? 20, 12, 0, 100));
  }
  if (type === "SMART_UPS") {
    m.battery_charge = Math.round(walk(prev.battery_charge ?? 100, 0.8, 40, 100));
    m.load_pct = Math.round(walk(prev.load_pct ?? 35, 5, 5, 95));
    m.cpu_usage = 0;
    m.ram_usage = 0;
  }
  return m;
}

/* ── Prozesse ───────────────────────────────────────────────────────── */
function nextProcesses(prev: Process[]): Process[] {
  return prev.map((p) =>
    p.hot
      ? { ...p, cpu: r1(walk(p.cpu, 1.5, 90, 99)), mem: r1(walk(p.mem, 1, 1, 95)) }
      : { ...p, cpu: r1(walk(p.cpu, 4, 0.1, 60)), mem: r1(walk(p.mem, 2, 1, 80)) },
  );
}

/* ── Metrik-/Prozess-Tick: alle ONLINE-Geräte aktualisieren ─────────── */
async function tick(): Promise<void> {
  try {
    const { rows } = await pool.query<{
      id: string;
      type: DeviceType;
      details: {
        metrics: Metrics | null;
        processes?: Process[];
        disks?: Disk[];
        zpool?: Zpool;
      };
    }>("SELECT id, type, details FROM devices WHERE status = 'ONLINE'");

    for (const row of rows) {
      const patch: Record<string, unknown> = {};
      const degraded = row.details?.zpool?.status === "DEGRADED";

      if (row.details?.metrics) {
        const m = nextMetrics(row.type, row.details.metrics);
        // Bei DEGRADED-Pool brechen die IOPS ein.
        if (degraded && typeof m.iops === "number") m.iops = Math.round(m.iops * 0.12);
        patch.metrics = m;
      }
      if (row.details?.processes) patch.processes = nextProcesses(row.details.processes);

      // ZFS-Resilvering vorantreiben.
      if (row.details?.disks?.some((d) => d.state === "RESILVERING")) {
        const { disks, zpool } = advanceResilver(row.details.disks, row.details.zpool, row.id);
        patch.disks = disks;
        if (zpool) patch.zpool = zpool;
      }

      if (Object.keys(patch).length === 0) continue;
      await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
        row.id,
        JSON.stringify(patch),
      ]);
    }
  } catch (err) {
    console.error("[sim]: Tick fehlgeschlagen", err);
  }
}

/** Treibt Resilvering voran; bei 100 % wird die Disk wieder ONLINE und der
 *  Pool ggf. auf ONLINE zurückgesetzt (+ Alarm aufgelöst). */
function advanceResilver(
  disks: Disk[],
  zpool: Zpool | undefined,
  deviceId: string,
): { disks: Disk[]; zpool?: Zpool } {
  let anyResilvering = false;
  const next = disks.map((d) => {
    if (d.state !== "RESILVERING") return d;
    const progress = Math.min(100, (d.resilver ?? 0) + 18 + Math.random() * 10);
    if (progress >= 100) {
      return { ...d, state: "ONLINE" as const, resilver: undefined };
    }
    anyResilvering = true;
    return { ...d, resilver: Math.round(progress) };
  });

  const stillFaulty = next.some((d) => d.state === "FAULTY" || d.state === "RESILVERING");
  const newPool: Zpool = { name: zpool?.name ?? "tank", status: stillFaulty ? "DEGRADED" : "ONLINE" };

  // Wenn der Pool gerade gesund geworden ist, den ZFS-Alarm auflösen.
  if (!anyResilvering && !stillFaulty) {
    void pool.query(
      `UPDATE device_logs SET status = 'RESOLVED'
       WHERE device_id = $1 AND kind = 'zfs' AND status <> 'RESOLVED'`,
      [deviceId],
    );
  }
  return { disks: next, zpool: newPool };
}

/* ── Incidents ──────────────────────────────────────────────────────── */
type Kind = "security_update" | "process_cpu" | "service" | "incident" | "zfs";

async function insertLog(
  deviceId: string,
  title: string,
  description: string,
  priority: "P1" | "P2",
  kind: Kind,
  process: string | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO device_logs (device_id, title, description, priority, status, kind, process)
     VALUES ($1, $2, $3, $4, 'OPEN', $5, $6)`,
    [deviceId, title, description, priority, kind, process],
  );
}

async function fireIncident(): Promise<void> {
  try {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      type: DeviceType;
      details: { processes?: Process[]; disks?: Disk[]; zpool?: Zpool };
    }>("SELECT id, name, type, details FROM devices WHERE status = 'ONLINE' ORDER BY random() LIMIT 1");
    const dev = rows[0];
    if (!dev) return;

    const procs = dev.details?.processes ?? [];
    const containers = CONTAINERS[dev.type] ?? [];
    const generic = GENERIC_INCIDENTS[dev.type] ?? [];
    const disks = dev.details?.disks ?? [];
    const poolHealthy = dev.details?.zpool?.status !== "DEGRADED";
    const healthyDisks = disks.filter((d) => d.state === "ONLINE");

    // Mögliche Incident-Arten je nach Gerät
    const kinds: Kind[] = ["security_update"];
    if (procs.some((p) => !p.hot)) kinds.push("process_cpu");
    if (containers.length) kinds.push("service");
    if (generic.length) kinds.push("incident");
    // ZFS-Disk-Ausfall nur bei gesundem Pool mit ONLINE-Disks.
    if (isStorage(dev.type) && poolHealthy && healthyDisks.length > 1) kinds.push("zfs");
    const kind = pick(kinds);

    if (kind === "zfs") {
      const target = pick(healthyDisks);
      const updated = disks.map((d) =>
        d.id === target.id ? { ...d, state: "FAULTY" as const } : d,
      );
      await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
        dev.id,
        JSON.stringify({ disks: updated, zpool: { name: "tank", status: "DEGRADED" } }),
      ]);
      await insertLog(
        dev.id,
        `ZFS: Disk ${target.id} FAULTED`,
        `Pool 'tank' ist DEGRADED. Disk ${target.id} (Slot ${target.slot}) ausgefallen — IOPS eingebrochen. 'zpool replace tank ${target.id} <neue-disk>' ausführen.`,
        "P1",
        "zfs",
        target.id ?? null,
      );
      console.log(`[sim]: ZFS-Ausfall → ${dev.name} / ${target.id}`);
    } else if (kind === "process_cpu") {
      const candidates = procs.filter((p) => !p.hot);
      const target = pick(candidates);
      // Prozess als "hot" markieren (brennt in Netdata rot auf).
      const updated = procs.map((p) =>
        p.pid === target.pid ? { ...p, hot: true, cpu: 96 } : p,
      );
      await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
        dev.id,
        JSON.stringify({ processes: updated }),
      ]);
      await insertLog(
        dev.id,
        `High CPU: ${target.name}`,
        `Prozess '${target.name}' (PID ${target.pid}) verbraucht dauerhaft über 95 % CPU.`,
        "P2",
        "process_cpu",
        target.name,
      );
      console.log(`[sim]: High-CPU-Alarm → ${dev.name} / ${target.name}`);
    } else if (kind === "service") {
      const container = pick(containers);
      await insertLog(
        dev.id,
        `Service-Absturz: ${container}`,
        `Container '${container}' antwortet nicht mehr (exit 137).`,
        "P2",
        "service",
        container,
      );
      console.log(`[sim]: Service-Absturz → ${dev.name} / ${container}`);
    } else if (kind === "security_update") {
      const n = Math.floor(Math.random() * 18) + 3;
      await insertLog(
        dev.id,
        `${n} Sicherheitsupdates verfügbar`,
        `${n} Pakete mit CVE-Bezug warten auf Installation.`,
        "P2",
        "security_update",
        null,
      );
      console.log(`[sim]: Sicherheitsupdate-Alarm → ${dev.name}`);
    } else {
      const tpl = pick(generic);
      await insertLog(dev.id, tpl.title, tpl.description, tpl.priority, "incident", null);
      console.log(`[sim]: Incident ${tpl.priority} → ${dev.name}: ${tpl.title}`);
    }
  } catch (err) {
    console.error("[sim]: Incident-Erzeugung fehlgeschlagen", err);
  }
}

function scheduleIncident(): void {
  const delay = INCIDENT_MIN_MS + Math.random() * (INCIDENT_MAX_MS - INCIDENT_MIN_MS);
  setTimeout(() => {
    void fireIncident();
    scheduleIncident();
  }, delay);
}

export function startSimulator(): void {
  setInterval(() => void tick(), METRICS_MS);
  scheduleIncident();
  console.log(
    `[sim]: Simulator aktiv — Metriken/Prozesse alle ${METRICS_MS} ms, Incidents alle ${Math.round(
      INCIDENT_MIN_MS / 1000,
    )}–${Math.round(INCIDENT_MAX_MS / 1000)} s.`,
  );
}
