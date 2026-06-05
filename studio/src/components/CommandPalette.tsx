import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "./icons";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  /** Führt `git revert <hash>` aus und liefert eine Rückmeldung. */
  onRevert: (hash: string) => Promise<{ ok: boolean; message: string }>;
}

interface Command {
  id: string;
  label: string;
  hint: string;
}

const COMMANDS: Command[] = [
  { id: "git.revert", label: "git revert <hash>", hint: "Rollback" },
  { id: "lab.new", label: "Neues Lab-Gerät bauen", hint: "Lab" },
  { id: "topology.open", label: "Network Topology öffnen", hint: "Ansicht" },
  { id: "commits.open", label: "Lab Commits öffnen", hint: "Git" },
];

/** Die glühende Kommandoplatte — inkl. ausführbarem `git revert <hash>`. */
export default function CommandPalette({ isOpen, onClose, onRevert }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setFeedback(null);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [isOpen]);

  // `git revert <hash>` erkennen
  const revertHash = useMemo(() => {
    const m = query.trim().match(/^git\s+revert\s+([0-9a-f]{4,12})$/i);
    return m ? m[1].toLowerCase() : null;
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q.split(" ")[0]));
  }, [query]);

  const runRevert = async () => {
    if (!revertHash || busy) return;
    setBusy(true);
    setFeedback(null);
    const res = await onRevert(revertHash);
    setFeedback(res);
    setBusy(false);
    if (res.ok) setQuery("");
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kommandoplatte"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="glow-cyan animate-palette-in relative w-full max-w-xl overflow-hidden rounded-xl border border-cyber-cyan/30 bg-studio-surface/95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-studio-border px-4 py-3.5">
          <SearchIcon className="shrink-0 text-cyber-cyan text-glow-cyan" />
          <span className="select-none font-mono text-base font-semibold text-matrix-green">
            {">"}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && revertHash) runRevert();
            }}
            placeholder="Befehl … z.B. git revert a1b2c3d"
            className="flex-1 bg-transparent font-mono text-base text-studio-text placeholder:text-studio-muted focus:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="rounded border border-studio-border bg-studio-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-studio-muted">
            ESC
          </kbd>
        </div>

        {/* aktiver git-revert-Treffer */}
        {revertHash && (
          <button
            type="button"
            onClick={runRevert}
            disabled={busy}
            className="flex w-full items-center gap-3 border-b border-studio-border bg-[#b66bff]/10 px-4 py-3 text-left transition-colors hover:bg-[#b66bff]/20"
          >
            <span className="font-mono text-xs text-[#b66bff]">⟲</span>
            <span className="flex-1 text-sm text-studio-text">
              {busy ? "Rollback läuft…" : `Rollback auf Commit `}
              <code className="font-mono text-[#b66bff]">{revertHash}</code>
            </span>
            <span className="rounded bg-studio-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-studio-muted">
              Enter
            </span>
          </button>
        )}

        {feedback && (
          <div
            className="px-4 py-2.5 text-sm"
            style={{ color: feedback.ok ? "#00E599" : "#FF4D6D" }}
          >
            {feedback.message}
          </div>
        )}

        {/* Vorschläge */}
        {!revertHash && (
          <ul className="max-h-72 overflow-y-auto py-2">
            {results.map((c, i) => (
              <li key={c.id}>
                <div
                  className={`flex w-full items-center gap-3 px-4 py-2.5 ${i === 0 ? "bg-cyber-cyan/5" : ""}`}
                >
                  <span className="font-mono text-xs text-studio-muted">›</span>
                  <span className="flex-1 text-sm text-studio-text">{c.label}</span>
                  <span className="rounded bg-studio-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-studio-muted">
                    {c.hint}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
