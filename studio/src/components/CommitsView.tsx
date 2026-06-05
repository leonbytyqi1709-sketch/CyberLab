import { useState } from "react";
import { api, type LabCommit } from "../lib/api";

interface CommitsViewProps {
  commits: LabCommit[];
  onChanged: () => void;
  onFocusDevice: (id: string) => void;
}

const KIND_COLOR: Record<string, string> = {
  boot: "#00E599",
  install: "#00A3FF",
  dns: "#00A3FF",
  apt: "#00A3FF",
  docker: "#00A3FF",
  scan: "#00A3FF",
  systemctl: "#8b93a7",
  kill: "#FF4D6D",
  zfs: "#F5A623",
  revert: "#b66bff",
  change: "#00A3FF",
};

const color = (k: string) => KIND_COLOR[k] ?? "#00A3FF";

/** Git-Style Konfigurations-Historie als glühende, vertikale Timeline. */
export default function CommitsView({ commits, onChanged, onFocusDevice }: CommitsViewProps) {
  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-cyber-cyan shadow-[0_0_8px_#00A3FF]" />
            Lab Commits · {commits.length}
          </div>
          <h1 className="text-2xl font-semibold text-studio-text">
            Konfigurations-Historie
          </h1>
          <p className="mt-1 text-sm text-studio-muted">
            Jede Zustandsänderung erzeugt einen Commit. Rückgängig per{" "}
            <kbd className="rounded border border-studio-border bg-studio-surface-2 px-1.5 py-0.5 font-mono text-[10px]">
              Cmd/Strg+K
            </kbd>{" "}
            →{" "}
            <code className="font-mono text-matrix-green">git revert &lt;hash&gt;</code>
          </p>
        </header>

        {commits.length === 0 ? (
          <p className="text-sm text-studio-muted">
            Noch keine Commits. Baue ein Gerät oder ändere eine Konfiguration.
          </p>
        ) : (
          <ol className="relative ml-3">
            {/* durchgehende Timeline-Linie */}
            <span className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-cyber-cyan/40 via-studio-border to-transparent" />
            {commits.map((c) => (
              <CommitRow
                key={c.hash + c.created_at}
                commit={c}
                onChanged={onChanged}
                onFocusDevice={onFocusDevice}
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function CommitRow({
  commit,
  onChanged,
  onFocusDevice,
}: {
  commit: LabCommit;
  onChanged: () => void;
  onFocusDevice: (id: string) => void;
}) {
  const c = color(commit.kind);
  const [busy, setBusy] = useState(false);

  const revert = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.revertCommit(commit.hash);
      onChanged();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="relative flex gap-4 pb-5 pl-6">
      {/* Git-Knoten */}
      <span
        className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2"
        style={{ borderColor: c, backgroundColor: "#08080A", boxShadow: `0 0 8px ${c}` }}
      />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <code
            className="rounded bg-studio-surface-2 px-1.5 py-0.5 font-mono text-xs"
            style={{ color: c }}
          >
            {commit.hash}
          </code>
          <span className="text-sm text-studio-text">{commit.message}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-studio-muted">
          <span className="font-mono uppercase tracking-wide" style={{ color: c }}>
            {commit.kind}
          </span>
          {commit.device_name && (
            <button
              type="button"
              onClick={() => commit.device_id && onFocusDevice(commit.device_id)}
              className="transition-colors hover:text-cyber-cyan"
            >
              ⟶ {commit.device_name}
            </button>
          )}
          <span>{new Date(commit.created_at).toLocaleTimeString("de-DE")}</span>
          {commit.device_id && commit.kind !== "revert" && (
            <button
              type="button"
              onClick={revert}
              disabled={busy}
              title={`git revert ${commit.hash}`}
              className="rounded border border-studio-border px-1.5 py-0.5 font-mono text-[10px] text-studio-muted transition-colors hover:border-[#b66bff]/60 hover:text-[#b66bff] disabled:opacity-40"
            >
              revert
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
