import type { DeviceStatus } from "../lib/api";

/** Einheitliche Farb-/Label-Zuordnung je Gerätestatus.
 *  ONLINE = Neon-Matrixgrün (#00E599), BOOTING = warmes Orange. */
export const STATUS_META: Record<
  DeviceStatus,
  { hex: string; label: string }
> = {
  BOOTING: { hex: "#F5A623", label: "Bootet" },
  ONLINE: { hex: "#00E599", label: "Online" },
  OFFLINE: { hex: "#5A5E6B", label: "Offline" },
  CRITICAL: { hex: "#FF4D4D", label: "Kritisch" },
};
