import { useMemo, useRef, useState } from "react";
import type { Device, LogRow } from "../lib/api";
import { CATALOG_BY_TYPE } from "../data/catalog";
import { reachState, subnetOf } from "../lib/topology";

interface TopologyViewProps {
  devices: Device[];
  logs: LogRow[];
  onFocusDevice: (id: string) => void;
}

const CYAN = "#00A3FF";
const RED = "#FF4D6D";
const GREEN = "#00E599";
const AMBER = "#F5A623";

const VW = 1000;
const NODE_W = 176;
const NODE_H = 58;

interface Node {
  id: string;
  label: string;
  ip?: string;
  desc?: string;
  device?: Device;
  x: number;
  y: number;
  alert: boolean;
  booting: boolean;
}
interface Group {
  subnet: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ROUTER = new Set(["PFSENSE", "CORE_ROUTER"]);
const SWITCH = new Set(["MANAGED_SWITCH", "ACCESS_POINT"]);

/** Interaktives Live-Netzwerkdiagramm mit Subnetz-Gruppierung (reines SVG). */
export default function TopologyView({ devices, logs, onFocusDevice }: TopologyViewProps) {
  const alertIds = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs) if (l.priority === "P1" && l.status !== "RESOLVED") s.add(l.device_id);
    return s;
  }, [logs]);

  const { nodes, edges, groups, height } = useMemo(
    () => buildGraph(devices, alertIds),
    [devices, alertIds],
  );

  const [vt, setVt] = useState({ tx: 0, ty: 0, scale: 1 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const down = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, tx: vt.tx, ty: vt.ty };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setVt((v) => ({ ...v, tx: drag.current!.tx + (e.clientX - drag.current!.x), ty: drag.current!.ty + (e.clientY - drag.current!.y) }));
  };
  const up = () => (drag.current = null);
  const wheel = (e: React.WheelEvent) =>
    setVt((v) => ({ ...v, scale: Math.max(0.4, Math.min(2.4, v.scale * (e.deltaY < 0 ? 1.1 : 0.9))) }));

  return (
    <div className="relative h-full overflow-hidden bg-[#05060a]">
      <div className="pointer-events-none absolute left-6 top-4 z-10">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyber-cyan shadow-[0_0_8px_#00A3FF]" />
          Network Topology · Live-Sync
        </div>
        <p className="text-xs text-studio-muted">
          Ziehen = verschieben · Mausrad = zoomen · Doppelklick = Gerät fokussieren · Rahmen = Subnetz
        </p>
      </div>

      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VW} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="cursor-grab active:cursor-grabbing"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onWheel={wheel}
      >
        <defs>
          <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M34 0H0V34" fill="none" stroke="#0e2740" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={VW} height={height} fill="#05060a" />
        <rect x="0" y="0" width={VW} height={height} fill="url(#grid)" opacity="0.6" />

        <g transform={`translate(${vt.tx} ${vt.ty}) scale(${vt.scale})`}>
          {/* Subnetz-Rahmen */}
          {groups.map((g) => (
            <g key={g.subnet}>
              <rect
                x={g.x}
                y={g.y}
                width={g.w}
                height={g.h}
                rx={14}
                fill={CYAN}
                fillOpacity={0.03}
                stroke={CYAN}
                strokeOpacity={0.3}
                strokeDasharray="6 5"
              />
              <text x={g.x + 10} y={g.y + 16} fontSize="11" fill={CYAN} fontFamily="monospace" opacity={0.8}>
                {g.subnet}
              </text>
            </g>
          ))}

          {/* Verbindungslinien */}
          {edges.map((ed, i) => {
            const a = nodes.find((n) => n.id === ed.from);
            const b = nodes.find((n) => n.id === ed.to);
            if (!a || !b) return null;
            const midY = (a.y + b.y) / 2;
            const d = `M ${a.x} ${a.y + NODE_H / 2} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y - NODE_H / 2}`;
            const stroke = ed.alert ? RED : CYAN;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={stroke} strokeOpacity={0.22} strokeWidth={3} />
                <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} className="flow-line" style={{ filter: `drop-shadow(0 0 4px ${stroke}aa)` }} />
              </g>
            );
          })}

          {nodes.map((n) => (
            <TopoNode key={n.id} node={n} onFocus={onFocusDevice} />
          ))}
        </g>
      </svg>
    </div>
  );
}

