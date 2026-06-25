import { useState } from "react";
import type { Device } from "../lib/api";
import { CATALOG_BY_TYPE, CATEGORIES, type Category } from "../data/catalog";
import { STATUS_META } from "./statusMeta";
import { SpinnerIcon, TrashIcon, UnknownIcon, CheckIcon, XIcon } from "./icons";
import ConfirmButton from "./ConfirmButton";

interface DeviceExplorerProps {
  devices: Device[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClearAll: () => void;
  onDeleteDevice: (id: string) => void;
}

/** Sidebar „Geräte-Explorer" — listet die Hardware live aus der DB. */
export default function DeviceExplorer({
  devices,
  selectedId,
  onSelect,
  onClearAll,
  onDeleteDevice,
}: DeviceExplorerProps) {
  // Geräte nach Katalog-Kategorie gruppieren.
  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, [] as Device[]]),
  ) as Record<Category, Device[]>;
  for (const dev of devices) {
    const cat = CATALOG_BY_TYPE[dev.type]?.category ?? "Compute";
    byCategory[cat].push(dev);
  }

  return (
    <aside className="flex w-64 flex-col border-r border-[#00A3FF]/20 bg-studio-surface">
      <div className="ambient-blue flex items-center justify-between border-b border-[#00A3FF]/20 px-4 py-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          title="Zur Werkbank (Lab Builder)"
          className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyber-cyan/80 transition-colors hover:text-cyber-cyan"
        >
          Geräte-Explorer
        </button>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-studio-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-cyber-cyan">
            {devices.length}
          </span>
          {devices.length > 0 && (
            <ConfirmButton
              onConfirm={onClearAll}
              label={<TrashIcon />}
              confirmLabel="Rack leeren?"
              className="!px-1.5"
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {devices.length === 0 ? (
          <p className="px-4 py-6 text-xs leading-relaxed text-studio-muted">
            Noch keine Geräte. Wähle im{" "}
            <span className="text-matrix-green">Lab Builder</span> eine
            Komponente, um dein Rack zu bestücken.
          </p>
        ) : (
          CATEGORIES.map((cat) =>
            byCategory[cat].length === 0 ? null : (
              <section key={cat} className="mb-1">
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-studio-muted/80">
                  {cat}
                </div>
                <ul>
                  {byCategory[cat].map((dev) => (
                    <DeviceRow
                      key={dev.id}
                      device={dev}
                      active={dev.id === selectedId}
                      onClick={() => onSelect(dev.id)}
                      onDelete={() => onDeleteDevice(dev.id)}
                    />
                  ))}
                </ul>
              </section>
            ),
          )
        )}
      </div>

      <div className="border-t border-studio-border px-4 py-2.5 text-[11px] text-studio-muted">
        <kbd className="rounded border border-studio-border bg-studio-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-studio-text">
          Strg
        </kbd>
        <span className="mx-1">+</span>
        <kbd className="rounded border border-studio-border bg-studio-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-studio-text">
          /
        </kbd>
        <span className="ml-2">Kommandoplatte</span>
      </div>
    </aside>
  );
}

function DeviceRow({
  device,
  active,
  onClick,
  onDelete,
}: {
  device: Device;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const meta = CATALOG_BY_TYPE[device.type];
  const status = STATUS_META[device.status];
  const isBooting = device.status === "BOOTING";
  // Vor dem nmap-Scan generisches "Unknown Device"-Icon statt OS-Icon.
  const unscanned = device.status === "ONLINE" && !device.details?.scanned;
  const Icon = unscanned ? UnknownIcon : meta?.Icon;
  const [armed, setArmed] = useState(false);

  return (
    <li className="group relative" onMouseLeave={() => setArmed(false)}>
      <button
        type="button"
        onClick={onClick}
        className={`relative flex w-full items-center gap-2.5 px-4 py-1.5 pr-8 text-left text-sm transition-colors ${
          active
            ? "bg-cyber-cyan/10 text-studio-text"
            : "text-studio-text/90 hover:bg-studio-surface-2"
        }`}
      >
        {active && (
          <span className="absolute left-0 h-5 w-0.5 rounded-full bg-cyber-cyan" />
        )}
        {Icon && (
          <Icon
            className="shrink-0 text-studio-muted transition-colors group-hover:text-cyber-cyan"
            width={16}
            height={16}
          />
        )}
        <span
          className="flex-1 truncate"
          style={isBooting ? { color: status.hex } : undefined}
        >
          {device.name}
          {isBooting && (
            <span className="ml-1 text-[10px] uppercase tracking-wide">
              · booting…
            </span>
          )}
          {unscanned && (
            <span className="ml-1 text-[10px] uppercase tracking-wide text-studio-muted">
              · unbekannt
            </span>
          )}
        </span>

        {isBooting ? (
          <SpinnerIcon className="shrink-0 animate-spin" style={{ color: status.hex }} />
        ) : (
          // Status-Punkt — blendet beim Hover aus, damit der Mülleimer Platz hat.
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full transition-opacity group-hover:opacity-0"
            title={device.status}
            style={{
              backgroundColor: status.hex,
              boxShadow:
                device.status === "ONLINE" ? `0 0 8px ${status.hex}` : undefined,
            }}
          />
        )}
      </button>

      {/* Lösch-Affordance rechts (erscheint beim Hovern, mit Bestätigung) */}
      {!isBooting && (
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
          {armed ? (
            <span
              className="flex items-center gap-0.5 rounded-md border px-1 py-0.5"
              style={{ borderColor: "#FF4D6D55", backgroundColor: "#FF4D6D14" }}
            >
              <button
                type="button"
                title="Löschen bestätigen"
                onClick={(e) => {
                  e.stopPropagation();
                  setArmed(false);
                  onDelete();
                }}
                className="rounded p-0.5 text-[#FF4D6D] transition-colors hover:bg-white/10"
              >
                <CheckIcon width={12} height={12} />
              </button>
              <button
                type="button"
                title="Abbrechen"
                onClick={(e) => {
                  e.stopPropagation();
                  setArmed(false);
                }}
                className="rounded p-0.5 text-studio-muted transition-colors hover:bg-white/10 hover:text-studio-text"
              >
                <XIcon width={12} height={12} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              title="Gerät entfernen"
              onClick={(e) => {
                e.stopPropagation();
                setArmed(true);
              }}
              className="rounded p-1 text-studio-muted opacity-0 transition-all hover:text-[#FF4D6D] group-hover:opacity-100"
            >
              <TrashIcon width={13} height={13} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
