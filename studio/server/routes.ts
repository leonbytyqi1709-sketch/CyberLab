import { Router, type Request, type Response } from "express";
import { pool, ensureDefaultHomelab } from "./db.ts";
import {
  buildInitialDetails,
  isDeviceType,
  scanPorts,
  isStorage,
  INSTALLABLE,
  type DeviceType,
  type Process,
  type Disk,
} from "./catalog.ts";
import { armBoot } from "./boot.ts";
import { explain, type OpenLog } from "./copilot.ts";
import { recordCommit, revertToCommit } from "./commits.ts";

export const router = Router();

/** Validiert eine IPv4-Adresse (jede Oktett-Gruppe 0–255). */
const isValidIpv4 = (s: string): boolean =>
  /^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$/.test(s);

/* ── HomeLabs (= Infrastruktur-Tabs) ────────────────────────────────── */
router.get("/homelabs", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, status, created_at FROM homelabs ORDER BY created_at ASC",
    );
    res.json(rows);
  } catch (err) {
    console.error("[api]: GET /homelabs", err);
    res.status(500).json({ error: "Konnte HomeLabs nicht laden" });
  }
});

router.post("/homelabs", async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name ?? "").trim() || "Neue Infrastruktur";
    const { rows } = await pool.query(
      "INSERT INTO homelabs (name, status) VALUES ($1, 'ACTIVE') RETURNING id, name, status, created_at",
      [name],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[api]: POST /homelabs", err);
    res.status(500).json({ error: "Konnte HomeLab nicht anlegen" });
  }
});

router.patch("/homelabs/:id", async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Name darf nicht leer sein" });
      return;
    }
    const { rows } = await pool.query(
      "UPDATE homelabs SET name = $2 WHERE id = $1 RETURNING id, name, status, created_at",
      [req.params.id, name],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "HomeLab nicht gefunden" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("[api]: PATCH /homelabs/:id", err);
    res.status(500).json({ error: "Konnte HomeLab nicht ändern" });
  }
});

router.delete("/homelabs/:id", async (req: Request, res: Response) => {
  try {
    // Letztes HomeLab nicht löschen — es muss immer mindestens eins geben.
    const count = await pool.query<{ n: string }>("SELECT count(*)::int AS n FROM homelabs");
    if (Number(count.rows[0]?.n ?? 0) <= 1) {
      res.status(409).json({ error: "Das letzte HomeLab kann nicht gelöscht werden." });
      return;
    }
    const { rowCount } = await pool.query("DELETE FROM homelabs WHERE id = $1", [
      req.params.id,
    ]);
    if (!rowCount) {
      res.status(404).json({ error: "HomeLab nicht gefunden" });
      return;
    }
    res.json({ ok: true, deleted: req.params.id });
  } catch (err) {
    console.error("[api]: DELETE /homelabs/:id", err);
    res.status(500).json({ error: "Konnte HomeLab nicht löschen" });
  }
});

/* ── Geräte: Liste (optional nach ?homelab=<id> gefiltert) ──────────── */
router.get("/devices", async (req: Request, res: Response) => {
  try {
    const homelab = req.query.homelab ? String(req.query.homelab) : null;
    const { rows } = await pool.query(
      `SELECT id, homelab_id, name, type, status, details, created_at
         FROM devices
        ${homelab ? "WHERE homelab_id = $1" : ""}
        ORDER BY created_at ASC`,
      homelab ? [homelab] : [],
    );
    res.json(rows);
  } catch (err) {
    console.error("[api]: GET /devices", err);
    res.status(500).json({ error: "Konnte Geräte nicht laden" });
  }
});

