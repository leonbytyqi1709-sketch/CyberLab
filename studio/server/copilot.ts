import { FIX_BY_TITLE } from "./incidents.ts";

export interface OpenLog {
  title: string;
  description: string | null;
  priority: string;
  kind: string;
  process: string | null;
  device_name: string;
}

export interface CopilotAnswer {
  hasProblem: boolean;
  title: string;
  diagnosis: string;
  command: string | null;
  closing: string;
}

/**
 * Deterministisches "Senior-Admin"-Wissen: leitet aus einem offenen Log
 * Diagnose + exakten Fix-Befehl ab. (Echter Gemini-Call leicht nachrüstbar.)
 */
export function explain(log: OpenLog | null): CopilotAnswer {
  if (!log) {
    return {
      hasProblem: false,
      title: "Alles ruhig",
      diagnosis: "Keine offenen Vorfälle. Alle überwachten Systeme laufen im Normalbereich.",
      command: null,
      closing: "Nichts zu tun. Lehn dich zurück. ☕",
    };
  }

  let command: string | null = null;
  let diagnosis = "";

  switch (log.kind) {
    case "security_update":
      command = "apt update && apt upgrade -y";
      diagnosis =
        `Auf '${log.device_name}' stehen Sicherheitsupdates aus. Ungepatchte CVEs sind ` +
        `das häufigste Einfallstor — zeitnah einspielen, idealerweise in einem Wartungsfenster.`;
      break;
    case "process_cpu":
      command = `kill ${log.process}`;
      diagnosis =
        `Der Prozess '${log.process}' ist außer Kontrolle und sättigt die CPU. ` +
        `Erst beenden, um das System zu stabilisieren, dann Ursache (Endlosschleife/Last) prüfen.`;
      break;
    case "service":
      command = `docker restart ${log.process}`;
      diagnosis =
        `Der Container '${log.process}' ist abgestürzt (exit 137 ⇒ OOM/Kill). ` +
        `Neustart bringt den Service zurück; danach Logs & Memory-Limits kontrollieren.`;
      break;
    case "zfs":
      command = `zpool replace tank ${log.process} ${log.process}-new`;
      diagnosis =
        `ZFS-Pool 'tank' ist DEGRADED — Disk '${log.process}' ist ausgefallen, die ` +
        `Redundanz ist aufgebraucht und die IOPS brechen ein. Defekte Platte ersetzen, ` +
        `das Resilvering baut die Parität automatisch wieder auf.`;
      break;
    default:
      command = FIX_BY_TITLE.get(log.title) ?? null;
      diagnosis =
        `Vorfall: "${log.title}". ${log.description ?? ""} ` +
        (command
          ? "Empfohlene Sofortmaßnahme siehe unten."
          : "Bitte manuell am Gerät prüfen.");
  }

  return {
    hasProblem: true,
    title: `${log.priority} · ${log.title}`,
    diagnosis: diagnosis.trim(),
    command,
    closing: command
      ? "Führe den Befehl oben aus — danach sollte der Alarm verschwinden."
      : "Kein automatischer Fix verfügbar — manuelle Prüfung nötig.",
  };
}
