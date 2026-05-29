import { useEffect, useRef, useState } from "react";
import { api, type Device, type DeviceMetrics } from "../lib/api";
import DeviceDashboard from "./DeviceDashboard";
import NetdataPanel from "./NetdataPanel";
import DnsManager from "./DnsManager";
import ZfsPanel from "./ZfsPanel";
import DeviceHeaderActions from "./DeviceHeaderActions";
import { SearchIcon } from "./icons";

const WINDOW = 30;
const POLL_MS = 2000;

interface DeviceViewProps {
  device: Device;
  onChanged: () => void;
  onDeleted: () => void;
  onRunCommand: (cmd: string) => void;
}

type Tab = "tasks" | "netdata" | "dns" | "zfs";

/** Geräte-Ansicht: pollt das Gerät alle 2 s, hält die Zeitreihe und schaltet
 *  zwischen Task-Manager und Netdata um. Vor dem nmap-Scan: „Unknown Device". */
export default function DeviceView({
  device,
  onChanged,
  onDeleted,
  onRunCommand,
}: DeviceViewProps) {
  const [live, setLive] = useState<Device>(device);
  const [samples, setSamples] = useState<DeviceMetrics[]>(() => {
    const m = device.details?.metrics;
    return m ? Array.from({ length: WINDOW }, () => m) : [];
  });
  const [tab, setTab] = useState<Tab>("tasks");

  const idRef = useRef(device.id);

  useEffect(() => {
    let alive = true;
    // Bei Gerätewechsel Zustand frisch aufsetzen.
    if (idRef.current !== device.id) {
      idRef.current = device.id;
      setLive(device);
      const m = device.details?.metrics;
      setSamples(m ? Array.from({ length: WINDOW }, () => m) : []);
      setTab("tasks");
    }

    const interval = window.setInterval(async () => {
      try {
        const fresh = await api.getDevice(device.id);
        if (!alive) return;
        setLive(fresh);
        const m = fresh.details?.metrics;
        if (m) setSamples((prev) => [...prev, m].slice(-WINDOW));
      } catch {
        /* nächster Tick */
      }
    }, POLL_MS);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [device.id, device]);

  const scanned = !!live.details?.scanned;
  const isNetwork = live.type === "PFSENSE" || live.type === "MANAGED_SWITCH";
  const isStorage = live.type === "TRUENAS" || live.type === "SYNOLOGY";

  return (
    <div className="flex h-full flex-col">
      {/* Tab-Leiste */}
      <div className="ambient-blue flex items-center gap-1 border-b border-[#00A3FF]/20 px-2">
        {scanned ? (
          <>
            <Tab label="Task-Manager" active={tab === "tasks"} onClick={() => setTab("tasks")} />
            <Tab label="Netdata Metrics" active={tab === "netdata"} onClick={() => setTab("netdata")} />
            {isNetwork && (
              <Tab label="DNS-Manager" active={tab === "dns"} onClick={() => setTab("dns")} />
            )}
            {isStorage && (
              <Tab label="ZFS-Storage" active={tab === "zfs"} onClick={() => setTab("zfs")} />
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-studio-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#F5A623]" />
            {live.name} · unidentifiziert
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {!scanned ? (
          <UnknownDevice device={live} onChanged={onChanged} onDeleted={onDeleted} onRunCommand={onRunCommand} />
        ) : tab === "netdata" ? (
          <NetdataPanel device={live} />
        ) : tab === "dns" && isNetwork ? (
          <DnsManager device={live} onChanged={onChanged} />
        ) : tab === "zfs" && isStorage ? (
          <ZfsPanel device={live} />
        ) : (
          <DeviceDashboard device={live} samples={samples} onChanged={onChanged} onDeleted={onDeleted} />
        )}
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors ${
        active
          ? "border-cyber-cyan text-studio-text"
          : "border-transparent text-studio-muted hover:text-studio-text"
      }`}
    >
      {active && <span className="h-1.5 w-1.5 rounded-full bg-cyber-cyan shadow-[0_0_8px_#00A3FF]" />}
      {label}
    </button>
  );
}

/** „Unknown Device" — sichtbar, bis ein nmap-Scan das Gerät aufdeckt. */
function UnknownDevice({
  device,
  onChanged,
  onDeleted,
  onRunCommand,
}: {
  device: Device;
  onChanged: () => void;
  onDeleted: () => void;
  onRunCommand: (cmd: string) => void;
}) {
  const ip = device.details?.ip;
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-studio-border bg-studio-surface text-3xl text-studio-muted">
        ?
      </div>
      <h1 className="text-xl font-semibold text-studio-text">Unknown Device</h1>
      <p className="mt-1.5 max-w-md text-sm text-studio-muted">
        {device.name} ist online, aber noch nicht identifiziert. Führe einen
        Nmap-Scan aus, um offene Ports, Dienste und das Betriebssystem
        aufzudecken{ip ? ` (${ip})` : ""}.
      </p>

      <button
        type="button"
        onClick={() => onRunCommand(`nmap -sV ${ip ?? ""}`.trim())}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-cyber-cyan/50 bg-cyber-cyan/10 px-4 py-2.5 text-sm font-medium text-cyber-cyan transition-colors hover:bg-cyber-cyan/20"
      >
        <SearchIcon width={16} height={16} />
        [ Run Nmap Scan ]
      </button>

      <div className="mt-8">
        <DeviceHeaderActions device={device} onChanged={onChanged} onDeleted={onDeleted} />
      </div>
    </div>
  );
}