/* ── Gerät: Detail ──────────────────────────────────────────────────── */
router.get("/devices/:id", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, homelab_id, name, type, status, details, created_at
         FROM devices WHERE id = $1`,
      [req.params.id],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("[api]: GET /devices/:id", err);
    res.status(500).json({ error: "Konnte Gerät nicht laden" });
  }
});

/* ── Logs: global (für die Tabelle im unteren Panel) ────────────────── */
router.get("/logs", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(
      parseInt(String(req.query.limit ?? "100"), 10) || 100,
      300,
    );
    const homelab = req.query.homelab ? String(req.query.homelab) : null;
    const { rows } = await pool.query(
      `SELECT l.id, l.device_id, l.title, l.description, l.priority,
              l.status, l.kind, l.created_at,
              d.name AS device_name, d.type AS device_type
         FROM device_logs l
         JOIN devices d ON d.id = l.device_id
        ${homelab ? "WHERE d.homelab_id = $2" : ""}
        ORDER BY l.created_at DESC
        LIMIT $1`,
      homelab ? [limit, homelab] : [limit],
    );
    res.json(rows);
  } catch (err) {
    console.error("[api]: GET /logs", err);
    res.status(500).json({ error: "Konnte Logs nicht laden" });
  }
});

/* ── Gerät: Logs ────────────────────────────────────────────────────── */
router.get("/devices/:id/logs", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, device_id, title, description, priority, status, created_at
         FROM device_logs
        WHERE device_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    console.error("[api]: GET /devices/:id/logs", err);
    res.status(500).json({ error: "Konnte Logs nicht laden" });
  }
});

/* ── Gerät: anlegen (startet Boot-Logik) ────────────────────────────── */
router.post("/devices", async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const type = String(req.body?.type ?? "").trim();
    const ip = req.body?.ip ? String(req.body.ip).trim() : "";
    let homelabId = req.body?.homelab_id as string | undefined;

    if (!name) {
      res.status(400).json({ error: "Name ist erforderlich" });
      return;
    }
    if (!isDeviceType(type)) {
      res.status(400).json({ error: `Unbekannter Gerätetyp: ${type}` });
      return;
    }
    if (ip && !isValidIpv4(ip)) {
      res.status(400).json({ error: `Ungültige IPv4-Adresse: ${ip}` });
      return;
    }
    if (!homelabId) homelabId = await ensureDefaultHomelab();

    const details = { ...buildInitialDetails(type), ...(ip ? { ip } : {}) };

    // Status bewusst explizit auf BOOTING (= DB-Default, hier zur Klarheit).
    const { rows } = await pool.query(
      `INSERT INTO devices (homelab_id, name, type, status, details)
       VALUES ($1, $2, $3, 'BOOTING', $4::jsonb)
       RETURNING id, homelab_id, name, type, status, details, created_at`,
      [homelabId, name, type, JSON.stringify(details)],
    );
    const device = rows[0];

    await pool.query(
      `INSERT INTO device_logs (device_id, title, description, priority, status)
       VALUES ($1, $2, $3, 'P3', 'INVESTIGATING')`,
      [device.id, "Provisionierung gestartet", `${device.name} bootet…`],
    );

    // 5-Sekunden-Boot-Timer scharf schalten.
    armBoot(device.id, type);

    res.status(201).json(device);
  } catch (err) {
    console.error("[api]: POST /devices", err);
    res.status(500).json({ error: "Konnte Gerät nicht anlegen" });
  }
});

/* ── Gerät: ändern (IP / Name) ──────────────────────────────────────── */
router.patch("/devices/:id", async (req: Request, res: Response) => {
  try {
    const sets: string[] = [];
    const params: unknown[] = [req.params.id];

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        res.status(400).json({ error: "Name darf nicht leer sein" });
        return;
      }
      params.push(name);
      sets.push(`name = $${params.length}`);
    }

    if (req.body?.ip !== undefined) {
      const ip = String(req.body.ip).trim();
      if (ip && !isValidIpv4(ip)) {
        res.status(400).json({ error: `Ungültige IPv4-Adresse: ${ip}` });
        return;
      }
      // IP im JSONB ablegen (bzw. bei leerem Wert entfernen).
      params.push(JSON.stringify(ip ? { ip } : {}));
      sets.push(
        ip
          ? `details = details || $${params.length}::jsonb`
          : `details = details - 'ip'`,
      );
      if (!ip) params.pop(); // bei Entfernen kein Parameter nötig
    }

    if (sets.length === 0) {
      res.status(400).json({ error: "Keine Änderungen angegeben" });
      return;
    }

    const { rows } = await pool.query(
      `UPDATE devices SET ${sets.join(", ")} WHERE id = $1
       RETURNING id, homelab_id, name, type, status, details, created_at`,
      params,
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("[api]: PATCH /devices/:id", err);
    res.status(500).json({ error: "Konnte Gerät nicht ändern" });
  }
});

/* ── Gerät: löschen (Logs verschwinden via ON DELETE CASCADE) ───────── */
router.delete("/devices/:id", async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM devices WHERE id = $1", [
      req.params.id,
    ]);
    if (!rowCount) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    res.json({ ok: true, deleted: req.params.id });
  } catch (err) {
    console.error("[api]: DELETE /devices/:id", err);
    res.status(500).json({ error: "Konnte Gerät nicht löschen" });
  }
});

/* ── Rack leeren: alle Geräte (optional nur eines HomeLabs) löschen ──── */
router.delete("/devices", async (req: Request, res: Response) => {
  try {
    const homelab = req.query.homelab ? String(req.query.homelab) : null;
    const { rowCount } = homelab
      ? await pool.query("DELETE FROM devices WHERE homelab_id = $1", [homelab])
      : await pool.query("DELETE FROM devices");
    res.json({ ok: true, deleted_count: rowCount ?? 0 });
  } catch (err) {
    console.error("[api]: DELETE /devices", err);
    res.status(500).json({ error: "Konnte Geräte nicht löschen" });
  }
});

/* ─────────────────────────────────────────────────────────────────────
   Schritt 4: Terminal-Aktionen (nmap / apt / docker / kill / copilot)
   ───────────────────────────────────────────────────────────────────── */

// Hilfsfunktion: Gerät laden oder 404
async function loadDevice(
  id: string,
): Promise<{ id: string; name: string; type: DeviceType; details: any } | null> {
  const { rows } = await pool.query(
    "SELECT id, name, type, details FROM devices WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}

/* ── nmap-Scan: deckt das Gerät auf (Unknown → voller Online-Zustand) ── */
router.post("/devices/:id/scan", async (req: Request, res: Response) => {
  try {
    const dev = await loadDevice(req.params.id);
    if (!dev) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    const ports = scanPorts(dev.type);
    const { rows } = await pool.query(
      `UPDATE devices SET details = details || $2::jsonb WHERE id = $1
       RETURNING id, homelab_id, name, type, status, details, created_at`,
      [dev.id, JSON.stringify({ scanned: true, ports })],
    );
    await pool.query(
      `INSERT INTO device_logs (device_id, title, description, priority, status, kind)
       VALUES ($1, $2, $3, 'P3', 'RESOLVED', 'system')`,
      [dev.id, "Nmap-Scan abgeschlossen", `${ports.length} offene Ports erkannt.`],
    );
    await recordCommit(dev.id, dev.name, `scan: ${dev.name} aufgedeckt (${ports.length} Ports)`, "scan");
    res.json({ device: rows[0], ports });
  } catch (err) {
    console.error("[api]: POST /scan", err);
    res.status(500).json({ error: "Scan fehlgeschlagen" });
  }
});

/* ── apt upgrade: behebt offene Sicherheitsupdate-Alerts ────────────── */
router.post("/devices/:id/apt-upgrade", async (req: Request, res: Response) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE device_logs SET status = 'RESOLVED'
       WHERE device_id = $1 AND kind = 'security_update' AND status <> 'RESOLVED'`,
      [req.params.id],
    );
    await recordCommit(req.params.id, null, "apt: Sicherheitsupdates eingespielt", "apt");
    res.json({ ok: true, resolved: rowCount ?? 0 });
  } catch (err) {
    console.error("[api]: POST /apt-upgrade", err);
    res.status(500).json({ error: "apt upgrade fehlgeschlagen" });
  }
});

