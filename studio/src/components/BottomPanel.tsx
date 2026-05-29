import type { Device, LogRow } from "../lib/api";
import LogsTable from "./LogsTable";
import Terminal from "./Terminal";
import { TerminalIcon, ChevronIcon } from "./icons";

export type BottomTab = "logs" | "terminal";

interface BottomPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  tab: BottomTab;
  onTabChange: (t: BottomTab) => void;
  logs: LogRow[];
  onSelectDevice: (deviceId: string) => void;
  // Terminal
  device: Device | null;
  onChanged: () => void;
  pendingCommand: string | null;
  onConsumed: () => void;
}

/** Ausklappbares unteres Panel mit Tabs: System-Logs und interaktives Terminal. */
export default function BottomPanel({
  isOpen,
  onToggle,
  tab,
  onTabChange,
  logs,
  onSelectDevice,
  device,
  onChanged,
  pendingCommand,
  onConsumed,
}: BottomPanelProps) {
  const p1Count = logs.filter((l) => l.priority === "P1").length;

  return (
    <section
      className={`flex flex-col border-t bg-studio-surface transition-shadow ${
        isOpen ? "glow-panel" : "border-[#00A3FF]/20"
      }`}
    >
      <div className="ambient-blue flex items-center gap-1 px-2">
        <TabButton active={tab === "logs"} onClick={() => onTabChange("logs")}>
          <span className="inline-flex items-center gap-2">
            System-Logs
            <span className="rounded bg-studio-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-studio-muted">
              {logs.length}
            </span>
            {p1Count > 0 && (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                style={{ color: "#FF4D6D", backgroundColor: "#FF4D6D22" }}
              >
                {p1Count}× P1
              </span>
            )}
          </span>
        </TabButton>
        <TabButton active={tab === "terminal"} onClick={() => onTabChange("terminal")}>
          <span className="inline-flex items-center gap-1.5">
            <TerminalIcon width={13} height={13} className="text-matrix-green" />
            Terminal
          </span>
        </TabButton>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          title={isOpen ? "Panel einklappen" : "Panel ausklappen"}
          className="ml-auto p-2 text-studio-muted transition-colors hover:text-studio-text"
        >
          <ChevronIcon className={`transition-transform ${isOpen ? "" : "rotate-180"}`} />
        </button>
      </div>

      {isOpen && (
        <div className="h-56 border-t border-studio-border">
          {/* Beide Inhalte bleiben gemountet (Terminal-Verlauf bleibt erhalten). */}
          <div className={tab === "logs" ? "h-full" : "hidden"}>
            <LogsTable logs={logs} onSelectDevice={onSelectDevice} />
          </div>
          <div className={tab === "terminal" ? "h-full" : "hidden"}>
            <Terminal
              device={device}
              onChanged={onChanged}
              pendingCommand={pendingCommand}
              onConsumed={onConsumed}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
        active
          ? "border-cyber-cyan text-studio-text"
          : "border-transparent text-studio-muted hover:text-studio-text"
      }`}
    >
      {children}
    </button>
  );
}
