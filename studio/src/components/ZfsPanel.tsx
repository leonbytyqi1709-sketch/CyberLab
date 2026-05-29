import type { Device, Disk } from "../lib/api";

interface ZfsPanelProps {
  device: Device;
}

const GREEN = "#00E599";
const RED = "#FF4D6D";
const CYAN = "#00A3FF";

const stateColor = (s?: Disk["state"]) =>
  s === "FAULTY" ? RED : s === "RESILVERING" ? CYAN : GREEN;

/** Interaktives ZFS-Storage-Grid (6 Slots) mit Pool-Status & Resilvering. */
export default function ZfsPanel({ device }: ZfsPanelProps) {
  const disks = device.details?.disks ?? [];
  const pool = device.details?.zpool ?? { name: "tank", status: "ONLINE" as const };
  const degraded = pool.status === "DEGRADED";
  const faulty = disks.find((d) => d.state === "FAULTY");

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan">
              <span className="h-1.5 w-1.5 rounded-full bg-cyber-cyan shadow-[0_0_8px_#00A3FF]" />
              ZFS-Storage · {device.name}
            </div>
            <h2 className="text-lg font-semibold text-studio-text">
              Pool <span className="font-mono">{pool.name}</span>
            </h2>
          </div>
          <span
            className="rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              borderColor: `${degraded ? RED : GREEN}55`,
              color: degraded ? RED : GREEN,
              backgroundColor: `${degraded ? RED : GREEN}12`,
            }}
          >
            {degraded ? "DEGRADED" : "ONLINE"}
          </span>
        </header>

        {degraded && faulty && (
          <div
            className="mb-5 rounded-lg border px-4 py-3 text-sm"
            style={{ borderColor: `${RED}40`, backgroundColor: `${RED}0d`, color: RED }}
          >
            Disk <span className="font-mono">{faulty.id}</span> ausgefallen — Redundanz
            verloren, IOPS eingebrochen. Ersetzen im Terminal:{" "}
            <code className="font-mono text-studio-text">
              zpool replace {pool.name} {faulty.id} {faulty.id}-new
            </code>
          </div>
        )}

        {/* 6-Slot-Raster */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {disks.map((d) => {
            const c = stateColor(d.state);
            const resilvering = d.state === "RESILVERING";
            return (
              <div
                key={d.slot}
                className="rounded-xl border bg-studio-surface p-4 transition-shadow"
                style={{
                  borderColor: `${c}40`,
                  boxShadow:
                    d.state === "ONLINE"
                      ? `inset 0 0 24px -16px ${c}`
                      : `0 0 20px -6px ${c}66`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-studio-muted">
                    Slot #{d.slot}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }}
                  />
                </div>
                <div className="mt-2 font-mono text-sm text-studio-text">{d.id}</div>
                <div className="text-xs text-studio-muted">
                  {(d.size_gb / 1000).toFixed(0)} TB · {d.kind}
                </div>

                <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: c }}>
                  {d.state ?? "ONLINE"}
                </div>

                {resilvering && (
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-[10px] text-cyber-cyan">
                      <span>Resilvering</span>
                      <span>{d.resilver ?? 0}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-studio-bg">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${d.resilver ?? 0}%`, backgroundColor: CYAN, boxShadow: `0 0 8px ${CYAN}` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-studio-muted">
          RAID-Z Pool aus 6 Platten. Fällt eine Disk aus, wird der Pool DEGRADED
          und die IOPS brechen ein, bis du sie ersetzt — das Resilvering baut die
          Parität wieder auf, bis alles neon-grün leuchtet.
        </p>
      </div>
    </div>
  );
}