/* ── docker restart: startet abgestürzten Service neu ───────────────── */
router.post("/devices/:id/docker-restart", async (req: Request, res: Response) => {
  try {
    const container = String(req.body?.container ?? "").trim();
    if (!container) {
      res.status(400).json({ error: "Container-Name fehlt" });
      return;
    }
    const { rowCount } = await pool.query(
      `UPDATE device_logs SET status = 'RESOLVED'
       WHERE device_id = $1 AND kind = 'service' AND process = $2 AND status <> 'RESOLVED'`,
      [req.params.id, container],
    );
    await recordCommit(req.params.id, null, `docker restart ${container}`, "docker");
    res.json({ ok: true, container, resolved: rowCount ?? 0 });
  } catch (err) {
    console.error("[api]: POST /docker-restart", err);
    res.status(500).json({ error: "docker restart fehlgeschlagen" });
  }
});

/* ── kill: Prozess beenden → Netdata stabilisiert, Log gelöscht ─────── */
router.post("/devices/:id/kill", async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.process ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Prozessname fehlt" });
      return;
    }
    const dev = await loadDevice(req.params.id);
    if (!dev) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    const procs: Process[] = dev.details?.processes ?? [];
    const target = procs.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!target) {
      res.status(404).json({ error: `Kein Prozess '${name}'` });
      return;
    }
    // Prozess „abkühlen": hot zurücksetzen, CPU normalisieren.
    const updated = procs.map((p) =>
      p.pid === target.pid ? { ...p, hot: false, cpu: 2 } : p,
    );
    await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
      dev.id,
      JSON.stringify({ processes: updated }),
    ]);
    // Zugehörigen High-CPU-Log-Eintrag löschen.
    const { rowCount } = await pool.query(
      `DELETE FROM device_logs
       WHERE device_id = $1 AND kind = 'process_cpu' AND process = $2`,
      [dev.id, target.name],
    );
    await recordCommit(dev.id, dev.name, `kill ${target.name} (PID ${target.pid})`, "kill");
    res.json({ ok: true, pid: target.pid, process: target.name, cleared: rowCount ?? 0 });
  } catch (err) {
    console.error("[api]: POST /kill", err);
    res.status(500).json({ error: "kill fehlgeschlagen" });
  }
});

