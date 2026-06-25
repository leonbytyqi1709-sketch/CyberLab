import type { Device, DeviceMetrics } from "../lib/api";
import { CATALOG_BY_TYPE } from "../data/catalog";
import { STATUS_META } from "./statusMeta";
import LineChart, { type Series } from "./charts/LineChart";
import DeviceHeaderActions from "./DeviceHeaderActions";

const CYAN = "#00A3FF";
const GREEN = "#00E599";

interface DeviceDashboardProps {
  device: Device;
  /** Zeitreihen-Stichproben (vom DeviceView alle 2 s befüllt). */
  samples: DeviceMetrics[];
  onChanged: () => void;
  onDeleted: () => void;
}

/** Echtzeit-Performance-Dashboard für ein ONLINE-Gerät (Neon-Task-Manager). */
export default function DeviceDashboard({
  device,
  samples,
  onChanged,
  onDeleted,
}: DeviceDashboardProps) {
  const meta = CATALOG_BY_TYPE[device.type];
  const status = STATUS_META[device.status];

  const cur = samples[samples.length - 1] ?? device.details?.metrics;
  if (!cur) return null;

  const col = (key: keyof DeviceMetrics) =>
    samples.map((s) => Number(s[key] ?? 0));

  const isStorage = device.type === "TRUENAS" || device.type === "SYNOLOGY";
  const isMac = device.type === "MAC_STUDIO";

  return (
    <div className="h-full overflow-y-auto px-8 py-7">
      <div className="mx-auto max-w-5xl">
        {/* Kopf */}
        <header className="mb-6 flex items-center gap-4">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-xl border border-studio-border bg-studio-surface ${meta?.accent ?? ""}`}
          >
            {meta?.Icon ? <meta.Icon /> : null}
          </span>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-studio-text">
              {device.name}
            </h1>
            <p className="text-sm text-studio-muted">
              {meta?.label} · {device.details?.os}
              {device.details?.chip ? ` · ${device.details.chip}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
              style={{ borderColor: `${status.hex}55`, color: status.hex, backgroundColor: `${status.hex}12` }}
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ backgroundColor: status.hex, boxShadow: `0 0 8px ${status.hex}` }}
              />
              LIVE · ONLINE
            </span>
            <DeviceHeaderActions
              device={device}
              onChanged={onChanged}
              onDeleted={onDeleted}
            />
          </div>
        </header>

        {/* Kennzahlen-Leiste */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Temperatur" value={`${cur.temp_c}°C`} />
          <Stat label="Disk" value={`${cur.disk_usage}%`} />
          <Stat label="Uptime" value={formatUptime(cur.uptime_s)} />
          <Stat
            label="Netz Σ"
            value={`${cur.net_rx_mbps + cur.net_tx_mbps} Mbit/s`}
          />
        </div>

        {/* Konfigurierte Hardware (CPU/Kerne/RAM/Speicher) */}
        {device.details?.specs && (
          <div className="mb-6">
            <SectionTitle>Konfiguration</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="CPU" value={device.details.specs.cpu || "—"} />
              <Stat label="Kerne" value={`${device.details.specs.cores}`} />
              <Stat label="RAM" value={`${device.details.specs.ram_gb} GB`} />
              <Stat
                label="Speicher"
                value={
                  device.details.specs.storage_gb >= 1000
                    ? `${Math.round(device.details.specs.storage_gb / 1000)} TB`
                    : `${device.details.specs.storage_gb} GB`
                }
              />
            </div>
          </div>
        )}

        {/* Haupt-Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="CPU-Auslastung"
            value={`${cur.cpu_usage}%`}
            accent={GREEN}
            series={[{ values: col("cpu_usage"), color: GREEN, fill: true }]}
            max={100}
          />
          <ChartCard
            title="RAM-Auslastung"
            value={`${cur.ram_usage}%`}
            accent={CYAN}
            series={[{ values: col("ram_usage"), color: CYAN, fill: true }]}
            max={100}
          />

          {/* Netzwerk: kombinierter Graph (In/Out) */}
          <ChartCard
            title="Netzwerk"
            value={`↓ ${cur.net_rx_mbps}  ↑ ${cur.net_tx_mbps} Mbit/s`}
            accent={GREEN}
            className="lg:col-span-2"
            legend={[
              { label: "In (RX)", color: GREEN },
              { label: "Out (TX)", color: CYAN },
            ]}
            series={[
              { values: col("net_rx_mbps"), color: GREEN },
              { values: col("net_tx_mbps"), color: CYAN },
            ]}
          />

          {/* Storage-spezifisch: IOPS */}
          {isStorage && (
            <ChartCard
              title="IOPS"
              value={`${cur.iops ?? 0} IO/s`}
              accent={CYAN}
              series={[{ values: col("iops"), color: CYAN, fill: true }]}
            />
          )}

          {/* Mac-spezifisch: GPU-Auslastung */}
          {isMac && (
            <ChartCard
              title="GPU (76-Core)"
              value={`${cur.gpu_usage ?? 0}%`}
              accent={GREEN}
              series={[{ values: col("gpu_usage"), color: GREEN, fill: true }]}
              max={100}
            />
          )}
        </div>

        {/* Mac: Unified Memory */}
        {isMac && cur.unified_mem_total_gb && (
          <section className="mt-6">
            <SectionTitle>Unified Memory</SectionTitle>
            <div className="rounded-xl border border-studio-border bg-studio-surface p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-mono text-lg text-studio-text">
                  {cur.unified_mem_used_gb} GB
                  <span className="text-sm text-studio-muted">
                    {" "}
                    / {cur.unified_mem_total_gb} GB
                  </span>
                </span>
                <span className="text-sm text-matrix-green">
                  {Math.round(
                    ((cur.unified_mem_used_gb ?? 0) / cur.unified_mem_total_gb) *
                      100,
                  )}
                  %
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-studio-bg">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-matrix-green transition-[width] duration-500"
                  style={{
                    width: `${((cur.unified_mem_used_gb ?? 0) / cur.unified_mem_total_gb) * 100}%`,
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {/* Power: Smart-USV (Akku & Last) */}
        {device.type === "SMART_UPS" && (
          <section className="mt-6">
            <SectionTitle>Smart-USV</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="ambient-blue rounded-xl border border-[#00A3FF]/20 bg-studio-surface p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-studio-muted">
                    Battery Charge
                  </span>
                  <span
                    className="font-mono text-lg"
                    style={{ color: (cur.battery_charge ?? 100) < 50 ? "#FF4D6D" : GREEN }}
                  >
                    {cur.battery_charge ?? 100} %
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-studio-bg">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${cur.battery_charge ?? 100}%`,
                      backgroundColor: (cur.battery_charge ?? 100) < 50 ? "#FF4D6D" : GREEN,
                    }}
                  />
                </div>
              </div>
              <div className="ambient-blue rounded-xl border border-[#00A3FF]/20 bg-studio-surface p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-studio-muted">
                    Last
                  </span>
                  <span className="font-mono text-lg text-cyber-cyan">{cur.load_pct ?? 0} %</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-studio-bg">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-matrix-green transition-[width] duration-500"
                    style={{ width: `${cur.load_pct ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Compute: installierte Dienste (Feature B) */}
        {(device.type === "UBUNTU_SERVER" || device.type === "MAC_STUDIO") && (
          <section className="mt-6">
            <SectionTitle>Dienste</SectionTitle>
            <div className="ambient-blue rounded-xl border border-[#00A3FF]/20 bg-studio-surface p-4">
              {(device.details?.services ?? []).length === 0 ? (
                <p className="text-sm text-studio-muted">
                  Keine Dienste installiert. Im Terminal mit{" "}
                  <code className="text-matrix-green">
                    {device.type === "MAC_STUDIO" ? "brew" : "apt"} install
                    &lt;dienst&gt;
                  </code>{" "}
                  (nginx · postgresql · docker-ce) aktivieren — der Prozess
                  erscheint dann live in Netdata.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(device.details?.services ?? []).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-md border border-matrix-green/40 bg-matrix-green/10 px-2.5 py-1 font-mono text-xs text-matrix-green"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-matrix-green shadow-[0_0_6px_#00E599]" />
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ── kleine Bausteine ───────────────────────────────────────────────── */

function ChartCard({
  title,
  value,
  accent,
  series,
  max,
  legend,
  className = "",
}: {
  title: string;
  value: string;
  accent: string;
  series: Series[];
  max?: number;
  legend?: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <div
      className={`ambient-blue rounded-xl border border-[#00A3FF]/20 bg-studio-surface p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-studio-muted">
          {title}
        </span>
        <span className="font-mono text-sm" style={{ color: accent }}>
          {value}
        </span>
      </div>
      <LineChart series={series} max={max} />
      {legend && (
        <div className="mt-2 flex gap-4">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-xs text-studio-muted">
              <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ambient-blue rounded-lg border border-[#00A3FF]/15 bg-studio-surface px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-studio-muted">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base text-studio-text">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-studio-muted">
      {children}
    </h2>
  );
}

function formatUptime(s: number): string {
  const sec = Math.floor(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}
