import { useEffect, useState } from "react";
import { api, type Device, type DeviceLog } from "../lib/api";
import { CATALOG_BY_TYPE } from "../data/catalog";
import { SpinnerIcon } from "./icons";
import { STATUS_META } from "./statusMeta";
import DeviceHeaderActions from "./DeviceHeaderActions";

interface DeviceDetailProps {
  device: Device;
  onChanged: () => void;
  onDeleted: () => void;
}

/** Detailansicht eines ausgewählten Geräts (löst Lab Builder im Hauptfenster ab). */
export default function DeviceDetail({
  device,
  onChanged,
  onDeleted,
}: DeviceDetailProps) {
  const meta = CATALOG_BY_TYPE[device.type];
  const status = STATUS_META[device.status];
  const d = device.details ?? {};
  const m = d.metrics;

  const [logs, setLogs] = useState<DeviceLog[]>([]);

  // Logs laden — und bei Statuswechsel (z.B. BOOTING→ONLINE) neu ziehen.
  useEffect(() => {
    let alive = true;
    api
      .getDeviceLogs(device.id)
      .then((rows) => alive && setLogs(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [device.id, device.status]);

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Kopf */}
        <header className="mb-8 flex items-start gap-4">
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-xl border border-studio-border bg-studio-surface ${meta?.accent ?? "text-studio-text"}`}
          >
            {meta?.Icon ? <meta.Icon /> : null}
          </span>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-studio-text">
              {device.name}
            </h1>
            <p className="text-sm text-studio-muted">
              {meta?.label} · {d.os ?? "—"}
              {d.chip ? ` · ${d.chip}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={device.status} />
            <DeviceHeaderActions
              device={device}
              onChanged={onChanged}
              onDeleted={onDeleted}
            />
          </div>
        </header>

        {device.status === "BOOTING" ? (
          <BootingState />
        ) : (
          <>
            {/* Live-Metriken */}
            <section className="mb-8">
              <SectionTitle>Live-Ressourcen</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="CPU" value={m ? `${m.cpu_usage}%` : "—"} pct={m?.cpu_usage} />
                <Metric label="RAM" value={m ? `${m.ram_usage}%` : "—"} pct={m?.ram_usage} />
                <Metric label="Disk" value={m ? `${m.disk_usage}%` : "—"} pct={m?.disk_usage} />
                <Metric label="Temp" value={m ? `${m.temp_c}°C` : "—"} />
              </div>
            </section>

            {/* Festplatten-Slots */}
            <section className="mb-8">
              <SectionTitle>Festplatten-Slots</SectionTitle>
              {d.disks && d.disks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {d.disks.map((disk) => (
                    <div
                      key={disk.slot}
                      className="flex items-center gap-2 rounded-lg border border-studio-border bg-studio-surface px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs text-cyber-cyan">
                        #{disk.slot}
                      </span>
                      <span className="text-studio-text">
                        {disk.size_gb >= 1000
                          ? `${(disk.size_gb / 1000).toFixed(0)} TB`
                          : `${disk.size_gb} GB`}
                      </span>
                      <span className="text-xs text-studio-muted">{disk.kind}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-studio-muted">Keine lokalen Datenträger.</p>
              )}
            </section>

            {/* Installierte Pakete */}
            <section className="mb-8">
              <SectionTitle>Installierte Pakete</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {(d.packages ?? []).map((p) => (
                  <span
                    key={p}
                    className="rounded-md border border-studio-border bg-studio-surface px-2.5 py-1 font-mono text-xs text-studio-text/80"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Ereignis-Log */}
        <section>
          <SectionTitle>Ereignis-Log</SectionTitle>
          <div className="divide-y divide-studio-border rounded-lg border border-studio-border bg-studio-surface">
            {logs.length === 0 ? (
              <p className="px-4 py-4 text-sm text-studio-muted">
                Noch keine Einträge.
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span
                    className={`mt-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      log.priority === "P1"
                        ? "bg-red-500/15 text-red-400"
                        : log.priority === "P2"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-studio-surface-2 text-studio-muted"
                    }`}
                  >
                    {log.priority}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm text-studio-text">{log.title}</div>
                    {log.description && (
                      <div className="text-xs text-studio-muted">
                        {log.description}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[10px] uppercase text-studio-muted">
                    {log.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );

  function BootingState() {
    return (
      <div className="mb-8 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-6">
        <SpinnerIcon className="animate-spin text-amber-400" />
        <div>
          <div className="text-sm font-medium text-amber-300">BOOTING…</div>
          <div className="text-xs text-studio-muted">
            Gerät wird hochgefahren. Live-Metriken erscheinen, sobald{" "}
            <span style={{ color: status.hex }}>ONLINE</span>.
          </div>
        </div>
      </div>
    );
  }
}

function StatusBadge({ status }: { status: Device["status"] }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
      style={{ borderColor: `${meta.hex}55`, color: meta.hex, backgroundColor: `${meta.hex}12` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.hex, boxShadow: `0 0 8px ${meta.hex}` }}
      />
      {status}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-studio-muted">
      {children}
    </h2>
  );
}

function Metric({ label, value, pct }: { label: string; value: string; pct?: number }) {
  return (
    <div className="rounded-lg border border-studio-border bg-studio-surface p-3">
      <div className="text-[11px] uppercase tracking-wider text-studio-muted">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg text-studio-text">{value}</div>
      {typeof pct === "number" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-studio-bg">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-matrix-green"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  );
}
