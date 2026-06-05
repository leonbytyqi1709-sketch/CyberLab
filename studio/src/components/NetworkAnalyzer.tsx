import { useEffect, useRef, useState } from "react";
import type { Device } from "../lib/api";
import { reachState } from "../lib/topology";
import LineChart from "./charts/LineChart";

interface NetworkAnalyzerProps {
  devices: Device[];
}

const GREEN = "#00E599";
const CYAN = "#00A3FF";
const AMBER = "#F5A623";
const RED = "#FF4D6D";

const WINDOW = 70; // ~70 s Verlauf
const TICK_MS = 1000; // hochfrequent für flüssige Wellen

const isUp = (d: Device) => d.status === "ONLINE";

/** Stabile Basis-Latenz pro Geräte-Paar (deterministisch aus den IDs). */
function baseLatency(a: string, b: string): number {
  let h = 0;
  const s = a < b ? a + b : b + a;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return 0.3 + (h % 40) / 10; // 0.3 – 4.3 ms
}

/** Netdata-Style Netzwerkanalysator: Wellen-Diagramme + Ping-Matrix. */
export default function NetworkAnalyzer({ devices }: NetworkAnalyzerProps) {
  const devRef = useRef(devices);
  devRef.current = devices;

  const [traffic, setTraffic] = useState<number[]>([]);
  const [pdr, setPdr] = useState<number[]>([]);
  const [latency, setLatency] = useState<number[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const push = (set: React.Dispatch<React.SetStateAction<number[]>>, v: number) =>
      set((prev) => {
        const seed = prev.length ? prev : Array.from({ length: WINDOW }, () => v);
        return [...seed, v].slice(-WINDOW);
      });

    const id = window.setInterval(() => {
      const ds = devRef.current;
      const up = ds.filter(isUp);
      const down = ds.length - up.length;

      // Globaler Traffic (Summe rx+tx der Online-Geräte) + leichtes Rauschen
      const traf =
        up.reduce(
          (s, d) => s + (d.details?.metrics?.net_rx_mbps ?? 0) + (d.details?.metrics?.net_tx_mbps ?? 0),
          0,
        ) *
        (0.9 + Math.random() * 0.2);

      // Packet Delivery Rate (%) — sinkt bei down-Geräten
      const pd = Math.max(70, 100 - down * 6 - Math.random() * 1.5);

      // Avg Latency (ms) — steigt mit Last/Ausfällen
      const lat = 0.6 + Math.random() * 1.4 + down * 0.8;

      push(setTraffic, Math.round(traf));
      push(setPdr, Math.round(pd * 10) / 10);
      push(setLatency, Math.round(lat * 100) / 100);
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const cur = {
    traffic: traffic[traffic.length - 1] ?? 0,
    pdr: pdr[pdr.length - 1] ?? 100,
    latency: latency[latency.length - 1] ?? 0,
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyber-cyan shadow-[0_0_8px_#00A3FF]" />
            Netzwerk-Analysator · Live
          </div>
          <h1 className="text-xl font-semibold text-studio-text">
            Infrastruktur-Dashboard
          </h1>
        </header>

        {/* Wellen-Diagramme */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <WaveCard title="Global Traffic" unit="Mbit/s" value={cur.traffic} color={GREEN} series={traffic} />
          <WaveCard title="Packet Delivery Rate" unit="%" value={cur.pdr} color={CYAN} series={pdr} max={100} />
          <WaveCard title="Avg. Latency" unit="ms" value={cur.latency} color={AMBER} series={latency} />
        </div>

        {/* Ping-Matrix */}
        <section className="mt-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-studio-muted">
            Ping-Matrix · Latenz-Kreuztabelle
          </h2>
          <PingMatrix devices={devices} tick={tick} />
        </section>
      </div>
    </div>
  );
}

function WaveCard({
  title,
  unit,
  value,
  color,
  series,
  max,
}: {
  title: string;
  unit: string;
  value: number;
  color: string;
  series: number[];
  max?: number;
}) {
  return (
    <div className="ambient-blue rounded-xl border border-[#00A3FF]/20 bg-studio-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-studio-muted">
          {title}
        </span>
        <span className="font-mono text-sm" style={{ color }}>
          {value} {unit}
        </span>
      </div>
      <LineChart series={[{ values: series, color, fill: true }]} max={max} height={110} />
    </div>
  );
}

function PingMatrix({ devices, tick }: { devices: Device[]; tick: number }) {
  if (devices.length === 0) {
    return (
      <p className="rounded-lg border border-studio-border bg-studio-surface px-4 py-6 text-sm text-studio-muted">
        Keine Geräte in dieser Infrastruktur. Im Lab Builder Geräte hinzufügen.
      </p>
    );
  }

  const cell = (from: Device, to: Device) => {
    if (from.id === to.id) return { text: "—", bad: false };
    const reach = reachState(to, devices);
    if (reach === "timeout") return { text: "TIMEOUT", bad: true };
    if (reach === "unreachable") return { text: "UNREACHABLE", bad: true };
    // live jitternde Latenz
    const jitter = ((tick * 7 + from.name.length + to.name.length) % 9) / 10;
    const ms = baseLatency(from.id, to.id) + jitter;
    return { text: `${ms.toFixed(1)} ms`, bad: false };
  };

  const short = (n: string) => (n.length > 10 ? n.slice(0, 9) + "…" : n);

  return (
    <div className="overflow-auto rounded-xl border border-[#00A3FF]/20 bg-studio-surface">
      <table className="min-w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-r border-studio-border bg-studio-surface-2 px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-studio-muted">
              von ↓ / nach →
            </th>
            {devices.map((d) => (
              <th
                key={d.id}
                className="border-b border-studio-border bg-studio-surface-2 px-2 py-1.5 text-studio-text/80"
                title={d.name}
              >
                {short(d.name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {devices.map((from) => (
            <tr key={from.id}>
              <td
                className="sticky left-0 z-10 border-b border-r border-studio-border bg-studio-surface-2 px-2 py-1.5 text-studio-text/80"
                title={from.name}
              >
                {short(from.name)}
              </td>
              {devices.map((to) => {
                const c = cell(from, to);
                return (
                  <td
                    key={to.id}
                    className="border-b border-studio-border/60 px-2 py-1.5 text-center"
                    style={
                      c.bad
                        ? { color: RED, backgroundColor: `${RED}12` }
                        : from.id === to.id
                          ? { color: "#3a3e48" }
                          : { color: CYAN }
                    }
                  >
                    {c.bad ? <span className="animate-pulse text-[10px] font-semibold">{c.text}</span> : c.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
