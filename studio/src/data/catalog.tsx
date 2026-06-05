import type { ComponentType, SVGProps } from "react";
import type { DeviceType } from "../lib/api";
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
}

export const CATALOG: CatalogItem[] = [
  // ── Compute ──
  { type: "PROXMOX_NODE", label: "Proxmox VE", blurb: "Virtualisierungs-Node", category: "Compute", Icon: CpuIcon, accent: "text-cyber-cyan" },
  { type: "UBUNTU_SERVER", label: "Ubuntu Server 24.04", blurb: "Linux-Server (LTS)", category: "Compute", Icon: UbuntuIcon, accent: "text-cyber-cyan" },
  { type: "WINDOWS_SERVER", label: "Windows Server 2025", blurb: "AD / DNS / Hyper-V", category: "Compute", Icon: WindowsIcon, accent: "text-cyber-cyan" },
  { type: "MAC_STUDIO", label: "Mac Studio", blurb: "Bare-Metal · Apple Silicon", category: "Compute", Icon: AppleIcon, accent: "text-matrix-green" },
  { type: "RASPBERRY_PI", label: "Raspberry Pi 5", blurb: "ARM Edge-Node", category: "Compute", Icon: RaspberryIcon, accent: "text-matrix-green" },

  // ── Storage ──
  { type: "TRUENAS", label: "TrueNAS Scale", blurb: "ZFS-Speicher", category: "Storage", Icon: StorageIcon, accent: "text-cyber-cyan" },
  { type: "SYNOLOGY", label: "Synology Core", blurb: "DSM-NAS", category: "Storage", Icon: ServerIcon, accent: "text-cyber-cyan" },

  // ── Network ──
  { type: "CORE_ROUTER", label: "Core-Router", blurb: "BGP / OSPF Gateway", category: "Network", Icon: RouterIcon, accent: "text-cyber-cyan" },
  { type: "PFSENSE", label: "pfSense Firewall", blurb: "Perimeter-Schutz", category: "Network", Icon: FirewallIcon, accent: "text-matrix-green" },
  { type: "MANAGED_SWITCH", label: "Managed Switch", blurb: "VLAN-Verteilung", category: "Network", Icon: SwitchIcon, accent: "text-matrix-green" },
  { type: "ACCESS_POINT", label: "WLAN Access Point", blurb: "WiFi 6 · UniFi", category: "Network", Icon: WifiIcon, accent: "text-cyber-cyan" },

  // ── Power ──
  { type: "SMART_UPS", label: "Smart-USV", blurb: "Akku · Last-Monitoring", category: "Power", Icon: BatteryIcon, accent: "text-matrix-green" },

  // ── Clients ──
  { type: "WINDOWS_CLIENT", label: "Büro-PC", blurb: "Windows 11 Pro", category: "Clients", Icon: DesktopIcon, accent: "text-cyber-cyan" },
  { type: "ADMIN_NOTEBOOK", label: "Admin-Notebook", blurb: "Windows 11 · Tools", category: "Clients", Icon: LaptopIcon, accent: "text-cyber-cyan" },
  { type: "DEV_WORKSTATION", label: "Dev-Workstation", blurb: "Debian 12", category: "Clients", Icon: CodeIcon, accent: "text-matrix-green" },
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
