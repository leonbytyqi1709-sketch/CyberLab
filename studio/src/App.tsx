import { useCallback, useEffect, useRef, useState } from "react";
import ActivityBar from "./components/ActivityBar";
import DeviceExplorer from "./components/DeviceExplorer";
import MainPanel from "./components/MainPanel";
import BottomPanel, { type BottomTab } from "./components/BottomPanel";
import CommandPalette from "./components/CommandPalette";
import { useCommandPaletteHotkeys } from "./hooks/useHotkeys";
import { api, type Device, type LogRow } from "./lib/api";

/**
 * CyberLab Studio — IDE-Shell.
 *
 * Zentrale Datenhaltung: App lädt die Geräteliste und pollt sie, damit der
 * Statuswechsel BOOTING → ONLINE (nach 5 s) live in Explorer & Detail erscheint.
 */
export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);

  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [bottomTab, setBottomTab] = useState<BottomTab>("logs");
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useCommandPaletteHotkeys({
    isOpen: paletteOpen,
    open: openPalette,
    close: closePalette,
  });

  const refresh = useCallback(async () => {
    try {
      const [devs, logRows] = await Promise.all([
        api.listDevices(),
        api.listLogs(),
      ]);
      setDevices(devs);
      setLogs(logRows);
    } catch {
      /* Backend evtl. noch nicht bereit — nächster Poll versucht es erneut. */
    }
  }, []);

  // Adaptives Polling: schnell solange ein Gerät bootet, sonst entspannt.
  const anyBooting = devices.some((d) => d.status === "BOOTING");
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    void refreshRef.current();
    const interval = anyBooting ? 1200 : 3000;
    const id = window.setInterval(() => void refreshRef.current(), interval);
    return () => window.clearInterval(id);
  }, [anyBooting]);

  const selectedDevice =
    devices.find((d) => d.id === selectedId) ?? null;

  const handleDeleted = useCallback(() => {
    setSelectedId(null);
    void refresh();
  }, [refresh]);

  const handleClearAll = useCallback(async () => {
    try {
      await api.clearDevices();
    } finally {
      setSelectedId(null);
      void refresh();
    }
  }, [refresh]);

  // Befehl ins Terminal einspeisen (z.B. vom Nmap-Button): Panel öffnen,
  // Terminal-Tab aktivieren, Befehl zur Ausführung übergeben.
  const runTerminalCommand = useCallback((cmd: string) => {
    setTerminalOpen(true);
    setBottomTab("terminal");
    setPendingCommand(cmd);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-studio-bg text-studio-text">
      <ActivityBar />

      <DeviceExplorer
        devices={devices}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onClearAll={handleClearAll}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <MainPanel
          selectedDevice={selectedDevice}
          onCreated={refresh}
          onChanged={refresh}
          onDeleted={handleDeleted}
          onRunCommand={runTerminalCommand}
        />
        <BottomPanel
          isOpen={terminalOpen}
          onToggle={() => setTerminalOpen((v) => !v)}
          tab={bottomTab}
          onTabChange={setBottomTab}
          logs={logs}
          onSelectDevice={setSelectedId}
          device={selectedDevice}
          onChanged={refresh}
          pendingCommand={pendingCommand}
          onConsumed={() => setPendingCommand(null)}
        />
      </div>

      <CommandPalette isOpen={paletteOpen} onClose={closePalette} />
    </div>
  );
}
