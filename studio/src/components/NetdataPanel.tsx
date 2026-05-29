import type { Device, Process } from "../lib/api";

interface NetdataPanelProps {
  device: Device;
}

const RED = "#FF4D6D";
const GREEN = "#00E599";
const CYAN = "#00A3FF";

const isHot = (p: Process) => p.hot || p.cpu >= 90;

/** Hochdichte Echtzeit-Prozesstabelle (htop / Netdata-Stil). */
export default function NetdataPanel({ device }: NetdataPanelProps) {
  const procs = [...(device.details?.processes ?? [])].sort((a, b) => b.cpu - a.cpu);
  const hotCount = procs.filter(isHot).length;

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyber-cyan shadow-[0_0_8px_#00A3FF]" />
              Netdata Metrics · Live
            </div>
            <h2 className="text-lg font-semibold text-studio-text">
              Prozess-Überwachung
            </h2>
          </div>
          {hotCount > 0 && (
            <span
              className="rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: `${RED}55`, color: RED, backgroundColor: `${RED}12` }}
            >
              {hotCount} Prozess(e) im roten Bereich · <code>kill &lt;name&gt;</code>
            </span>
          )}
        </header>

        <div className="overflow-hidden rounded-xl border border-studio-border bg-studio-surface font-mono text-[13px]">
          {/* Kopf */}
          <div className="grid grid-cols-[72px_1fr_120px_120px] gap-3 border-b border-studio-border bg-studio-surface-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-studio-muted">
            <span>PID</span>
            <span>Prozess</span>
            <span>CPU %</span>
            <span>MEM %</span>
          </div>

          {procs.map((p) => {
            const hot = isHot(p);
            return (
              <div
                key={p.pid}
                className="grid grid-cols-[72px_1fr_120px_120px] items-center gap-3 border-b border-studio-border/60 px-4 py-1.5 transition-colors"
                style={hot ? { backgroundColor: `${RED}10` } : undefined}
              >
                <span className="text-studio-muted">{p.pid}</span>
                <span
                  className="flex items-center gap-2 truncate"
                  style={{ color: hot ? RED : undefined }}
                >
                  {hot && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
                      style={{ backgroundColor: RED, boxShadow: `0 0 8px ${RED}` }}
                    />
                  )}
                  {p.name}
                  {hot && (
                    <span className="text-[10px] uppercase tracking-wide">· HIGH CPU</span>
                  )}
                </span>
                <Bar value={p.cpu} color={hot ? RED : GREEN} />
                <Bar value={p.mem} color={CYAN} />
              </div>
            );
          })}

          {procs.length === 0 && (
            <p className="px-4 py-6 text-sm text-studio-muted">
              Keine Prozessdaten verfügbar.
            </p>
          )}
        </div>

        <p className="mt-3 text-xs text-studio-muted">
          Werte aktualisieren alle 2 s aus dem Backend-Simulator. Bei einem
          High-CPU-Alarm brennt der Prozess rot auf — beende ihn im Terminal mit{" "}
          <code className="text-matrix-green">kill &lt;prozessname&gt;</code>.
        </p>
      </div>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-right" style={{ color }}>
        {value.toFixed(1)}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-studio-bg">
        <span
          className="block h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
        />
      </span>
    </span>
  );
}
