import { useEffect, useRef, useState } from "react";
import { api, type DeviceType } from "../lib/api";
import { CATALOG, CATEGORIES, type CatalogItem } from "../data/catalog";

interface LabBuilderProps {
  /** Wird nach erfolgreichem Anlegen aufgerufen → App lädt Geräteliste neu. */
  onCreated: () => void;
  /** Ziel-Infrastruktur (Tab), in der das Gerät angelegt wird. */
  homelabId: string;
}

/** Die "leere Werkbank": Hardware-Katalog zum Provisionieren neuer Geräte. */
export default function LabBuilder({ onCreated, homelabId }: LabBuilderProps) {
  const [selected, setSelected] = useState<CatalogItem | null>(null);

  return (
    <div className="relative h-full overflow-y-auto">
      {/* Punkt-Raster-Hintergrund */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "radial-gradient(#1e2028 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-8 py-10">
        <header className="mb-8">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-matrix-green">
            <span className="h-1.5 w-1.5 rounded-full bg-matrix-green shadow-[0_0_8px_#00E599]" />
            Lab Builder
          </div>
          <h1 className="text-2xl font-semibold text-studio-text">
            Werkbank · Hardware hinzufügen
          </h1>
          <p className="mt-1 text-sm text-studio-muted">
            Wähle eine Komponente, vergib einen Namen — das Gerät wird
            provisioniert und bootet in deinem Rack.
          </p>
        </header>

        {CATEGORIES.map((cat) => (
          <section key={cat} className="mb-8">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-studio-muted">
              {cat}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {CATALOG.filter((c) => c.category === cat).map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSelected(item)}
                  className="group relative flex flex-col gap-3 rounded-xl border border-studio-border bg-studio-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-cyber-cyan/50 hover:bg-studio-surface-2 hover:shadow-[0_0_24px_-6px_rgba(0,163,255,0.4)]"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-lg border border-studio-border bg-studio-bg ${item.accent} transition-colors`}
                  >
                    <item.Icon />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-studio-text">
                      {item.label}
                    </div>
                    <div className="text-xs text-studio-muted">
                      {item.blurb}
                    </div>
                  </div>
                  <span className="pointer-events-none absolute right-3 top-3 text-studio-muted opacity-0 transition-opacity group-hover:opacity-100">
                    +
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selected && (
        <ProvisionDialog
          item={selected}
          homelabId={homelabId}
          onClose={() => setSelected(null)}
          onCreated={() => {
            setSelected(null);
            onCreated();
          }}
        />
      )}
    </div>
  );
}

/* ── Namens-Dialog → legt das Gerät an ──────────────────────────────── */
function ProvisionDialog({
  item,
  homelabId,
  onClose,
  onCreated,
}: {
  item: CatalogItem;
  homelabId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.createDevice({
        name: trimmed,
        type: item.type as DeviceType,
        homelab_id: homelabId,
        ...(ip.trim() ? { ip: ip.trim() } : {}),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anlegen fehlgeschlagen");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="glow-cyan animate-palette-in relative w-full max-w-md overflow-hidden rounded-xl border border-cyber-cyan/30 bg-studio-surface/95 p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-3">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-lg border border-studio-border bg-studio-bg ${item.accent}`}
          >
            <item.Icon />
          </span>
          <div>
            <div className="text-base font-semibold text-studio-text">
              {item.label}
            </div>
            <div className="text-xs text-studio-muted">{item.blurb}</div>
          </div>
        </div>

        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-studio-muted">
          Gerätename
        </label>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="z.B. Mac-Studio-01"
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-lg border border-studio-border bg-studio-bg px-3 py-2.5 font-mono text-sm text-studio-text placeholder:text-studio-muted focus:border-cyber-cyan/60 focus:outline-none focus:ring-1 focus:ring-cyber-cyan/40"
        />

        <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wider text-studio-muted">
          IP-Adresse{" "}
          <span className="lowercase tracking-normal text-studio-muted/70">
            (optional)
          </span>
        </label>
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="z.B. 192.168.1.10"
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          inputMode="decimal"
          className="w-full rounded-lg border border-studio-border bg-studio-bg px-3 py-2.5 font-mono text-sm text-studio-text placeholder:text-studio-muted focus:border-cyber-cyan/60 focus:outline-none focus:ring-1 focus:ring-cyber-cyan/40"
        />

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm text-studio-muted transition-colors hover:text-studio-text"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim()}
            className="rounded-lg border border-cyber-cyan/50 bg-cyber-cyan/15 px-4 py-2 text-sm font-medium text-cyber-cyan transition-colors hover:bg-cyber-cyan/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Provisioniere…" : "Provisionieren"}
          </button>
        </div>
      </div>
    </div>
  );
}
