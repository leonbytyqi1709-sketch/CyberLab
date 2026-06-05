import { useEffect } from "react";

/**
 * Globaler Tastatur-Listener für die Kommandoplatte.
 *
 * - Öffnen:  STRG + /  (Windows/Linux)  bzw.  CMD + K  (macOS)
 * - Schließen: ESC
 *
 * Bewusst auf window-Ebene registriert, damit die Platte aus jedem
 * Bereich der IDE heraus erreichbar ist.
 */
export function useCommandPaletteHotkeys(opts: {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Nur im aktiven Tab reagieren (sonst feuern alle gemounteten Workspaces). */
  enabled?: boolean;
}) {
  const { isOpen, open, close, enabled = true } = opts;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Öffnen: Strg+/  oder  Cmd+K
      const isToggle =
        (mod && e.key === "/") || (mod && e.key.toLowerCase() === "k");

      if (isToggle) {
        e.preventDefault();
        isOpen ? close() : open();
        return;
      }

      // Schließen mit ESC
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, open, close, enabled]);
}
