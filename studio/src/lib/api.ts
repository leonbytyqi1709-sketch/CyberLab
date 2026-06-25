// Schlanker API-Client für den CyberLab-Studio-Dienst.
// Alle Pfade laufen relativ über den Vite-Proxy (/api → :3001) — kein CORS.

export type DeviceType =
  | "PROXMOX_NODE"
  | "UBUNTU_SERVER"
  | "WINDOWS_SERVER"
  | "MAC_STUDIO"
  | "RASPBERRY_PI"
  | "TRUENAS"
  | "SYNOLOGY"
  | "PFSENSE"
  | "MANAGED_SWITCH"
  | "CORE_ROUTER"
  | "ACCESS_POINT"
  | "SMART_UPS"
  | "WINDOWS_CLIENT"
  | "ADMIN_NOTEBOOK"
  | "DEV_WORKSTATION"
  | "MACBOOK_PRO"
  | "MACBOOK_AIR"
  | "THINKPAD"
  | "DELL_SERVER"
  | "HP_PROLIANT"
  | "QNAP_NAS";

export type DeviceStatus = "BOOTING" | "ONLINE" | "OFFLINE" | "CRITICAL";

/** Frei konfigurierbare Hardware-Ausstattung eines Geräts. */
export interface HwSpec {
  cpu: string;
  cores: number;
  ram_gb: number;
  storage_gb: number;
}

export interface DeviceMetrics {
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  temp_c: number;
  uptime_s: number;
  net_rx_mbps: number;
  net_tx_mbps: number;
  // typspezifisch (optional)
  iops?: number;
  gpu_usage?: number;
  unified_mem_total_gb?: number;
  unified_mem_used_gb?: number;
  battery_charge?: number;
  load_pct?: number;
}

export interface Process {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  hot?: boolean;
}

export interface OpenPort {
  port: number;
  service: string;
}

export type DiskState = "ONLINE" | "FAULTY" | "RESILVERING";

export interface Disk {
  slot: number;
  size_gb: number;
  kind: string;
  id?: string;
  state?: DiskState;
  resilver?: number;
}

export interface Zpool {
  name: string;
  status: "ONLINE" | "DEGRADED";
}

export interface DnsRecord {
  hostname: string;
  ip: string;
}

export interface DeviceDetails {
  os: string;
  chip?: string;
  ip?: string;
  packages: string[];
  disks: Disk[];
  metrics: DeviceMetrics | null;
  scanned?: boolean;
  ports?: OpenPort[];
  processes?: Process[];
  services?: string[];
  zpool?: Zpool;
  dns_records?: DnsRecord[];
  specs?: HwSpec;
}

export interface CopilotAnswer {
  hasProblem: boolean;
  title: string;
  diagnosis: string;
  command: string | null;
  closing: string;
}

export interface Device {
  id: string;
  homelab_id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  details: DeviceDetails;
  created_at: string;
}

export interface DeviceLog {
  id: string;
  device_id: string;
  title: string;
  description: string | null;
  priority: "P1" | "P2" | "P3";
  status: "OPEN" | "INVESTIGATING" | "RESOLVED";
  kind?: string;
  created_at: string;
}

/** Globaler Log-Eintrag inkl. Geräteinfo (für die Tabelle im unteren Panel). */
export interface LogRow extends DeviceLog {
  device_name: string;
  device_type: DeviceType;
}

/** Eintrag der Git-Style Konfigurations-Historie (Lab Commits). */
export interface LabCommit {
  hash: string;
  device_id: string | null;
  device_name: string | null;
  message: string;
  kind: string;
  created_at: string;
}

