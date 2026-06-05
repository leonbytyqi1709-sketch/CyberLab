import { useEffect, useRef, useState } from "react";

interface LoginScreenProps {
  onLogin: (user: string) => void;
}

const BOOT = (user: string): { t: string; cls: string; delay: number }[] => [
  { t: "› Initialisiere CyberLab-Kernel…", cls: "text-studio-muted", delay: 0 },
  { t: "› Verbinde mit simulation-engine … OK", cls: "text-cyber-cyan", delay: 320 },
  { t: `› Authentifiziere ${user} … OK`, cls: "text-cyber-cyan", delay: 680 },
  { t: "› Lade Infrastruktur-Tabs … OK", cls: "text-cyber-cyan", delay: 1000 },
  { t: `✓ Zugang gewährt. Willkommen, ${user}.`, cls: "text-matrix-green", delay: 1320 },
];

/** Glühender Neon-Login mit animiertem Raster, Scanline und Boot-Sequenz. */
export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [user, setUser] = useState("admin");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [lines, setLines] = useState<{ t: string; cls: string }[]>([]);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (booting) return;
    if (!user.trim() || !pass.trim()) {
      setError("Benutzername und Passwort erforderlich.");
      return;
    }
    setError(null);
    setBooting(true);
    const seq = BOOT(user.trim());
    seq.forEach((l) =>
      window.setTimeout(() => setLines((prev) => [...prev, { t: l.t, cls: l.cls }]), l.delay),
    );
    window.setTimeout(() => onLogin(user.trim()), seq[seq.length - 1].delay + 620);
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#05060a]">
      {/* animiertes Raster */}
      <div className="login-grid pointer-events-none absolute inset-0 opacity-60" />
      {/* Radiale Glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(680px 460px at 50% 18%, rgba(0,163,255,0.16), transparent 60%), radial-gradient(520px 420px at 80% 100%, rgba(0,229,153,0.08), transparent 55%)",
        }}
      />
      {/* Scanline */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="scanline" />
      </div>
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 220px 40px rgba(0,0,0,0.85)" }}
      />

      {/* Karte */}
      <div className="animate-login-rise glow-cyan relative z-10 w-full max-w-md rounded-2xl border border-cyber-cyan/30 bg-studio-surface/80 p-8 backdrop-blur-md">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyber-cyan/40 bg-studio-bg shadow-[0_0_30px_-6px_rgba(0,163,255,0.6)]">
            <span className="bg-gradient-to-br from-cyber-cyan to-matrix-green bg-clip-text font-mono text-2xl font-bold text-transparent">
              {"</>"}
            </span>
          </div>
          <h1 className="neon-flicker font-mono text-2xl font-bold tracking-wide text-cyber-cyan">
            CyberLab Studio
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-studio-muted">
            Simulations- & Monitoring-IDE
          </p>
        </div>

        {!booting ? (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Benutzer" value={user} onChange={setUser} inputRef={userRef} placeholder="admin" />
            <Field label="Passwort" value={pass} onChange={setPass} type="password" placeholder="••••••••" />

            {error && <p className="text-xs text-[#FF4D6D]">{error}</p>}

            <button
              type="submit"
              className="group relative w-full overflow-hidden rounded-lg border border-cyber-cyan/50 bg-cyber-cyan/15 py-3 text-sm font-semibold tracking-wide text-cyber-cyan transition-all hover:bg-cyber-cyan/25 hover:shadow-[0_0_28px_-4px_rgba(0,163,255,0.7)]"
            >
              ▸ System betreten
            </button>

            <div className="flex items-center justify-between pt-1 text-[10px] text-studio-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-matrix-green shadow-[0_0_6px_#00E599]" />
                SYSTEM ONLINE
              </span>
              <span>Demo-Zugang: beliebige Credentials</span>
            </div>
          </form>
        ) : (
          <div className="min-h-[180px] font-mono text-[13px] leading-relaxed">
            {lines.map((l, i) => (
              <div key={i} className={`animate-login-rise ${l.cls}`}>
                {l.t}
              </div>
            ))}
            <span className="caret-blink text-cyber-cyan">▋</span>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 z-10 font-mono text-[10px] text-studio-muted">
        v8.0 · Deep-Dark Neon · © CyberLab
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-studio-muted">
        {label}
      </span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-studio-border bg-studio-bg px-3.5 py-2.5 font-mono text-sm text-studio-text placeholder:text-studio-muted/60 transition-all focus:border-cyber-cyan/60 focus:shadow-[0_0_18px_-4px_rgba(0,163,255,0.6)] focus:outline-none"
      />
    </label>
  );
}
