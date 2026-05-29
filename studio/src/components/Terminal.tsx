import { useEffect, useRef, useState } from "react";
import { api, type Device } from "../lib/api";

interface TerminalProps {
  device: Device | null;
  onChanged: () => void;
  /** Von außen (z.B. Nmap-Button) eingespeister Befehl. */
  pendingCommand: string | null;
  onConsumed: () => void;
}

type Cls = "cmd" | "out" | "ok" | "info" | "warn" | "err" | "muted";
interface Line {
  id: number;
  text: string;
  cls: Cls;
  prompt?: string;
}

const COLOR: Record<Cls, string> = {
  cmd: "text-studio-text",
  out: "text-studio-text/85",
  ok: "text-matrix-green",
  info: "text-cyber-cyan",
  warn: "text-amber-400",
  err: "text-[#FF4D6D]",
  muted: "text-studio-muted",
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HELP: [string, string][] = [
  ["help", "Diese Übersicht anzeigen"],
  ["nmap -sV <ip>", "Gerät scannen & Ports/OS aufdecken"],
  ["nslookup <host> / ping <host>", "Namensauflösung über pfSense-DNS"],
  ["apt install <dienst>", "Dienst installieren (Ubuntu: nginx·postgresql·docker-ce)"],
  ["brew install <dienst>", "Dienst installieren (Mac Studio)"],
  ["systemctl stop|start <dienst>", "Dienst stoppen/starten (z.B. apache2)"],
  ["apt update && apt upgrade -y", "Sicherheitsupdates einspielen"],
  ["docker restart <container>", "Abgestürzten Service neu starten"],
  ["zpool replace tank <alt> <neu>", "Defekte ZFS-Disk ersetzen (Resilvering)"],
  ["kill <prozess>", "Außer Kontrolle geratenen Prozess beenden"],
  ["copilot --explain", "Gemini-Copilot: Diagnose + Fix-Befehl"],
  ["ports / uname -a / whoami", "Geräte-Infos"],
  ["clear", "Terminal leeren"],
];

export default function Terminal({
  device,
  onChanged,
  pendingCommand,
  onConsumed,
}: TerminalProps) {
  const [lines, setLines] = useState<Line[]>([
    { id: 0, text: "CyberLab Studio — interaktive Konsole. 'help' für Befehle.", cls: "info" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const idRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deviceRef = useRef(device);
  deviceRef.current = device;

  const prompt = device ? `root@${slug(device.name)}:~#` : "cyberlab@studio:~#";

  const push = (text: string, cls: Cls = "out", p?: string) =>
    setLines((prev) =>
      [...prev, { id: idRef.current++, text, cls, prompt: p }].slice(-250),
    );
  const updateLast = (text: string) =>
    setLines((prev) => {
      const copy = prev.slice();
      copy[copy.length - 1] = { ...copy[copy.length - 1], text };
      return copy;
    });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  /* ── Command-Handler ──────────────────────────────────────────────── */
  const run = async (raw: string) => {
    const cmd = raw.trim();
    push(cmd, "cmd", prompt);
    if (!cmd) return;

    const dev = deviceRef.current;
    const need = () => {
      if (!dev) {
        push("Kein Gerät ausgewählt — wähle eines im Explorer.", "err");
        return false;
      }
      return true;
    };

    // help
    if (cmd === "help") {
      push("Verfügbare Befehle:", "info");
      HELP.forEach(([c, d]) => push(`  ${c.padEnd(30)} ${d}`, "muted"));
      return;
    }
    if (cmd === "clear") {
      setLines([]);
      return;
    }
    if (cmd === "whoami") return void push("root", "out");
    if (cmd === "uname -a") {
      return void push(dev ? `${dev.details?.os ?? "Unknown"} ${dev.type}` : "no device", dev ? "out" : "err");
    }
    if (cmd === "ls") {
      return void push("bin  etc  home  var  opt  srv  root", "out");
    }
    if (cmd === "ports") {
      if (!need()) return;
      const ports = dev!.details?.ports;
      if (!ports?.length) return void push("Keine Daten — führe zuerst 'nmap -sV' aus.", "warn");
      ports.forEach((p) => push(`  ${String(p.port).padEnd(6)} open   ${p.service}`, "ok"));
      return;
    }

    // nmap
    if (cmd.startsWith("nmap")) {
      if (!need()) return;
      await runNmap(dev!, cmd);
      return;
    }
    // nslookup
    if (cmd.startsWith("nslookup")) {
      await runNslookup(cmd.split(/\s+/)[1]);
      return;
    }
    // ping
    if (cmd.startsWith("ping")) {
      await runPing(cmd.split(/\s+/)[1]);
      return;
    }
    // apt install / brew install
    if (cmd.startsWith("apt install") || cmd.startsWith("brew install")) {
      if (!need()) return;
      await runInstall(dev!, cmd.split(/\s+/)[2], cmd.startsWith("brew") ? "brew" : "apt");
      return;
    }
    // systemctl stop|start
    if (cmd.startsWith("systemctl")) {
      if (!need()) return;
      const parts = cmd.split(/\s+/);
      await runSystemctl(dev!, parts[1], parts[2]);
      return;
    }
    // zpool replace
    if (cmd.startsWith("zpool replace")) {
      if (!need()) return;
      const parts = cmd.split(/\s+/); // zpool replace <pool> <old> <new>
      await runZpoolReplace(dev!, parts[3], parts[4]);
      return;
    }
    // apt update && apt upgrade
    if (cmd.startsWith("apt")) {
      if (!need()) return;
      await runApt(dev!);
      return;
    }
    // docker restart
    if (cmd.startsWith("docker restart")) {
      if (!need()) return;
      const container = cmd.split(/\s+/)[2];
      if (!container) return void push("Verwendung: docker restart <container>", "warn");
      await runDocker(dev!, container);
      return;
    }
    // kill
    if (cmd.startsWith("kill")) {
      if (!need()) return;
      const proc = cmd.split(/\s+/)[1];
      if (!proc) return void push("Verwendung: kill <prozessname>", "warn");
      await runKill(dev!, proc);
      return;
    }
    // copilot
    if (cmd.startsWith("copilot")) {
      if (!need()) return;
      await runCopilot(dev!);
      return;
    }

    push(`${cmd.split(" ")[0]}: command not found`, "err");
  };

  /* ── einzelne Aktionen ────────────────────────────────────────────── */
  async function runNmap(dev: Device, cmd: string) {
    setBusy(true);
    const target = cmd.split(/\s+/).slice(1).find((t) => /\d|\./.test(t)) ?? dev.details?.ip ?? "10.10.10.10";
    push(`Starting Nmap 7.94 ( https://nmap.org )`, "muted");
    push(`Scanning ${target} [1000 ports]`, "muted");
    const t0 = Date.now();
    push("SYN Stealth Scan ... 0%", "muted");
    while (Date.now() - t0 < 3000) {
      await sleep(300);
      const pct = Math.min(99, Math.round(((Date.now() - t0) / 3000) * 100));
      updateLast(`SYN Stealth Scan ... ${pct}%`);
    }
    updateLast("SYN Stealth Scan ... 100%");
    try {
      const { ports } = await api.scanDevice(dev.id);
      push("", "out");
      push(`Nmap scan report for ${target}`, "info");
      push("PORT     STATE  SERVICE", "muted");
      ports.forEach((p) => push(`${String(p.port + "/tcp").padEnd(9)}open   ${p.service}`, "ok"));
      push(`Service detection performed. OS-Fingerprint erkannt ✓`, "ok");
      onChanged();
    } catch {
      push("nmap: Scan fehlgeschlagen", "err");
    } finally {
      setBusy(false);
    }
  }

  async function runApt(dev: Device) {
    setBusy(true);
    push("Reading package lists... Done", "muted");
    push("Building dependency tree... Done", "muted");
    push("[          ] 0%", "info");
    for (let i = 0; i <= 10; i++) {
      await sleep(140);
      const bar = "#".repeat(i) + " ".repeat(10 - i);
      updateLast(`[${bar}] ${i * 10}%`);
    }
    try {
      const { resolved } = await api.aptUpgrade(dev.id);
      push(
        resolved > 0
          ? `${resolved} Sicherheitsupdate-Alert(s) behoben. System aktuell ✓`
          : "Keine offenen Sicherheitsupdates. System bereits aktuell ✓",
        "ok",
      );
      onChanged();
    } catch {
      push("apt: Upgrade fehlgeschlagen", "err");
    } finally {
      setBusy(false);
    }
  }

  async function runDocker(dev: Device, container: string) {
    setBusy(true);
    push(`${container}: stopping...`, "muted");
    await sleep(500);
    push(`${container}: starting...`, "muted");
    await sleep(500);
    try {
      const r = await api.dockerRestart(dev.id, container);
      push(`${container} ✓ neu gestartet${r.resolved ? ` — ${r.resolved} Alert(s) behoben` : ""}.`, "ok");
      onChanged();
    } catch {
      push(`docker: Neustart von '${container}' fehlgeschlagen`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function runKill(dev: Device, proc: string) {
    try {
      const r = await api.killProcess(dev.id, proc);
      push(`[${r.pid}] ${r.process} beendet. Netdata stabilisiert.`, "ok");
      if (r.cleared) push(`${r.cleared} High-CPU-Alarm gelöscht.`, "ok");
      onChanged();
    } catch (e) {
      push(`kill: ${e instanceof Error ? e.message : "fehlgeschlagen"}`, "err");
    }
  }

  async function runCopilot(dev: Device) {
    push("Gemini Copilot analysiert die offenen Logs…", "muted");
    try {
      const a = await api.copilot(dev.id);
      push("╭─ Gemini Copilot ─────────────────────────────", "info");
      push(`│ ${a.title}`, a.hasProblem ? "warn" : "ok");
      push("│", "info");
      push(`│ ${a.diagnosis}`, "out");
      if (a.command) {
        push("│", "info");
        push(`│ Befehl:  ${a.command}`, "ok");
      }
      push("│", "info");
      push(`│ ${a.closing}`, "muted");
      push("╰──────────────────────────────────────────────", "info");
    } catch {
      push("copilot: Backend nicht verfügbar", "err");
    }
  }

  /* ── Feature A: DNS ───────────────────────────────────────────────── */
  async function runNslookup(host: string | undefined) {
    if (!host) return void push("Verwendung: nslookup <hostname>", "warn");
    push("Server:  pfSense-DNS (unbound)", "muted");
    try {
      const r = await api.resolveDns(host);
      if (r.found) {
        push(`Name:    ${host}`, "out");
        push(`Address: ${r.ip}`, "ok");
      } else {
        push(`** server can't find ${host}: NXDOMAIN`, "err");
      }
    } catch {
      push("nslookup: Auflösung fehlgeschlagen", "err");
    }
  }

  async function runPing(host: string | undefined) {
    if (!host) return void push("Verwendung: ping <host>", "warn");
    let ip = host;
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      try {
        const r = await api.resolveDns(host);
        if (!r.found || !r.ip) {
          push(`ping: ${host}: Host nicht gefunden (Name or service not known)`, "err");
          push("→ DNS-Eintrag fehlt. Lege ihn auf der pfSense im DNS-Manager an.", "muted");
          return;
        }
        ip = r.ip;
      } catch {
        push("ping: DNS-Fehler", "err");
        return;
      }
    }
    push(`PING ${host} (${ip}): 56 data bytes`, "muted");
    for (let i = 0; i < 3; i++) {
      await sleep(380);
      push(
        `64 bytes from ${ip}: icmp_seq=${i} ttl=64 time=${(0.2 + Math.random() * 1.6).toFixed(2)} ms`,
        "ok",
      );
    }
    push(`--- ${host} ping statistics: 3 transmitted, 3 received, 0% loss`, "muted");
  }

  /* ── Feature B: Paketverwaltung ───────────────────────────────────── */
  async function runInstall(dev: Device, service: string | undefined, mgr: "apt" | "brew") {
    if (!service) return void push(`Verwendung: ${mgr} install <dienst>`, "warn");
    if (mgr === "apt" && dev.type !== "UBUNTU_SERVER")
      return void push("apt ist hier nicht verfügbar (kein Debian/Ubuntu).", "warn");
    if (mgr === "brew" && dev.type !== "MAC_STUDIO")
      return void push("brew gibt es nur auf dem Mac Studio.", "warn");
    setBusy(true);
    push("Reading package lists... Done", "muted");
    push(`Resolving '${service}' dependencies...`, "muted");
    await sleep(700);
    try {
      await api.installService(dev.id, service);
      push(`✓ '${service}' installiert & gestartet — erscheint jetzt live in Netdata.`, "ok");
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler";
      push(`E: ${msg}`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function runSystemctl(dev: Device, action: string | undefined, service: string | undefined) {
    if (action !== "stop" && action !== "start")
      return void push("Verwendung: systemctl stop|start <dienst>", "warn");
    if (!service) return void push("Dienstname fehlt", "warn");
    try {
      await api.systemctl(dev.id, action, service);
      push(`${service} ${action === "stop" ? "gestoppt" : "gestartet"}.`, "ok");
      onChanged();
    } catch (e) {
      push(`systemctl: ${e instanceof Error ? e.message : "Fehler"}`, "err");
    }
  }

  /* ── Feature C: ZFS ───────────────────────────────────────────────── */
  async function runZpoolReplace(dev: Device, oldId: string | undefined, newId: string | undefined) {
    if (!oldId)
      return void push("Verwendung: zpool replace tank <alte-disk> <neue-disk>", "warn");
    try {
      const r = await api.zpoolReplace(dev.id, oldId, newId || `${oldId}-new`);
      push(`Disk ${r.old} wird durch ${r.new} ersetzt — Resilvering gestartet…`, "info");
      push('Fortschritt im Tab "ZFS-Storage" sichtbar (blauer Balken).', "muted");
      onChanged();
    } catch (e) {
      push(`zpool: ${e instanceof Error ? e.message : "Fehler"}`, "err");
    }
  }

  /* ── eingespeiste Befehle (z.B. Nmap-Button) ──────────────────────── */
  useEffect(() => {
    if (pendingCommand && !busy) {
      const c = pendingCommand;
      onConsumed();
      void run(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCommand, busy]);

  const submit = () => {
    if (busy) return;
    const c = input;
    setInput("");
    void run(c);
  };

  return (
    <div
      className="h-full cursor-text overflow-y-auto bg-studio-bg/40 px-3 py-2 font-mono text-[13px] leading-relaxed"
      ref={scrollRef}
      onClick={() => inputRef.current?.focus()}
    >
      {lines.map((l) => (
        <div key={l.id} className="flex flex-wrap whitespace-pre-wrap break-words">
          {l.cls === "cmd" && (
            <span className="mr-2 shrink-0 text-matrix-green">{l.prompt}</span>
          )}
          <span className={COLOR[l.cls]}>{l.text}</span>
        </div>
      ))}

      {/* aktive Eingabezeile */}
      <div className="flex items-center">
        <span className="mr-2 shrink-0 text-matrix-green">{prompt}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          className="flex-1 bg-transparent text-studio-text caret-cyber-cyan focus:outline-none disabled:opacity-50"
          style={{ caretColor: "#00A3FF" }}
        />
        {busy && <span className="caret-blink ml-1 text-cyber-cyan">▋</span>}
      </div>
    </div>
  );
}
