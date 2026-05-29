import { useState } from "react";
import { DashboardIcon, LabIcon, WikiIcon } from "./icons";

type View = "dashboard" | "lab" | "wiki";

interface ActivityItem {
  id: View;
  label: string;
  Icon: typeof DashboardIcon;
}

const ITEMS: ActivityItem[] = [
  { id: "dashboard", label: "Dashboard", Icon: DashboardIcon },
  { id: "lab", label: "Lab Builder", Icon: LabIcon },
  { id: "wiki", label: "Wiki", Icon: WikiIcon },
];

/** Schmale, vertikale Icon-Leiste ganz links — der Haupt-Navigator der IDE. */
export default function ActivityBar() {
  const [active, setActive] = useState<View>("dashboard");

  return (
    <nav className="flex w-14 flex-col items-center border-r border-studio-border bg-studio-surface py-3">
      <div className="flex flex-col items-center gap-1">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-current={isActive}
              onClick={() => setActive(id)}
              className={`group relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? "text-cyber-cyan"
                  : "text-studio-muted hover:text-studio-text"
              }`}
            >
              {/* aktiver Indikator-Balken links */}
              <span
                className={`absolute left-0 h-5 w-0.5 rounded-full bg-cyber-cyan transition-all ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <Icon className={isActive ? "text-glow-cyan" : ""} />
            </button>
          );
        })}
      </div>

      {/* dezenter Marken-Punkt am unteren Ende */}
      <div className="mt-auto">
        <span className="block h-2 w-2 rounded-full bg-matrix-green text-glow-green shadow-[0_0_10px_#00E599]" />
      </div>
    </nav>
  );
}
