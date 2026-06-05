import { useEffect, useState } from "react";
import { useTabs } from "./store/tabs";
import TabBar from "./components/TabBar";
import Workspace from "./components/Workspace";
import LoginScreen from "./components/LoginScreen";

/**
 * CyberLab Studio — App-Shell mit Multi-Infrastruktur-Tabs.
 *
 * Globale Tab-Verwaltung über den Zustand-Store. Alle Tabs (Workspaces)
 * bleiben gleichzeitig gemountet; inaktive werden per display:none versteckt,
 * damit ihr Live-Zustand (Graphen, Terminal, Metriken) erhalten bleibt.
 */
export default function App() {
  const { tabs, activeId, loaded, init, reconcile } = useTabs();
  const [authed, setAuthed] = useState(
    () => localStorage.getItem("cyberlab.auth") === "1",
  );

  useEffect(() => {
    if (!authed) return;
    void init();
    const id = window.setInterval(() => void reconcile(), 8000);
    return () => window.clearInterval(id);
  }, [init, reconcile, authed]);

  const login = (user: string) => {
    localStorage.setItem("cyberlab.auth", "1");
    localStorage.setItem("cyberlab.user", user);
    setAuthed(true);
  };
  const logout = () => {
    localStorage.removeItem("cyberlab.auth");
    setAuthed(false);
  };

  if (!authed) return <LoginScreen onLogin={login} />;

  if (!loaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-studio-bg text-studio-muted">
        <span className="animate-pulse font-mono text-sm text-cyber-cyan">
          CyberLab Studio wird geladen…
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-studio-bg text-studio-text">
      <TabBar onLogout={logout} />
      <div className="relative flex-1 overflow-hidden">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={active ? "absolute inset-0" : "hidden"}
              aria-hidden={!active}
            >
              <Workspace homelabId={t.id} isActive={active} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
