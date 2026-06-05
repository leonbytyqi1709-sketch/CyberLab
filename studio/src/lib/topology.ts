import type { Device, DeviceType } from "./api";

const ROUTERS = new Set<DeviceType>(["PFSENSE", "CORE_ROUTER"]);
const SWITCHES = new Set<DeviceType>(["MANAGED_SWITCH", "ACCESS_POINT"]);

export type Reach = "ok" | "timeout" | "unreachable";

const someUp = (devices: Device[], set: Set<DeviceType>): boolean => {
  const relevant = devices.filter((d) => set.has(d.type));
  if (relevant.length === 0) return true; // keine solche Schicht → kein Engpass
  return relevant.some((d) => d.status === "ONLINE");
};

/**
 * Logische Erreichbarkeit unter Berücksichtigung der Abhängigkeiten:
 *  - Router/Firewall sind die oberste Schicht.
 *  - Switch/AP hängen am Router.
 *  - Server/Storage/Clients hängen am Switch (Switch down ⇒ unreachable).
 * Liefert 'timeout' (Ziel selbst down) bzw. 'unreachable' (Upstream down).
 */
export function reachState(target: Device, devices: Device[]): Reach {
  if (target.status !== "ONLINE") return "timeout";
  if (ROUTERS.has(target.type)) return "ok";

  const routerUp = someUp(devices, ROUTERS);
  if (SWITCHES.has(target.type)) return routerUp ? "ok" : "unreachable";

  const switchUp = someUp(devices, SWITCHES);
  return routerUp && switchUp ? "ok" : "unreachable";
}

/** Subnetz (/24) aus der IP — für die visuelle Gruppierung im Diagramm. */
export function subnetOf(d: Device): string {
  const ip = d.details?.ip;
  if (!ip) return "—";
  const p = ip.split(".");
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.0/24` : "—";
}
