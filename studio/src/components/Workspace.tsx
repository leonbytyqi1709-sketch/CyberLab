import { useCallback, useEffect, useRef, useState } from "react";
import ActivityBar, { type GlobalView } from "./ActivityBar";
import DeviceExplorer from "./DeviceExplorer";
import MainPanel from "./MainPanel";
import BottomPanel, { type BottomTab } from "./BottomPanel";
import CommandPalette from "./CommandPalette";
import { useCommandPaletteHotkeys } from "../hooks/useHotkeys";
import { useStorageAlerts } from "../hooks/useStorageAlerts";
import { api, type Device, type LogRow, type LabCommit } from "../lib/api";

interface WorkspaceProps {
  homelabId: string;
  isActive: boolean;
}

/**
 * Eine vollständig isolierte Infrastruktur (= ein Tab). Hält eigenen State,
 * eigenes Polling, eigene Graphen/Terminals. Inaktive Workspaces bleiben
 * gemountet (vom Parent via display:none versteckt) → State bleibt erhalten,
 * Live-Graphen resetten beim Tab-Wechsel nicht.
 */
export default function Workspace({ homelabId, isActive }: WorkspaceProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);

  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [commits, setCommits] = useState<LabCommit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<GlobalView>("netdata");

  const [bottomTab, setBottomTab] = useState<BottomTab>("logs");
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Hotkey nur im aktiven Tab, sonst würden alle Workspaces feuern.
  useCommandPaletteHotkeys({
    isOpen: paletteOpen,
    open: openPalette,
    close: closePalette,
    enabled: isActive,
  });

  const refresh = useCallback(async () => {
    try {
      const [devs, logRows, commitRows] = await Promise.all([
        api.listDevices(homelabId),
        api.listLogs(homelabId),
        api.listCommits(homelabId),
      ]);
      setDevices(devs);
      setLogs(logRows);
      setCommits(commitRows);
    } catch {
      /* nächster Poll versucht es erneut */
    }
  }, [homelabId]);

  // Adaptives Polling: aktiv & bootend schnell, inaktiv (Hintergrund) langsamer.
  const anyBooting = devices.some((d) => d.status === "BOOTING");
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    void refreshRef.current();
    const interval = !isActive ? 5000 : anyBooting ? 1200 : 2500;
    const id = window.setInterval(() => void refreshRef.current(), interval);
    return () => window.clearInterval(id);
  }, [anyBooting, isActive]);

  // Akustische/Desktop-Alarme für ZFS-Ereignisse (nur aktiver Tab).
  useStorageAlerts(devices, logs, isActive);

  const selectedDevice = devices.find((d) => d.id === selectedId) ?? null;

  const handleDeleted = useCallback(() => {
    setSelectedId(null);
    void refresh();
  }, [refresh]);

  const handleClearAll = useCallback(async () => {
    try {
      await api.clearDevices(homelabId);
    } finally {
      setSelectedId(null);
      void refresh();
    }
  }, [refresh, homelabId]);

  const runTerminalCommand = useCallback((cmd: string) => {
    setTerminalOpen(true);
    setBottomTab("terminal");
    setPendingCommand(cmd);
  }, []);

  const selectView = useCallback((v: GlobalView) => {
    setView(v);
    setSelectedId(null);
  }, []);

  const focusDevice = useCallback((id: string) => setSelectedId(id), []);

  const handleRevert = useCallback(
    async (hash: string): Promise<{ ok: boolean; message: string }> => {
      try {
        const r = await api.revertCommit(hash);
        await refresh();
        if (r.ok && r.device_id) setSelectedId(r.device_id);
        return {
          ok: !!r.ok,
          message: r.ok
            ? `✓ ${r.device_name ?? "Gerät"} auf Commit ${hash} zurückgesetzt — Fehler gelöscht.`
            : r.error ?? "Revert fehlgeschlagen.",
        };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : "Revert fehlgeschlagen." };
      }
    },
    [refresh],
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-studio-bg text-studio-text">
      <ActivityBar view={view} onSelect={selectView} />

      <DeviceExplorer
        devices={devices}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onClearAll={handleClearAll}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <MainPanel
          selectedDevice={selectedDevice}
          view={view}
          homelabId={homelabId}
          devices={devices}
          logs={logs}
          commits={commits}
          onCreated={refresh}
          onChanged={refresh}
          onDeleted={handleDeleted}
          onRunCommand={runTerminalCommand}
          onFocusDevice={focusDevice}
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

      <CommandPalette isOpen={paletteOpen} onClose={closePalette} onRevert={handleRevert} />
    </div>
  );
}
