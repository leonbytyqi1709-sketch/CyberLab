import { useState } from "react";
import { useTabs } from "../store/tabs";
import { PlusIcon, XIcon, LockIcon } from "./icons";

interface TabBarProps {
  onLogout: () => void;
}

/** Browser-artige Tab-Leiste für die parallel simulierten Infrastrukturen. */
export default function TabBar({ onLogout }: TabBarProps) {
  const { tabs, activeId, setActive, addTab, closeTab, renameTab } = useTabs();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <div className="flex items-stretch gap-1 border-b border-[#00A3FF]/25 bg-[#070810] px-2 pt-1.5">
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <div
            key={t.id}
            onClick={() => setActive(t.id)}
            onDoubleClick={() => {
              setEditing(t.id);
              setDraft(t.name);
            }}
            className={`group flex max-w-[200px] cursor-pointer items-center gap-2 rounded-t-lg border-b-2 px-3 py-1.5 text-sm transition-colors ${
              active
                ? "border-cyber-cyan bg-studio-surface text-studio-text"
                : "border-transparent bg-transparent text-studio-muted hover:bg-studio-surface/50 hover:text-studio-text"
            }`}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                backgroundColor: active ? "#00A3FF" : "#3a3e48",
                boxShadow: active ? "0 0 8px #00A3FF" : undefined,
              }}
            />
            {editing === t.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  if (draft.trim()) renameTab(t.id, draft.trim());
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditing(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-28 bg-transparent text-sm text-studio-text focus:outline-none"
              />
            ) : (
              <span className="truncate">{t.name}</span>
            )}
            {tabs.length > 1 && (
              <button
                type="button"
                title="Tab schließen"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
                className={`ml-1 rounded p-0.5 text-studio-muted transition-colors hover:bg-white/10 hover:text-[#FF4D6D] ${
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <XIcon width={12} height={12} />
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        title="Neue Infrastruktur"
        onClick={() => void addTab()}
        className="my-1 flex items-center gap-1 rounded-lg px-2 text-studio-muted transition-colors hover:bg-studio-surface/60 hover:text-cyber-cyan"
      >
        <PlusIcon />
      </button>

      <button
        type="button"
        title="Abmelden / Sperren"
        onClick={onLogout}
        className="my-1 ml-auto mr-1 flex items-center gap-1.5 rounded-lg px-2.5 text-studio-muted transition-colors hover:bg-studio-surface/60 hover:text-[#FF4D6D]"
      >
        <LockIcon />
        <span className="text-xs">Logout</span>
      </button>
    </div>
  );
}
