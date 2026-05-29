import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "./icons";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  label: string;
  hint: string;
}

/* Platzhalter-Befehle — die eigentliche Aktionslogik folgt später. */
const COMMANDS: Command[] = [
  { id: "lab.new", label: "Neues Lab erstellen", hint: "Lab" },
  { id: "device.add", label: "Gerät hinzufügen…", hint: "Explorer" },
  { id: "topology.open", label: "Topologie anzeigen", hint: "Ansicht" },
  { id: "terminal.toggle", label: "Terminal umschalten", hint: "Ansicht" },
  { id: "sim.start", label: "Simulation starten", hint: "Lab" },
  { id: "wiki.open", label: "Wiki durchsuchen", hint: "Wiki" },
];

/** Die glühende Kommandoplatte — zentriertes, schwebendes Modal mit Cyan-Glow. */
export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // Beim Öffnen: Eingabe leeren und fokussieren
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      // kurzes Defer, damit das Element sicher gemountet ist
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kommandoplatte"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
      onMouseDown={onClose}
    >
      {/* halbtransparenter, dunkler Hintergrund */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* schwebendes Modal mit feinem Neon-Glow-Rahmen in Cyan */}
      <div
        className="glow-cyan animate-palette-in relative w-full max-w-xl overflow-hidden rounded-xl border border-cyber-cyan/30 bg-studio-surface/95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Befehlszeile mit „> "-Prompt */}
        <div className="flex items-center gap-3 border-b border-studio-border px-4 py-3.5">
          <SearchIcon className="shrink-0 text-cyber-cyan text-glow-cyan" />
          <span className="select-none font-mono text-base font-semibold text-matrix-green">
            {">"}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Befehl eingeben oder suchen…"
            className="flex-1 bg-transparent font-mono text-base text-studio-text placeholder:text-studio-muted focus:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="rounded border border-studio-border bg-studio-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-studio-muted">
            ESC
          </kbd>
        </div>

        {/* Ergebnis-Liste */}
        <ul className="max-h-72 overflow-y-auto py-2">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-studio-muted">
              Kein Befehl gefunden für „{query}"
            </li>
          ) : (
            results.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-cyber-cyan/10 ${
                    i === 0 ? "bg-cyber-cyan/5" : ""
                  }`}
                >
                  <span className="font-mono text-xs text-studio-muted group-hover:text-cyber-cyan">
                    ›
                  </span>
                  <span className="flex-1 text-sm text-studio-text">
                    {c.label}
                  </span>
                  <span className="rounded bg-studio-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-studio-muted">
                    {c.hint}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