/* ─────────────────────────────────────────────────────────────────────
   Feature A — DNS / Active Directory (auf Netzwerk-Geräten, z.B. pfSense)
   ───────────────────────────────────────────────────────────────────── */

interface DnsRecord {
  hostname: string;
  ip: string;
}

router.get("/devices/:id/dns", async (req: Request, res: Response) => {
  try {
    const dev = await loadDevice(req.params.id);
    if (!dev) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    res.json((dev.details?.dns_records as DnsRecord[]) ?? []);
  } catch (err) {
    console.error("[api]: GET /dns", err);
    res.status(500).json({ error: "DNS-Einträge nicht ladbar" });
  }
});

router.post("/devices/:id/dns", async (req: Request, res: Response) => {
  try {
    const hostname = String(req.body?.hostname ?? "").trim().toLowerCase();
    const ip = String(req.body?.ip ?? "").trim();
    if (!hostname) {
      res.status(400).json({ error: "Hostname fehlt" });
      return;
    }
    if (!isValidIpv4(ip)) {
      res.status(400).json({ error: `Ungültige IPv4-Adresse: ${ip}` });
      return;
    }
    const dev = await loadDevice(req.params.id);
    if (!dev) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    const records: DnsRecord[] = (dev.details?.dns_records as DnsRecord[]) ?? [];
    const next = [...records.filter((r) => r.hostname !== hostname), { hostname, ip }];
    await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
      dev.id,
      JSON.stringify({ dns_records: next }),
    ]);
    await recordCommit(dev.id, dev.name, `dns: ${hostname} → ${ip} (pfSense)`, "dns");
    res.status(201).json(next);
  } catch (err) {
    console.error("[api]: POST /dns", err);
    res.status(500).json({ error: "DNS-Eintrag fehlgeschlagen" });
  }
});

router.delete("/devices/:id/dns/:hostname", async (req: Request, res: Response) => {
  try {
    const dev = await loadDevice(req.params.id);
    if (!dev) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    const records: DnsRecord[] = (dev.details?.dns_records as DnsRecord[]) ?? [];
    const next = records.filter((r) => r.hostname !== req.params.hostname.toLowerCase());
    await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
      dev.id,
      JSON.stringify({ dns_records: next }),
    ]);
    res.json(next);
  } catch (err) {
    console.error("[api]: DELETE /dns", err);
    res.status(500).json({ error: "DNS-Eintrag nicht löschbar" });
  }
});

