import { useState } from "react";
import { DirectoryIcon, FolderIcon, UserIcon, ShieldIcon, ChevronIcon, PlusIcon, XIcon } from "./icons";

interface OU {
  name: string;
  users: string[];
}

const SEED_OUS: OU[] = [
  { name: "Management", users: ["Administrator", "leon.admin"] },
  { name: "IT-Abteilung", users: ["svc-backup", "m.mueller", "j.schmidt"] },
  { name: "Clients", users: ["buero-pc-01$", "buero-pc-02$", "notebook-leon$"] },
];

const SEED_GPOS = [
  "Default Domain Policy",
  "Passwort-Richtlinie (14 Zeichen, 90 Tage)",
  "USB-Massenspeicher sperren",
  "BitLocker erzwingen",
  "RDP nur für Admins",
];

/** Visueller Active-Directory- / LDAP-Baum mit OUs, Usern und GPOs. */
export default function DirectoryView() {
  const [ous, setOus] = useState<OU[]>(SEED_OUS);
  const [open, setOpen] = useState<Record<string, boolean>>({
    domain: true,
    gpo: true,
    Management: true,
    "IT-Abteilung": true,
    Clients: true,
  });
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const addUser = (ou: string) => {
    const name = draft.trim();
    if (!name) return;
    setOus((prev) => prev.map((o) => (o.name === ou ? { ...o, users: [...o.users, name] } : o)));
    setDraft("");
    setAdding(null);
  };
  const removeUser = (ou: string, user: string) =>
    setOus((prev) => prev.map((o) => (o.name === ou ? { ...o, users: o.users.filter((u) => u !== user) } : o)));

  const totalUsers = ous.reduce((s, o) => s + o.users.length, 0);

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-cyber-cyan shadow-[0_0_8px_#00A3FF]" />
            Active Directory / LDAP
          </div>
          <h1 className="text-xl font-semibold text-studio-text">
            Verzeichnisdienst · {ous.length} OUs · {totalUsers} Objekte
          </h1>
        </header>

        <div className="ambient-blue rounded-xl border border-[#00A3FF]/20 bg-studio-surface p-4 font-mono text-[13px]">
          {/* Domain */}
          <TreeRow icon={<DirectoryIcon width={16} height={16} />} open={open.domain} onToggle={() => toggle("domain")} accent="#00E599">
            <span className="text-matrix-green">DC=cyberlab,DC=local</span>
          </TreeRow>

          {open.domain && (
            <div className="ml-4 border-l border-studio-border pl-3">
              {/* OUs */}
              {ous.map((ou) => (
                <div key={ou.name}>
                  <TreeRow icon={<FolderIcon />} open={open[ou.name]} onToggle={() => toggle(ou.name)} accent="#00A3FF">
                    <span className="text-cyber-cyan">OU={ou.name}</span>
                    <span className="ml-2 text-[10px] text-studio-muted">({ou.users.length})</span>
                    <button
                      type="button"
                      title="User hinzufügen"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdding(ou.name);
                        setDraft("");
                        setOpen((o) => ({ ...o, [ou.name]: true }));
                      }}
                      className="ml-2 rounded p-0.5 text-studio-muted transition-colors hover:text-cyber-cyan"
                    >
                      <PlusIcon width={13} height={13} />
                    </button>
                  </TreeRow>

                  {open[ou.name] && (
                    <div className="ml-4 border-l border-studio-border pl-3">
                      {ou.users.map((u) => (
                        <div key={u} className="group flex items-center gap-2 py-0.5 text-studio-text/85">
                          <span className="text-studio-muted">
                            <UserIcon />
                          </span>
                          <span>CN={u}</span>
                          <button
                            type="button"
                            onClick={() => removeUser(ou.name, u)}
                            className="rounded p-0.5 text-studio-muted opacity-0 transition-all hover:text-[#FF4D6D] group-hover:opacity-100"
                            title="Objekt löschen"
                          >
                            <XIcon width={11} height={11} />
                          </button>
                        </div>
                      ))}
                      {adding === ou.name && (
                        <div className="flex items-center gap-2 py-1">
                          <span className="text-cyber-cyan">CN=</span>
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addUser(ou.name);
                              if (e.key === "Escape") setAdding(null);
                            }}
                            placeholder="neuer.user"
                            className="w-40 rounded border border-cyber-cyan/40 bg-studio-bg px-2 py-0.5 text-studio-text focus:outline-none"
                          />
                          <button onClick={() => addUser(ou.name)} className="text-matrix-green hover:underline">
                            anlegen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* GPOs */}
              <TreeRow icon={<ShieldIcon />} open={open.gpo} onToggle={() => toggle("gpo")} accent="#F5A623">
                <span style={{ color: "#F5A623" }}>CN=Group Policy Objects</span>
                <span className="ml-2 text-[10px] text-studio-muted">({SEED_GPOS.length})</span>
              </TreeRow>
              {open.gpo && (
                <div className="ml-4 border-l border-studio-border pl-3">
                  {SEED_GPOS.map((g) => (
                    <div key={g} className="flex items-center gap-2 py-0.5 text-studio-text/85">
                      <span style={{ color: "#F5A623" }}>
                        <ShieldIcon />
                      </span>
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeRow({
  icon,
  open,
  onToggle,
  accent,
  children,
}: {
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onToggle}
      className="flex cursor-pointer items-center gap-1.5 py-1 transition-colors hover:bg-studio-surface-2"
    >
      <ChevronIcon width={13} height={13} className={`text-studio-muted transition-transform ${open ? "" : "-rotate-90"}`} />
      <span style={{ color: accent }}>{icon}</span>
      {children}
    </div>
  );
}
