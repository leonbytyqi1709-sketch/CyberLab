import { create } from "zustand";
import { api, type Homelab } from "../lib/api";

/**
 * Globale Tab-Verwaltung (Infrastruktur-Tabs = HomeLabs).
 * Hält nur die Tab-Liste & den aktiven Tab. Der eigentliche Live-Zustand
 * (Geräte, Metriken, Graphen, Terminal) lebt isoliert in jedem gemounteten
 * <Workspace> und bleibt beim Wechsel erhalten (display:none statt unmount).
 */
interface TabsState {
  tabs: Homelab[];
  activeId: string | null;
  loaded: boolean;
  init: () => Promise<void>;
  reconcile: () => Promise<void>;
  setActive: (id: string) => void;
  addTab: () => Promise<void>;
  closeTab: (id: string) => Promise<void>;
  renameTab: (id: string, name: string) => Promise<void>;
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,
  loaded: false,

  init: async () => {
    try {
      const tabs = await api.listHomelabs();
      set({ tabs, activeId: tabs[0]?.id ?? null, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  // Periodischer Abgleich mit dem Backend: entfernt verschwundene HomeLabs
  // (Geister-Tabs), übernimmt neue, und repariert den aktiven Tab.
  reconcile: async () => {
    try {
      const fresh = await api.listHomelabs();
      const ids = new Set(fresh.map((h) => h.id));
      set((s) => {
        const sameSet =
          s.tabs.length === fresh.length && s.tabs.every((t) => ids.has(t.id));
        if (sameSet) return s; // nichts geändert
        const activeId =
          s.activeId && ids.has(s.activeId) ? s.activeId : (fresh[0]?.id ?? null);
        return { tabs: fresh, activeId };
      });
    } catch {
      /* offline → Tabs unverändert lassen */
    }
  },

  setActive: (id) => set({ activeId: id }),

  addTab: async () => {
    const t = await api.createHomelab(`Infra ${get().tabs.length + 1}`);
    set((s) => ({ tabs: [...s.tabs, t], activeId: t.id }));
  },

  closeTab: async (id) => {
    if (get().tabs.length <= 1) return; // letztes Tab bleibt bestehen
    try {
      await api.deleteHomelab(id);
    } catch {
      /* trotzdem aus der UI entfernen */
    }
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeId = s.activeId === id ? (tabs[0]?.id ?? null) : s.activeId;
      return { tabs, activeId };
    });
  },

  renameTab: async (id, name) => {
    try {
      const t = await api.renameHomelab(id, name);
      set((s) => ({ tabs: s.tabs.map((x) => (x.id === id ? t : x)) }));
    } catch {
      /* ignore */
    }
  },
}));