export interface Homelab {
  id: string;
  name: string;
  status: "ACTIVE" | "MAINTENANCE";
  created_at: string;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Anfrage fehlgeschlagen (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const hl = (homelabId?: string) =>
  homelabId ? `?homelab=${encodeURIComponent(homelabId)}` : "";

export const api = {
  // HomeLabs (= Infrastruktur-Tabs)
  listHomelabs: () => http<Homelab[]>("/homelabs"),
  createHomelab: (name: string) =>
    http<Homelab>("/homelabs", { method: "POST", body: JSON.stringify({ name }) }),
  renameHomelab: (id: string, name: string) =>
    http<Homelab>(`/homelabs/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteHomelab: (id: string) =>
    http<{ ok: boolean }>(`/homelabs/${id}`, { method: "DELETE" }),

  listDevices: (homelabId?: string) => http<Device[]>(`/devices${hl(homelabId)}`),
  getDevice: (id: string) => http<Device>(`/devices/${id}`),
  listLogs: (homelabId?: string) => http<LogRow[]>(`/logs${hl(homelabId)}`),
  getDeviceLogs: (id: string) => http<DeviceLog[]>(`/devices/${id}/logs`),
  createDevice: (input: {
    name: string;
    type: DeviceType;
    ip?: string;
    homelab_id?: string;
    specs?: HwSpec;
  }) =>
    http<Device>("/devices", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateDevice: (id: string, patch: { name?: string; ip?: string }) =>
    http<Device>(`/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteDevice: (id: string) =>
    http<{ ok: boolean }>(`/devices/${id}`, { method: "DELETE" }),
  clearDevices: (homelabId?: string) =>
    http<{ ok: boolean; deleted_count: number }>(`/devices${hl(homelabId)}`, {
      method: "DELETE",
    }),

  // Schritt 4 — Terminal-Aktionen
  scanDevice: (id: string) =>
    http<{ device: Device; ports: OpenPort[] }>(`/devices/${id}/scan`, {
      method: "POST",
    }),
  aptUpgrade: (id: string) =>
    http<{ ok: boolean; resolved: number }>(`/devices/${id}/apt-upgrade`, {
      method: "POST",
    }),
  dockerRestart: (id: string, container: string) =>
    http<{ ok: boolean; container: string; resolved: number }>(
      `/devices/${id}/docker-restart`,
      { method: "POST", body: JSON.stringify({ container }) },
    ),
  killProcess: (id: string, process: string) =>
    http<{ ok: boolean; pid: number; process: string; cleared: number }>(
      `/devices/${id}/kill`,
      { method: "POST", body: JSON.stringify({ process }) },
    ),
  copilot: (id: string) => http<CopilotAnswer>(`/devices/${id}/copilot`),

  // Schritt 6 — DNS (Feature A)
  listDns: (id: string) => http<DnsRecord[]>(`/devices/${id}/dns`),
  addDns: (id: string, hostname: string, ip: string) =>
    http<DnsRecord[]>(`/devices/${id}/dns`, {
      method: "POST",
      body: JSON.stringify({ hostname, ip }),
    }),
  removeDns: (id: string, hostname: string) =>
    http<DnsRecord[]>(`/devices/${id}/dns/${encodeURIComponent(hostname)}`, {
      method: "DELETE",
    }),
  resolveDns: (hostname: string) =>
    http<{ found: boolean; ip: string | null }>(
      `/dns/resolve?hostname=${encodeURIComponent(hostname)}`,
    ),

  // Paketverwaltung (Feature B)
  installService: (id: string, service: string) =>
    http<{ ok: boolean; service: string; process: string }>(
      `/devices/${id}/install`,
      { method: "POST", body: JSON.stringify({ service }) },
    ),
  systemctl: (id: string, action: "start" | "stop", service: string) =>
    http<{ ok: boolean; action: string; service: string }>(
      `/devices/${id}/systemctl`,
      { method: "POST", body: JSON.stringify({ action, service }) },
    ),

  // ZFS (Feature C)
  zpoolReplace: (id: string, oldId: string, newId: string) =>
    http<{ ok: boolean; old: string; new: string }>(
      `/devices/${id}/zpool-replace`,
      { method: "POST", body: JSON.stringify({ old: oldId, new: newId }) },
    ),

  // Schritt 7 — Lab Commits
  listCommits: (homelabId?: string) => http<LabCommit[]>(`/commits${hl(homelabId)}`),
  revertCommit: (hash: string) =>
    http<{ ok: boolean; device_id?: string; device_name?: string; message?: string; error?: string }>(
      `/commits/${encodeURIComponent(hash)}/revert`,
      { method: "POST" },
    ),
};
