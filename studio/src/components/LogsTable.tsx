import type { LogRow } from "../lib/api";
import { CATALOG_BY_TYPE } from "../data/catalog";

interface LogsTableProps {
  logs: LogRow[];
  onSelectDevice: (deviceId: string) => void;
}

const P1 = "#FF4D6D"; // Cyber-Rot/Pink
const WARN = "#F5A623"; // warmes Orange (P2/P3)

const priorityColor = (p: LogRow["priority"]) => (p === "P1" ? P1 : WARN);

const statusStyle: Record<LogRow["status"], string> = {
  OPEN: "text-studio-text",
  INVESTIGATING: "text-cyber-cyan",
  RESOLVED: "text-matrix-green",
};

/** Strukturierte Tabelle aller System-Logs — jede Zeile wählt ihr Gerät aus. */
export default function LogsTable({ logs, onSelectDevice }: LogsTableProps) {
  return (
    <div className="h-full overflow-y-auto font-mono text-[13px]">
      {/* Kopfzeile */}
      <div className="sticky top-0 grid grid-cols-[88px_150px_1fr_64px_120px] gap-3 border-b border-studio-border bg-studio-surface px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-studio-muted">
        <span>Zeit</span>
        <span>Gerät</span>
        <span>Vorfall</span>
        <span>Prio</span>
        <span>Status</span>
      </div>

      {logs.length === 0 ? (
        <p className="px-4 py-6 text-sm text-studio-muted">
          Keine Einträge. Der Simulator meldet hier zufällige Vorfälle.
        </p>
      ) : (
        logs.map((log) => {
          const meta = CATALOG_BY_TYPE[log.device_type];
          const Icon = meta?.Icon;
          return (
            <button
              key={log.id}
              type="button"
              onClick={() => onSelectDevice(log.device_id)}
              title="Gerät auswählen & Live-Metriken öffnen"
              className="grid w-full grid-cols-[88px_150px_1fr_64px_120px] items-center gap-3 border-b border-studio-border px-4 py-1.5 text-left transition-colors hover:bg-studio-surface-2"
            >
              <span className="text-studio-muted">{fmtTime(log.created_at)}</span>
              <span className="flex items-center gap-1.5 truncate text-studio-text/90">
                {Icon && (
                  <Icon
                    width={13}
                    height={13}
                    className="shrink-0 text-studio-muted"
                  />
                )}
                <span className="truncate">{log.device_name}</span>
              </span>
              <span
                className="truncate"
                style={{ color: priorityColor(log.priority) }}
              >
                {log.title}
              </span>
              <span
                className="font-semibold"
                style={{ color: priorityColor(log.priority) }}
              >
                {log.priority}
              </span>
              <span className={`text-[11px] uppercase ${statusStyle[log.status]}`}>
                {log.status}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
