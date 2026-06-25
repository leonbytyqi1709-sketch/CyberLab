import type { ComponentType, SVGProps } from "react";
import type { DeviceType, HwSpec } from "../lib/api";
import {
  CpuIcon,
  AppleIcon,
  WindowsIcon,
  UbuntuIcon,
  RaspberryIcon,
  StorageIcon,
  ServerIcon,
  FirewallIcon,
  SwitchIcon,
  RouterIcon,
  WifiIcon,
  BatteryIcon,
  DesktopIcon,
  LaptopIcon,
  CodeIcon,
} from "../components/icons";

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>;

export type Category = "Compute" | "Storage" | "Network" | "Power" | "Clients";

export interface CatalogItem {
  type: DeviceType;
  label: string;
  blurb: string;
  category: Category;
  Icon: IconCmp;
  /** Tailwind-Akzentklasse fürs Karten-Highlight */
  accent: string;
  /** Vorbelegte Hardware-Ausstattung (im Dialog frei änderbar). */
  defaults: HwSpec;
}

const CYAN = "text-cyber-cyan";
const GREEN = "text-matrix-green";

export const CATALOG: CatalogItem[] = [
  // ── Compute ──
  { type: "PROXMOX_NODE", label: "Proxmox VE", blurb: "Virtualisierungs-Node", category: "Compute", Icon: CpuIcon, accent: CYAN, defaults: { cpu: "AMD EPYC 7313", cores: 16, ram_gb: 128, storage_gb: 4096 } },
  { type: "UBUNTU_SERVER", label: "Ubuntu Server 24.04", blurb: "Linux-Server (LTS)", category: "Compute", Icon: UbuntuIcon, accent: CYAN, defaults: { cpu: "Intel Xeon E-2388G", cores: 8, ram_gb: 32, storage_gb: 256 } },
  { type: "WINDOWS_SERVER", label: "Windows Server 2025", blurb: "AD / DNS / Hyper-V", category: "Compute", Icon: WindowsIcon, accent: CYAN, defaults: { cpu: "Intel Xeon Silver 4410Y", cores: 12, ram_gb: 64, storage_gb: 512 } },
  { type: "MAC_STUDIO", label: "Mac Studio", blurb: "Bare-Metal · Apple Silicon", category: "Compute", Icon: AppleIcon, accent: GREEN, defaults: { cpu: "Apple M2 Ultra", cores: 24, ram_gb: 192, storage_gb: 1024 } },
  { type: "RASPBERRY_PI", label: "Raspberry Pi 5", blurb: "ARM Edge-Node", category: "Compute", Icon: RaspberryIcon, accent: GREEN, defaults: { cpu: "Broadcom BCM2712", cores: 4, ram_gb: 8, storage_gb: 64 } },
  { type: "DELL_SERVER", label: "Dell PowerEdge R760", blurb: "Rack-Server · Rocky Linux", category: "Compute", Icon: ServerIcon, accent: CYAN, defaults: { cpu: "Intel Xeon Gold 6438Y", cores: 32, ram_gb: 256, storage_gb: 8192 } },
  { type: "HP_PROLIANT", label: "HP ProLiant DL380", blurb: "Virtualisierung · ESXi", category: "Compute", Icon: ServerIcon, accent: GREEN, defaults: { cpu: "AMD EPYC 9354", cores: 32, ram_gb: 384, storage_gb: 7680 } },

  // ── Storage ──
  { type: "TRUENAS", label: "TrueNAS Scale", blurb: "ZFS-Speicher", category: "Storage", Icon: StorageIcon, accent: CYAN, defaults: { cpu: "Intel Xeon D-1736", cores: 8, ram_gb: 64, storage_gb: 48000 } },
  { type: "SYNOLOGY", label: "Synology Core", blurb: "DSM-NAS", category: "Storage", Icon: ServerIcon, accent: CYAN, defaults: { cpu: "AMD Ryzen V1500B", cores: 4, ram_gb: 32, storage_gb: 24000 } },
  { type: "QNAP_NAS", label: "QNAP NAS", blurb: "QTS · ZFS-Pool", category: "Storage", Icon: StorageIcon, accent: GREEN, defaults: { cpu: "Intel Celeron N5105", cores: 4, ram_gb: 16, storage_gb: 24000 } },

  // ── Network ──
  { type: "CORE_ROUTER", label: "Core-Router", blurb: "BGP / OSPF Gateway", category: "Network", Icon: RouterIcon, accent: CYAN, defaults: { cpu: "ARM Cortex-A72", cores: 4, ram_gb: 4, storage_gb: 1 } },
  { type: "PFSENSE", label: "pfSense Firewall", blurb: "Perimeter-Schutz", category: "Network", Icon: FirewallIcon, accent: GREEN, defaults: { cpu: "Intel Atom C3558", cores: 4, ram_gb: 8, storage_gb: 120 } },
  { type: "MANAGED_SWITCH", label: "Managed Switch", blurb: "VLAN-Verteilung", category: "Network", Icon: SwitchIcon, accent: GREEN, defaults: { cpu: "Marvell Prestera", cores: 2, ram_gb: 2, storage_gb: 1 } },
  { type: "ACCESS_POINT", label: "WLAN Access Point", blurb: "WiFi 6 · UniFi", category: "Network", Icon: WifiIcon, accent: CYAN, defaults: { cpu: "MediaTek MT7986", cores: 2, ram_gb: 1, storage_gb: 1 } },

  // ── Power ──
  { type: "SMART_UPS", label: "Smart-USV", blurb: "Akku · Last-Monitoring", category: "Power", Icon: BatteryIcon, accent: GREEN, defaults: { cpu: "APC RM Controller", cores: 1, ram_gb: 0, storage_gb: 0 } },

  // ── Clients ──
  { type: "WINDOWS_CLIENT", label: "Büro-PC", blurb: "Windows 11 Pro", category: "Clients", Icon: DesktopIcon, accent: CYAN, defaults: { cpu: "Intel Core i5-14500", cores: 14, ram_gb: 16, storage_gb: 512 } },
  { type: "ADMIN_NOTEBOOK", label: "Admin-Notebook", blurb: "Windows 11 · Tools", category: "Clients", Icon: LaptopIcon, accent: CYAN, defaults: { cpu: "Intel Core Ultra 7 155H", cores: 16, ram_gb: 32, storage_gb: 1024 } },
  { type: "DEV_WORKSTATION", label: "Dev-Workstation", blurb: "Debian 12", category: "Clients", Icon: CodeIcon, accent: GREEN, defaults: { cpu: "AMD Ryzen 9 7950X", cores: 16, ram_gb: 64, storage_gb: 2048 } },
  { type: "MACBOOK_PRO", label: 'MacBook Pro 16"', blurb: "M5 Pro Max · macOS", category: "Clients", Icon: AppleIcon, accent: GREEN, defaults: { cpu: "Apple M5 Pro Max", cores: 16, ram_gb: 36, storage_gb: 1024 } },
  { type: "MACBOOK_AIR", label: 'MacBook Air 15.6"', blurb: "Apple Silicon · macOS", category: "Clients", Icon: AppleIcon, accent: CYAN, defaults: { cpu: "Apple M4", cores: 10, ram_gb: 16, storage_gb: 512 } },
  { type: "THINKPAD", label: "Lenovo ThinkPad", blurb: "Linux-Notebook", category: "Clients", Icon: LaptopIcon, accent: CYAN, defaults: { cpu: "Intel Core Ultra 7 165U", cores: 12, ram_gb: 32, storage_gb: 1024 } },
];

/** Schneller Lookup: Gerätetyp → Katalog-Metadaten (für Icon/Label im Explorer). */
export const CATALOG_BY_TYPE: Record<DeviceType, CatalogItem> = CATALOG.reduce(
  (acc, item) => {
    acc[item.type] = item;
    return acc;
  },
  {} as Record<DeviceType, CatalogItem>,
);

export const CATEGORIES: Category[] = ["Compute", "Storage", "Network", "Power", "Clients"];
