import { useState } from "react";
import { api, type Device } from "../lib/api";
import { PencilIcon, CheckIcon, XIcon, TrashIcon } from "./icons";
import ConfirmButton from "./ConfirmButton";

interface DeviceHeaderActionsProps {
  device: Device;
  onChanged: () => void;
  onDeleted: () => void;
}

/** IP-Anzeige mit Inline-Editor + „Entfernen"-Button für die Geräte-Header. */
export default function DeviceHeaderActions({
  device,
  onChanged,
  onDeleted,
}: DeviceHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <IpEditor device={device} onChanged={onChanged} />
      <ConfirmButton
        onConfirm={async () => {
          try {
            await api.deleteDevice(device.id);
            onDeleted();
          } catch {
            /* nächster Poll korrigiert den Zustand */
          }
        }}
        label={
          <>
            <TrashIcon />
            Entfernen
          </>
        }
        confirmLabel="Gerät löschen?"
      />
    </div>
  );
}

function IpEditor({
  device,
  onChanged,
}: {
  device: Device;
  onChanged: () => void;
}) {
  const current = device.details?.ip ?? "";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateDevice(device.id, { ip: value.trim() });
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(current);
          setError(null);
          setEditing(true);
        }}
        title="IP-Adresse bearbeiten"
        className="group inline-flex items-center gap-1.5 rounded-lg border border-studio-border px-2.5 py-1.5 font-mono text-xs text-studio-text/90 transition-colors hover:border-cyber-cyan/50"
      >
        <span className="text-[10px] uppercase tracking-wider text-studio-muted">
          IP
        </span>
        <span className={current ? "" : "text-studio-muted"}>
          {current || "zuweisen"}
        </span>
        <PencilIcon className="text-studio-muted transition-colors group-hover:text-cyber-cyan" />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-cyber-cyan/40 bg-studio-bg px-1.5 py-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="192.168.1.10"
        spellCheck={false}
        className="w-28 bg-transparent font-mono text-xs text-studio-text placeholder:text-studio-muted focus:outline-none"
      />
      <button
        type="button"
        title="Speichern"
        onClick={save}
        disabled={busy}
        className="rounded p-1 text-matrix-green transition-colors hover:bg-white/10"
      >
        <CheckIcon />
      </button>
      <button
        type="button"
        title="Abbrechen"
        onClick={() => setEditing(false)}
        className="rounded p-1 text-studio-muted transition-colors hover:bg-white/10 hover:text-studio-text"
      >
        <XIcon />
      </button>
      {error && (
        <span className="ml-1 max-w-[140px] truncate text-[10px] text-red-400" title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
