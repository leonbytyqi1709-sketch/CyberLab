import { useState } from "react";
import { api, type Device } from "../lib/api";
import { TrashIcon } from "./icons";

interface DnsManagerProps {
  device: Device;
  onChanged: () => void;
}

/** DNS-/AD-Zentrum auf Netzwerk-Geräten (pfSense): Hostname → IP-Tabelle. */
export default function DnsManager({ device, onChanged }: DnsManagerProps) {
  const records = device.details?.dns_records ?? [];
  const [hostname, setHostname] = useState("");
  const [ip, setIp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.addDns(device.id, hostname.trim().toLowerCase(), ip.trim());
      setHostname("");
      setIp("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (h: string) => {
    try {
      await api.removeDns(device.id, h);
      onChanged();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-4">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-cyber-cyan shadow-[0_0_8px_#00A3FF]" />
            DNS-Manager · {device.name}
          </div>
          <h2 className="text-lg font-semibold text-studio-text">
            Namensauflösung (A-Records)
          </h2>
          <p className="mt-1 text-sm text-studio-muted">
            Trägst du ein neues Gerät hier nicht ein, schlagen{" "}
            <code className="text-matrix-green">ping &lt;hostname&gt;</code> von
            anderen Servern mit „Host nicht gefunden" fehl.
          </p>
        </header>

        {/* Eintrag hinzufügen */}
        <div className="ambient-blue mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-[#00A3FF]/20 bg-studio-surface p-4">
          <Field label="Hostname" value={hostname} onChange={setHostname} placeholder="proxmox-01" />
          <Field label="IP-Adresse" value={ip} onChange={setIp} placeholder="192.168.1.20" onEnter={add} />
          <button
            type="button"
            onClick={add}
            disabled={busy || !hostname.trim() || !ip.trim()}
            className="rounded-lg border border-cyber-cyan/50 bg-cyber-cyan/15 px-4 py-2 text-sm font-medium text-cyber-cyan transition-colors hover:bg-cyber-cyan/25 disabled:opacity-40"
          >
            Eintrag anlegen
          </button>
          {error && <span className="w-full text-xs text-red-400">{error}</span>}
        </div>

        {/* Tabelle */}
        <div className="overflow-hidden rounded-xl border border-[#00A3FF]/20 font-mono text-[13px]">
          <div className="grid grid-cols-[1fr_180px_56px] gap-3 border-b border-studio-border bg-studio-surface-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-studio-muted">
            <span>Hostname</span>
            <span>IP-Adresse</span>
            <span></span>
          </div>
          {records.length === 0 ? (
            <p className="px-4 py-6 text-sm text-studio-muted">
              Noch keine DNS-Einträge.
            </p>
          ) : (
            records.map((r) => (
              <div
                key={r.hostname}
                className="grid grid-cols-[1fr_180px_56px] items-center gap-3 border-b border-studio-border/60 bg-studio-surface px-4 py-2"
              >
                <span className="text-studio-text">{r.hostname}</span>
                <span className="text-cyber-cyan">{r.ip}</span>
                <button
                  type="button"
                  onClick={() => remove(r.hostname)}
                  title="Eintrag löschen"
                  className="justify-self-end p-1 text-studio-muted transition-colors hover:text-[#FF4D6D]"
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter?: () => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-studio-muted">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="w-44 rounded-lg border border-studio-border bg-studio-bg px-3 py-2 font-mono text-sm text-studio-text placeholder:text-studio-muted focus:border-cyber-cyan/60 focus:outline-none"
      />
    </label>
  );
}
