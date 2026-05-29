// Server-seitige Hardware-Profile: bestimmen, welche OS-Daten, Pakete und
// Festplatten-Slots ein Gerät je Typ in seinem JSONB-`details` erhält.

export type DeviceType =
  | "PROXMOX_NODE"
  | "UBUNTU_SERVER"
  | "WINDOWS_SERVER"
  | "MAC_STUDIO"
  | "RASPBERRY_PI"
  | "TRUENAS"
  | "SYNOLOGY"
  | "PFSENSE"
  | "MANAGED_SWITCH";

export type DiskState = "ONLINE" | "FAULTY" | "RESILVERING";

export interface Disk {
  slot: number;
  size_gb: number;
  kind: string;
  id?: string; // ZFS-Gerätename, z.B. "da0" (nur Storage)
  state?: DiskState; // nur Storage
  resilver?: number; // 0–100 % während des Wiederaufbaus
}

export interface Zpool {
  name: string;
  status: "ONLINE" | "DEGRADED";
}

export interface DeviceProfile {
  os: string;
  chip?: string;
  packages: string[];
  disks: Disk[];
}

export const PROFILES: Record<DeviceType, DeviceProfile> = {
  PROXMOX_NODE: {
    os: "Proxmox VE 8.2",
    packages: ["qemu-server", "lxc", "corosync", "ceph"],
    disks: [
      { slot: 1, size_gb: 512, kind: "NVMe" },
      { slot: 2, size_gb: 4000, kind: "HDD" },
    ],
  },
  UBUNTU_SERVER: {
    os: "Ubuntu Server 24.04 LTS",
    packages: ["openssh-server", "docker-ce", "nginx", "ufw"],
    disks: [{ slot: 1, size_gb: 256, kind: "SSD" }],
  },
  WINDOWS_SERVER: {
    os: "Windows Server 2025",
    packages: ["AD DS", "DNS", "IIS", "Hyper-V"],
    disks: [{ slot: 1, size_gb: 512, kind: "SSD" }],
  },
  MAC_STUDIO: {
    os: "macOS 15 Sequoia",
    chip: "Apple M2 Ultra · 24-Core",
    packages: ["Xcode CLT", "Homebrew", "Docker Desktop"],
    disks: [{ slot: 1, size_gb: 1024, kind: "SSD (Unified)" }],
  },
  RASPBERRY_PI: {
    os: "Raspberry Pi OS (64-bit)",
    chip: "BCM2712 · Cortex-A76",
    packages: ["pi-gpio", "docker", "avahi-daemon"],
    disks: [{ slot: 1, size_gb: 64, kind: "microSD" }],
  },
  TRUENAS: {
    os: "TrueNAS SCALE 24.10",
    packages: ["zfs", "smbd", "nfs-kernel-server"],
    disks: [
      { slot: 1, size_gb: 8000, kind: "HDD" },
      { slot: 2, size_gb: 8000, kind: "HDD" },
      { slot: 3, size_gb: 8000, kind: "HDD" },
      { slot: 4, size_gb: 8000, kind: "HDD" },
    ],
  },
  SYNOLOGY: {
    os: "Synology DSM 7.2",
    packages: ["Synology Drive", "Hyper Backup", "Container Manager"],
    disks: [
      { slot: 1, size_gb: 4000, kind: "HDD" },
      { slot: 2, size_gb: 4000, kind: "HDD" },
    ],
  },
  PFSENSE: {
    os: "pfSense CE 2.7.2",
    packages: ["pf", "unbound", "openvpn", "snort"],
    disks: [{ slot: 1, size_gb: 120, kind: "SSD" }],
  },
  MANAGED_SWITCH: {
    os: "SwitchOS 3.1",
    packages: ["lldp", "snmp", "rstp", "vlan-mgr"],
    disks: [],
  },
};

export const isDeviceType = (t: string): t is DeviceType => t in PROFILES;

/** Erzeugt 6 ZFS-Disks für Storage-Geräte (alle initial ONLINE). */
export function makeZfsDisks(type: DeviceType): Disk[] {
  const size = type === "TRUENAS" ? 8000 : 4000;
  return Array.from({ length: 6 }, (_, i) => ({
    slot: i + 1,
    id: `da${i}`,
    size_gb: size,
    kind: "HDD",
    state: "ONLINE" as DiskState,
  }));
}

/** Installierbare Dienste (Feature B) → zugehöriger Prozessname. */
export const INSTALLABLE: Record<string, { process: string; label: string }> = {
  nginx: { process: "nginx", label: "Webserver" },
  postgresql: { process: "postgres", label: "Datenbank" },
  "docker-ce": { process: "dockerd", label: "Container-Runtime" },
};

/** Baut den initialen `details`-Block beim Anlegen (noch ohne Live-Metriken). */
export function buildInitialDetails(type: DeviceType) {
  const p = PROFILES[type];
  const storage = isStorage(type);
  return {
    os: p.os,
    ...(p.chip ? { chip: p.chip } : {}),
    packages: p.packages,
    disks: storage ? makeZfsDisks(type) : p.disks,
    metrics: null, // werden erst beim Übergang auf ONLINE initialisiert
    scanned: false, // erst nach nmap-Scan true → "Unknown Device" bis dahin
    services: [] as string[], // via apt/brew installierte Dienste (Feature B)
    ...(storage ? { zpool: { name: "tank", status: "ONLINE" } as Zpool } : {}),
    ...(isNetwork(type) ? { dns_records: [] as { hostname: string; ip: string }[] } : {}),
  };
}

