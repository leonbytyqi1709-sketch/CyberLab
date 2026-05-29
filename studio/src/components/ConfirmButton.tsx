import { useState } from "react";
import { CheckIcon, XIcon } from "./icons";

interface ConfirmButtonProps {
  onConfirm: () => void;
  label: React.ReactNode;
  confirmLabel?: string;
  /** Akzentfarbe der Aktion (Hex), default Rot/Pink. */
  hex?: string;
  className?: string;
}

/**
 * Zweistufiger Aktions-Button: Erster Klick „scharf schalten", dann ✓/✕.
 * Vermeidet versehentliches Löschen ohne ein modales window.confirm.
 */
export default function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = "Sicher?",
  hex = "#FF4D6D",
  className = "",
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-studio-border px-2.5 py-1.5 text-xs text-studio-muted transition-colors hover:border-[color:var(--c)] hover:text-[color:var(--c)] ${className}`}
        style={{ ["--c" as string]: hex }}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-xs"
      style={{ borderColor: `${hex}55`, color: hex, backgroundColor: `${hex}12` }}
    >
      <span className="px-1">{confirmLabel}</span>
      <button
        type="button"
        title="Bestätigen"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        className="rounded p-1 transition-colors hover:bg-white/10"
        style={{ color: hex }}
      >
        <CheckIcon />
      </button>
      <button
        type="button"
        title="Abbrechen"
        onClick={() => setArmed(false)}
        className="rounded p-1 text-studio-muted transition-colors hover:bg-white/10 hover:text-studio-text"
      >
        <XIcon />
      </button>
    </span>
  );
}
