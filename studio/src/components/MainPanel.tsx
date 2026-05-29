import type { Device } from "../lib/api";
import LabBuilder from "./LabBuilder";
import DeviceDetail from "./DeviceDetail";
import DeviceView from "./DeviceView";

interface MainPanelProps {
  selectedDevice: Device | null;
  onCreated: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  onRunCommand: (cmd: string) => void;
}

/**
 * Hauptfenster:
 *  - keine Auswahl   → Lab Builder (Werkbank)
 *  - Gerät ONLINE    → DeviceView (Tabs: Task-Manager / Netdata, oder Unknown-Device)
 *  - sonst (BOOTING) → statische Detailansicht
 */
export default function MainPanel({
  selectedDevice,
  onCreated,
  onChanged,
  onDeleted,
  onRunCommand,
}: MainPanelProps) {
  return (
    <main
      className={`relative flex-1 overflow-hidden border bg-studio-bg transition-shadow ${
        selectedDevice ? "glow-panel" : "border-[#00A3FF]/15"
      }`}
    >
      {!selectedDevice ? (
        <>
          <Strip label="Lab Builder" />
          <div className="h-[calc(100%-41px)]">
            <LabBuilder onCreated={onCreated} />
          </div>
        </>
      ) : selectedDevice.status === "ONLINE" ? (
        <DeviceView
          device={selectedDevice}
          onChanged={onChanged}
          onDeleted={onDeleted}
          onRunCommand={onRunCommand}
        />
      ) : (
        <>
          <Strip label={selectedDevice.name} />
          <div className="h-[calc(100%-41px)]">
            <DeviceDetail
              device={selectedDevice}
              onChanged={onChanged}
              onDeleted={onDeleted}
            />
          </div>
        </>
      )}
    </main>
  );
}

function Strip({ label }: { label: string }) {
  return (
    <div className="ambient-blue flex items-center gap-1 border-b border-[#00A3FF]/20 px-2">
      <div className="flex items-center gap-2 border-b-2 border-cyber-cyan px-3 py-2 text-sm text-studio-text">
        <span className="h-1.5 w-1.5 rounded-full bg-cyber-cyan shadow-[0_0_8px_#00A3FF]" />
        {label}
      </div>
    </div>
  );
}