const rnd = (min: number, max: number) =>
  Math.round(min + Math.random() * (max - min));
const r1 = (v: number) => Math.round(v * 10) / 10;

/* ── Prozesse (für Netdata) ─────────────────────────────────────────── */
export interface Process {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  hot?: boolean; // true = "brennt" (High-CPU-Alarm)
}

const PROC_NAMES: Record<DeviceType, string[]> = {
  PROXMOX_NODE: ["systemd", "pve-cluster", "kvm", "corosync", "pvedaemon", "sshd", "rrdcached"],
  // Ubuntu: apache2 läuft vorinstalliert (belegt Port 80) — nginx/postgres/docker
  // müssen erst per `apt install` hinzugefügt werden (Feature B).
  UBUNTU_SERVER: ["systemd", "apache2", "containerd", "cron", "sshd"],
  WINDOWS_SERVER: ["System", "svchost.exe", "lsass.exe", "sqlservr.exe", "w3wp.exe", "MsMpEng.exe"],
  // Mac: Dienste via `brew install` (Feature B).
  MAC_STUDIO: ["launchd", "WindowServer", "kernel_task", "mds_stores"],
  RASPBERRY_PI: ["systemd", "dockerd", "python3", "mosquitto", "sshd"],
  TRUENAS: ["systemd", "smbd", "nfsd", "zfs", "middlewared", "sshd"],
  SYNOLOGY: ["systemd", "smbd", "synoindex", "pkgctl", "sshd"],
  PFSENSE: ["pf", "unbound", "openvpn", "syslogd", "sshd"],
  MANAGED_SWITCH: ["switchd", "lldpd", "snmpd", "stpd"],
};

/** Container/Services je Gerätetyp (für `docker restart` & Service-Incidents). */
export const CONTAINERS: Partial<Record<DeviceType, string[]>> = {
  PROXMOX_NODE: ["pve-firewall", "ceph-mon"],
  UBUNTU_SERVER: ["nginx", "postgres", "redis"],
  WINDOWS_SERVER: ["iis", "mssql"],
  MAC_STUDIO: ["registry", "buildkit"],
  RASPBERRY_PI: ["mosquitto", "grafana"],
  TRUENAS: ["minio", "syncthing"],
  SYNOLOGY: ["plex", "vaultwarden"],
};

export function initProcesses(type: DeviceType): Process[] {
  return PROC_NAMES[type].map((name) => ({
    pid: rnd(120, 9990),
    name,
    cpu: r1(rnd(0, 12) + Math.random()),
    mem: r1(rnd(1, 22) + Math.random()),
  }));
}

/** Typische offene Ports nach einem nmap-Scan (Service-Erkennung). */
export function scanPorts(type: DeviceType): { port: number; service: string }[] {
  const SSH = { port: 22, service: "ssh OpenSSH" };
  switch (type) {
    case "WINDOWS_SERVER":
      return [{ port: 135, service: "msrpc" }, { port: 445, service: "microsoft-ds" }, { port: 3389, service: "ms-wbt-server RDP" }];
    case "PFSENSE":
      return [SSH, { port: 443, service: "https pfSense" }, { port: 53, service: "domain" }];
    case "MANAGED_SWITCH":
      return [{ port: 23, service: "telnet" }, { port: 161, service: "snmp" }, { port: 443, service: "https" }];
    case "TRUENAS":
    case "SYNOLOGY":
      return [SSH, { port: 80, service: "http" }, { port: 443, service: "https" }, { port: 445, service: "smb" }];
    case "MAC_STUDIO":
      return [SSH, { port: 88, service: "kerberos" }, { port: 5900, service: "vnc Screen Sharing" }];
    case "PROXMOX_NODE":
      return [SSH, { port: 8006, service: "http Proxmox-VE" }, { port: 3128, service: "spice-proxy" }];
    default:
      return [SSH, { port: 80, service: "http nginx" }, { port: 443, service: "https" }];
  }
}

export const isStorage = (t: DeviceType) =>
  t === "TRUENAS" || t === "SYNOLOGY";
export const isNetwork = (t: DeviceType) =>
  t === "PFSENSE" || t === "MANAGED_SWITCH";

export interface Metrics {
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  temp_c: number;
  uptime_s: number;
  net_rx_mbps: number;
  net_tx_mbps: number;
  // typspezifisch
  iops?: number; // Storage
  gpu_usage?: number; // Mac Studio
  unified_mem_total_gb?: number; // Mac Studio
  unified_mem_used_gb?: number; // Mac Studio
}

/** Live-Ressourcen-Metriken, die beim ONLINE-Übergang initialisiert werden. */
export function initMetrics(type: DeviceType): Metrics {
  const net = isNetwork(type);
  const m: Metrics = {
    cpu_usage: net ? rnd(2, 12) : rnd(4, 28),
    ram_usage: net ? rnd(8, 22) : rnd(15, 45),
    disk_usage: type === "MANAGED_SWITCH" ? 0 : rnd(10, 40),
    temp_c: rnd(34, 52),
    uptime_s: 0,
    net_rx_mbps: rnd(1, 40),
    net_tx_mbps: rnd(1, 25),
  };

  if (isStorage(type)) m.iops = rnd(200, 1500);

  if (type === "MAC_STUDIO") {
    m.unified_mem_total_gb = 192; // M2 Ultra
    m.unified_mem_used_gb = rnd(24, 90);
    m.gpu_usage = rnd(5, 30);
  }

  return m;
}