/** Homelab-weite Namensauflösung über alle pfSense-DNS-Tabellen. */
router.get("/dns/resolve", async (req: Request, res: Response) => {
  try {
    const hostname = String(req.query.hostname ?? "").trim().toLowerCase();
    const { rows } = await pool.query<{ recs: DnsRecord[] | null }>(
      "SELECT details->'dns_records' AS recs FROM devices WHERE type IN ('PFSENSE','MANAGED_SWITCH','CORE_ROUTER')",
    );
    for (const row of rows) {
      const hit = (row.recs ?? []).find((r) => r.hostname === hostname);
      if (hit) {
        res.json({ found: true, ip: hit.ip });
        return;
      }
    }
    res.json({ found: false, ip: null });
  } catch (err) {
    console.error("[api]: GET /dns/resolve", err);
    res.status(500).json({ error: "Auflösung fehlgeschlagen" });
  }
});

/* ─────────────────────────────────────────────────────────────────────
   Feature B — Paketverwaltung (apt/brew install, systemctl)
   ───────────────────────────────────────────────────────────────────── */

const rndPid = () => Math.floor(120 + Math.random() * 9800);

router.post("/devices/:id/install", async (req: Request, res: Response) => {
  try {
    const service = String(req.body?.service ?? "").trim().toLowerCase();
    const dev = await loadDevice(req.params.id);
    if (!dev) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    if (dev.type !== "UBUNTU_SERVER" && dev.type !== "MAC_STUDIO") {
      res.status(400).json({ error: "Paketverwaltung nur auf Ubuntu/Mac" });
      return;
    }
    const pkg = INSTALLABLE[service];
    if (!pkg) {
      res.status(400).json({ error: `Unbekanntes Paket '${service}'. Verfügbar: ${Object.keys(INSTALLABLE).join(", ")}` });
      return;
    }
    const services: string[] = dev.details?.services ?? [];
    const procs: Process[] = dev.details?.processes ?? [];
    if (services.includes(service) || procs.some((p) => p.name === pkg.process)) {
      res.status(409).json({ error: `'${service}' ist bereits installiert.` });
      return;
    }
    // Konflikt: nginx braucht Port 80 — kollidiert mit laufendem apache2.
    if (pkg.process === "nginx" && procs.some((p) => p.name === "apache2")) {
      res.status(409).json({
        error:
          "Port 80 wird bereits von 'apache2' belegt. Erst 'systemctl stop apache2' ausführen, dann erneut installieren.",
      });
      return;
    }
    const nextProcs = [...procs, { pid: rndPid(), name: pkg.process, cpu: 1, mem: 5 }];
    const nextServices = [...services, service];
    await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
      dev.id,
      JSON.stringify({ processes: nextProcs, services: nextServices }),
    ]);
    await recordCommit(dev.id, dev.name, `install: ${service} auf ${dev.name}`, "install");
    res.json({ ok: true, service, process: pkg.process });
  } catch (err) {
    console.error("[api]: POST /install", err);
    res.status(500).json({ error: "Installation fehlgeschlagen" });
  }
});

router.post("/devices/:id/systemctl", async (req: Request, res: Response) => {
  try {
    const action = String(req.body?.action ?? "").trim();
    const service = String(req.body?.service ?? "").trim();
    const dev = await loadDevice(req.params.id);
    if (!dev) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    const procs: Process[] = dev.details?.processes ?? [];
    if (action === "stop") {
      if (!procs.some((p) => p.name === service)) {
        res.status(404).json({ error: `Dienst '${service}' läuft nicht.` });
        return;
      }
      const next = procs.filter((p) => p.name !== service);
      await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
        dev.id,
        JSON.stringify({ processes: next }),
      ]);
      await recordCommit(dev.id, dev.name, `systemctl stop ${service}`, "systemctl");
      res.json({ ok: true, action, service });
      return;
    }
    if (action === "start") {
      const next = procs.some((p) => p.name === service)
        ? procs
        : [...procs, { pid: rndPid(), name: service, cpu: 1, mem: 4 }];
      await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
        dev.id,
        JSON.stringify({ processes: next }),
      ]);
      await recordCommit(dev.id, dev.name, `systemctl start ${service}`, "systemctl");
      res.json({ ok: true, action, service });
      return;
    }
    res.status(400).json({ error: "Aktion muss 'start' oder 'stop' sein" });
  } catch (err) {
    console.error("[api]: POST /systemctl", err);
    res.status(500).json({ error: "systemctl fehlgeschlagen" });
  }
});

