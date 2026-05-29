import type { DeviceType } from "./catalog.ts";

/** Allgemeine (nicht-aktionsgebundene) Incident-Vorlagen je Gerätetyp.
 *  `fix` = exakter Befehl, den der Copilot empfiehlt. */
export interface GenericIncident {
  priority: "P1" | "P2";
  title: string;
  description: string;
  fix: string;
}

export const GENERIC_INCIDENTS: Partial<Record<DeviceType, GenericIncident[]>> = {
  PROXMOX_NODE: [
    { priority: "P1", title: "Cluster-Quorum verloren", description: "Node aus dem Corosync-Ring gefallen.", fix: "docker restart pve-firewall" },
  ],
  WINDOWS_SERVER: [
    { priority: "P1", title: "AD-Replikation fehlgeschlagen", description: "DC-Replikation seit 30 min gestört.", fix: "docker restart mssql" },
  ],
  TRUENAS: [
    { priority: "P1", title: "ZFS-Pool DEGRADED", description: "Disk 3 als FAULTED markiert.", fix: "apt update && apt upgrade -y" },
  ],
  SYNOLOGY: [
    { priority: "P1", title: "RAID heruntergestuft", description: "Ein Laufwerk ausgefallen, Rebuild nötig.", fix: "apt update && apt upgrade -y" },
  ],
  PFSENSE: [
    { priority: "P2", title: "Hohe Anzahl blockierter Pakete", description: "Möglicher Port-Scan auf WAN-Interface.", fix: "apt update && apt upgrade -y" },
  ],
  MANAGED_SWITCH: [
    { priority: "P2", title: "Port-Flapping an Gi1/0/8", description: "Verbindung instabil, STP-Rekonvergenz.", fix: "docker restart stpd" },
  ],
};

/** title → empfohlener Fix-Befehl (für den Copilot). */
export const FIX_BY_TITLE = new Map<string, string>();
for (const list of Object.values(GENERIC_INCIDENTS)) {
  for (const inc of list ?? []) FIX_BY_TITLE.set(inc.title, inc.fix);
}
