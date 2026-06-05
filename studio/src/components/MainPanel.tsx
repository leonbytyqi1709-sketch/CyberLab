import type { Device, LogRow, LabCommit } from "../lib/api";
import type { GlobalView } from "./ActivityBar";
import LabBuilder from "./LabBuilder";
import DeviceDetail from "./DeviceDetail";
import DeviceView from "./DeviceView";
import TopologyView from "./TopologyView";
import CommitsView from "./CommitsView";
import NetworkAnalyzer from "./NetworkAnalyzer";
import DirectoryView from "./DirectoryView";

interface MainPanelProps {
  selectedDevice: Device | null;
  view: GlobalView;
  homelabId: string;
  devices: Device[];
  logs: LogRow[];
  commits: LabCommit[];
  onCreated: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  onRunCommand: (cmd: string) => void;
  onFocusDevice: (id: string) => void;
}

const VIEW_LABEL: Record<GlobalView, string> = {
  netdata: "Netzwerk-Analysator",
  lab: "Lab Builder",
  topology: "Network Topology",
  directory: "Active Directory / LDAP",
  commits: "Lab Commits",
};

/**
 * Hauptfenster:
 *  - Gerät ausgewählt → DeviceView (ONLINE) bzw. Detailansicht.
 *  - sonst globale Ansicht je ActivityBar: Lab Builder / Topology / Commits.
 */
export default function MainPanel({
  selectedDevice,
  view,
  homelabId,
  devices,
  logs,
  commits,
  onCreated,
  onChanged,
  onDeleted,
  onRunCommand,
  onFocusDevice,
}: MainPanelProps) {
  return (
    <main
      className={`relative flex-1 overflow-hidden border bg-studio-bg transition-shadow ${
        selectedDevice ? "glow-panel" : "border-[#00A3FF]/15"
      }`}
    >
      {selectedDevice ? (
        selectedDevice.status === "ONLINE" ? (
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
              <DeviceDetail device={selectedDevice} onChanged={onChanged} onDeleted={onDeleted} />
            </div>
          </>
        )
      ) : (
        <>
          <Strip label={VIEW_LABEL[view]} />
          <div className="h-[calc(100%-41px)]">
            {view === "netdata" ? (
              <NetworkAnalyzer devices={devices} />
            ) : view === "topology" ? (
              <TopologyView devices={devices} logs={logs} onFocusDevice={onFocusDevice} />
            ) : view === "directory" ? (
              <DirectoryView />
            ) : view === "commits" ? (
              <CommitsView commits={commits} onChanged={onChanged} onFocusDevice={onFocusDevice} />
            ) : (
              <LabBuilder onCreated={onCreated} homelabId={homelabId} />
            )}
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