/* ─────────────────────────────────────────────────────────────────────
   Feature C — ZFS: defekte Platte ersetzen (Resilvering startet)
   ───────────────────────────────────────────────────────────────────── */

router.post("/devices/:id/zpool-replace", async (req: Request, res: Response) => {
  try {
    const oldId = String(req.body?.old ?? "").trim();
    const newId = String(req.body?.new ?? "").trim() || oldId;
    const dev = await loadDevice(req.params.id);
    if (!dev) {
      res.status(404).json({ error: "Gerät nicht gefunden" });
      return;
    }
    if (!isStorage(dev.type)) {
      res.status(400).json({ error: "ZFS nur auf Storage-Geräten" });
      return;
    }
    const disks: Disk[] = dev.details?.disks ?? [];
    const target = disks.find((d) => d.id === oldId);
    if (!target) {
      res.status(404).json({ error: `Keine Disk '${oldId}' im Pool.` });
      return;
    }
    if (target.state !== "FAULTY") {
      res.status(409).json({ error: `Disk '${oldId}' ist nicht FAULTY (Status: ${target.state}).` });
      return;
    }
    const next = disks.map((d) =>
      d.id === oldId ? { ...d, id: newId, state: "RESILVERING" as const, resilver: 0 } : d,
    );
    await pool.query("UPDATE devices SET details = details || $2::jsonb WHERE id = $1", [
      dev.id,
      JSON.stringify({ disks: next }),
    ]);
    await recordCommit(dev.id, dev.name, `zpool replace ${oldId} → ${newId}`, "zfs");
    res.json({ ok: true, old: oldId, new: newId });
  } catch (err) {
    console.error("[api]: POST /zpool-replace", err);
    res.status(500).json({ error: "zpool replace fehlgeschlagen" });
  }
});

/* ── copilot --explain: Senior-Admin-Diagnose zum offenen Problem ───── */
router.get("/devices/:id/copilot", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<OpenLog>(
      `SELECT l.title, l.description, l.priority, l.kind, l.process, d.name AS device_name
         FROM device_logs l JOIN devices d ON d.id = l.device_id
        WHERE l.device_id = $1 AND l.status <> 'RESOLVED'
        ORDER BY (l.priority = 'P1') DESC, l.created_at DESC
        LIMIT 1`,
      [req.params.id],
    );
    res.json(explain(rows[0] ?? null));
  } catch (err) {
    console.error("[api]: GET /copilot", err);
    res.status(500).json({ error: "Copilot nicht verfügbar" });
  }
});

/* ─────────────────────────────────────────────────────────────────────
   Schritt 7 — Lab Commits (Git-Style Konfigurations-Historie)
   ───────────────────────────────────────────────────────────────────── */

router.get("/commits", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 300);
    const homelab = req.query.homelab ? String(req.query.homelab) : null;
    const { rows } = await pool.query(
      `SELECT hash, device_id, device_name, message, kind, created_at
         FROM lab_commits
        ${homelab ? "WHERE device_id IN (SELECT id FROM devices WHERE homelab_id = $2)" : ""}
        ORDER BY created_at DESC
        LIMIT $1`,
      homelab ? [limit, homelab] : [limit],
    );
    res.json(rows);
  } catch (err) {
    console.error("[api]: GET /commits", err);
    res.status(500).json({ error: "Konnte Commits nicht laden" });
  }
});

router.post("/commits/:hash/revert", async (req: Request, res: Response) => {
  try {
    const result = await revertToCommit(req.params.hash.trim());
    if (!result.ok) {
      res.status(result.error?.startsWith("Unbekannter") ? 404 : 400).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    console.error("[api]: POST /commits/:hash/revert", err);
    res.status(500).json({ error: "Revert fehlgeschlagen" });
  }
});