function TopoNode({ node, onFocus }: { node: Node; onFocus: (id: string) => void }) {
  const isWan = node.id === "wan";
  const accent = node.alert ? RED : node.booting ? AMBER : CYAN;
  const statusColor = node.alert ? RED : node.booting ? AMBER : node.device?.status === "ONLINE" ? GREEN : "#5a5e6b";
  const w = isWan ? 120 : NODE_W;
  const h = isWan ? 40 : NODE_H;
  const meta = node.device ? CATALOG_BY_TYPE[node.device.type] : null;
  const Icon = meta?.Icon;

  return (
    <g
      transform={`translate(${node.x - w / 2} ${node.y - h / 2})`}
      style={{ cursor: node.device ? "pointer" : "default" }}
      onDoubleClick={() => node.device && onFocus(node.device.id)}
    >
      <rect width={w} height={h} rx={10} fill="#0b1320" stroke={accent} strokeWidth={node.alert ? 2 : 1.3} style={{ filter: `drop-shadow(0 0 ${node.alert ? 14 : 9}px ${accent}${node.alert ? "cc" : "77"})` }} />
      {node.alert && (
        <rect width={w} height={h} rx={10} fill={RED} opacity={0.08}>
          <animate attributeName="opacity" values="0.04;0.16;0.04" dur="1.1s" repeatCount="indefinite" />
        </rect>
      )}
      <g transform="translate(13 11)" style={{ color: accent }}>
        {isWan ? (
          <text x="0" y="13" fontSize="13" fill={accent} fontFamily="monospace" fontWeight="bold">☁</text>
        ) : Icon ? (
          <Icon width={18} height={18} />
        ) : null}
      </g>
      <text x={isWan ? 34 : 40} y={isWan ? 25 : 21} fontSize="12.5" fill="#e6e8ee" fontFamily="ui-sans-serif" fontWeight="600">
        {clip(node.label, isWan ? 12 : 17)}
      </text>
      {!isWan && (
        <>
          <text x={40} y={36} fontSize="10.5" fill={CYAN} fontFamily="monospace">
            {node.ip ?? "—"}
          </text>
          <text x={40} y={49} fontSize="9.5" fill="#5a5e6b" fontFamily="ui-sans-serif">
            {clip(node.desc ?? "", 22)}
          </text>
          <circle cx={w - 13} cy={13} r={3.5} fill={statusColor} style={{ filter: `drop-shadow(0 0 5px ${statusColor})` }} />
        </>
      )}
    </g>
  );
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function buildGraph(devices: Device[], alertIds: Set<string>) {
  const mk = (d: Device, x: number, y: number): Node => {
    const reach = reachState(d, devices);
    return {
      id: d.id,
      label: d.name,
      ip: d.details?.ip,
      desc: CATALOG_BY_TYPE[d.type]?.label,
      device: d,
      x,
      y,
      alert: d.status === "CRITICAL" || reach !== "ok" || alertIds.has(d.id),
      booting: d.status === "BOOTING",
    };
  };

  const routers = devices.filter((d) => ROUTER.has(d.type));
  const switches = devices.filter((d) => SWITCH.has(d.type));
  const endpoints = devices.filter((d) => !ROUTER.has(d.type) && !SWITCH.has(d.type));

  const nodes: Node[] = [];
  const edges: { from: string; to: string; alert: boolean }[] = [];
  const groups: Group[] = [];

  const wan: Node = { id: "wan", label: "Internet / WAN", x: VW / 2, y: 55, alert: false, booting: false };
  nodes.push(wan);

  const spread = (items: Device[], y: number): Node[] => {
    const n = Math.max(items.length, 1);
    return items.map((d, i) => {
      const node = mk(d, ((i + 1) / (n + 1)) * VW, y);
      nodes.push(node);
      return node;
    });
  };

  const rNodes = spread(routers, 150);
  const sNodes = spread(switches, 275);

  for (const r of rNodes) edges.push({ from: "wan", to: r.id, alert: r.alert });
  const swUplink = rNodes[0]?.id ?? "wan";
  for (const s of sNodes) edges.push({ from: swUplink, to: s.id, alert: s.alert });

  // Endgeräte nach Subnetz gruppieren
  const epUplink = sNodes[0]?.id ?? rNodes[0]?.id ?? "wan";
  const bySubnet = new Map<string, Device[]>();
  for (const d of endpoints) {
    const key = subnetOf(d);
    (bySubnet.get(key) ?? bySubnet.set(key, []).get(key)!).push(d);
  }

  const subnets = [...bySubnet.entries()];
  const top = 380;
  let maxBottom = top;
  const colW = VW / Math.max(subnets.length, 1);

  subnets.forEach(([subnet, devs], gi) => {
    const cx = (gi + 0.5) * colW;
    devs.forEach((d, di) => {
      const node = mk(d, cx, top + 36 + di * 72);
      nodes.push(node);
      edges.push({ from: epUplink, to: node.id, alert: node.alert });
    });
    const groupBottom = top + 36 + (devs.length - 1) * 72 + NODE_H / 2 + 14;
    groups.push({
      subnet,
      x: cx - NODE_W / 2 - 14,
      y: top,
      w: NODE_W + 28,
      h: groupBottom - top,
    });
    maxBottom = Math.max(maxBottom, groupBottom);
  });

  const height = Math.max(620, maxBottom + 30);
  return { nodes, edges, groups, height };
}
