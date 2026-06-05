import type { SVGProps } from "react";

/* Schlanke, einheitliche Inline-Icons (stroke-basiert, 1.6px).
   Keine externe Icon-Dependency — voll selbst-enthalten. */

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const DashboardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="1.5" />
    <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" />
  </svg>
);

export const LabIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 3v6.5L4.5 17a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L15 9.5V3" />
    <path d="M8 3h8" />
    <path d="M7.5 14h9" />
  </svg>
);

export const AnalyzerIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12h3l2-6 3 13 3-9 2 4h5" />
  </svg>
);

export const LockIcon = (p: IconProps) => (
  <svg {...base({ width: 15, height: 15, ...p })}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, ...p })}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const TopologyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="5" r="2.4" />
    <circle cx="5" cy="18" r="2.4" />
    <circle cx="19" cy="18" r="2.4" />
    <path d="M12 7.4 6.4 15.8M12 7.4l5.6 8.4M7.4 18h9.2" />
  </svg>
);

export const DirectoryIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="6" r="2.6" />
    <path d="M12 8.6V12M12 12H6.5a2 2 0 0 0-2 2v1.5M12 12h5.5a2 2 0 0 1 2 2v1.5M12 12v3.5" />
    <circle cx="4.5" cy="18" r="2.2" />
    <circle cx="12" cy="18" r="2.2" />
    <circle cx="19.5" cy="18" r="2.2" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base({ width: 15, height: 15, ...p })}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
  </svg>
);

export const FolderIcon = (p: IconProps) => (
  <svg {...base({ width: 15, height: 15, ...p })}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const ShieldIcon = (p: IconProps) => (
  <svg {...base({ width: 15, height: 15, ...p })}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
  </svg>
);

export const GitIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M6 8.4v7.2M8.3 7.2 15 8.6M17 11.4c0 3-2.4 4-5 4.4" />
  </svg>
);

export const WikiIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z" />
    <path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H20" />
    <path d="M8 7h7M8 10.5h5" />
  </svg>
);

export const RouterIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, ...p })}>
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 16.5h.01M11 16.5h.01" />
    <path d="M12 13V7m0 0 3 2.5M12 7 9 9.5" />
  </svg>
);

export const SwitchIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, ...p })}>
    <rect x="3" y="8" width="18" height="8" rx="2" />
    <path d="M7 12h.01M10.5 12h.01M14 12h.01M17.5 12h.01" />
  </svg>
);

export const ServerIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, ...p })}>
    <rect x="4" y="3" width="16" height="8" rx="2" />
    <rect x="4" y="13" width="16" height="8" rx="2" />
    <path d="M8 7h.01M8 17h.01" />
  </svg>
);

export const FirewallIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, ...p })}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9.5 12l1.8 1.8 3.5-3.6" />
  </svg>
);

export const TerminalIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, ...p })}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9l3 3-3 3M13 15h4" />
  </svg>
);

export const ChevronIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, ...p })}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base({ width: 18, height: 18, ...p })}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

/* ── Gerätetyp-Icons (für Katalog & Explorer) ─────────────────────── */

export const CpuIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
    <rect x="9" y="9" width="6" height="6" rx="0.5" />
    <path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" />
  </svg>
);

export const AppleIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <path d="M16 13.5c0 3-2 5.5-3.6 5.5-.9 0-1.4-.5-2.4-.5s-1.6.5-2.5.5C5.8 19 4 15.6 4 12.6c0-3 1.9-4.6 3.7-4.6.9 0 1.7.6 2.3.6.6 0 1.5-.6 2.6-.6 1.2 0 2.4.6 3.1 1.7-2 1.2-1.8 4 .3 4.8" />
    <path d="M13 5.5c.5-.7.8-1.6.7-2.5-.9.1-1.7.5-2.2 1.1-.5.6-.8 1.4-.7 2.3.9 0 1.7-.4 2.2-.9" />
  </svg>
);

export const WindowsIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <path d="M3 5.5 11 4v7.5H3zM13 3.7 21 2.5V11.5h-8zM3 12.5h8V20l-8-1.5zM13 12.5h8v9l-8-1.2z" />
  </svg>
);

export const UbuntuIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="5.5" r="1.4" />
    <circle cx="6" cy="15.5" r="1.4" />
    <circle cx="18" cy="15.5" r="1.4" />
    <circle cx="12" cy="12" r="2.4" />
  </svg>
);

export const RaspberryIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <path d="M8 8c-2 0-3.5 1.6-3.5 3.8 0 3.2 3.2 6.2 7.5 6.2s7.5-3 7.5-6.2C19.5 9.6 18 8 16 8" />
    <path d="M9 8c0-2 1-3.5 3-3.5S15 6 15 8" />
    <path d="M9.5 13h.01M14.5 13h.01" />
  </svg>
);

export const StorageIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <rect x="7" y="6" width="10" height="3" rx="0.5" />
    <rect x="7" y="11" width="10" height="3" rx="0.5" />
    <path d="M14.5 16.5h1" />
  </svg>
);

export const WifiIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8 15.3a5 5 0 0 1 8 0" />
    <path d="M12 19h.01" />
  </svg>
);

export const BatteryIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <rect x="3" y="8" width="16" height="9" rx="2" />
    <path d="M21 11v3" />
    <path d="M6 11v3M9 11v3M12 11v3" />
  </svg>
);

export const DesktopIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </svg>
);

export const LaptopIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <rect x="5" y="5" width="14" height="9" rx="1.5" />
    <path d="M3 18h18l-1.5-2.5h-15z" />
  </svg>
);

export const CodeIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 20, ...p })}>
    <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
  </svg>
);

export const SpinnerIcon = (p: IconProps) => (
  <svg {...base({ width: 14, height: 14, ...p })}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

export const UnknownIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, ...p })}>
    <rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 3" />
    <path d="M9.6 9.7a2.4 2.4 0 1 1 3 2.3c-.8.3-1.1.8-1.1 1.6" />
    <path d="M11.5 16.2h.01" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...base({ width: 15, height: 15, ...p })}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const PencilIcon = (p: IconProps) => (
  <svg {...base({ width: 13, height: 13, ...p })}>
    <path d="M16.5 4.5l3 3L8 19l-4 1 1-4z" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base({ width: 14, height: 14, ...p })}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const XIcon = (p: IconProps) => (
  <svg {...base({ width: 14, height: 14, ...p })}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
