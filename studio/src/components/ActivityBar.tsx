import { LabIcon, AnalyzerIcon, TopologyIcon, GitIcon, DirectoryIcon } from "./icons";

export type GlobalView = "netdata" | "lab" | "topology" | "directory" | "commits";

interface ActivityItem {
  id: GlobalView;
  label: string;
  Icon: typeof LabIcon;
}

const ITEMS: ActivityItem[] = [
  { id: "netdata", label: "Netzwerk-Analysator", Icon: AnalyzerIcon },
  { id: "lab", label: "Lab Builder", Icon: LabIcon },
  { id: "topology", label: "Network Topology", Icon: TopologyIcon },
  { id: "directory", label: "Active Directory / LDAP", Icon: DirectoryIcon },
  { id: "commits", label: "Lab Commits (Git)", Icon: GitIcon },
];

interface ActivityBarProps {
  view: GlobalView;
  onSelect: (v: GlobalView) => void;
}

/** Schmale, vertikale Icon-Leiste — schaltet die globalen Ansichten um. */
export default function ActivityBar({ view, onSelect }: ActivityBarProps) {
  return (
    <nav className="flex w-14 flex-col items-center border-r border-[#00A3FF]/20 bg-studio-surface py-3">
      <div className="flex flex-col items-center gap-1">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = view === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-current={isActive}
              onClick={() => onSelect(id)}
              className={`group relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                isActive ? "text-cyber-cyan" : "text-studio-muted hover:text-studio-text"
              }`}
            >
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

      <div className="mt-auto">
        <span className="block h-2 w-2 rounded-full bg-matrix-green text-glow-green shadow-[0_0_10px_#00E599]" />
      </div>
    </nav>
  );
}
