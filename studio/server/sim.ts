/**
 * Eigenständiger Entry-Point für die SIMULATION-ENGINE (Docker-Service
 * `simulation-engine`). Läuft zustandslos gegen die DB — kein HTTP, kein
 * API-State. So lässt sich der Simulator unabhängig vom api-gateway skalieren.
 *
 * Start: STUDIO_ROLE=sim  →  tsx server/sim.ts
 */
import { initDb } from "./db.ts";
import { rearmPendingBoots } from "./boot.ts";
import { startSimulator } from "./simulator.ts";

async function main() {
  try {
    await initDb();
    await rearmPendingBoots();
    startSimulator();
    console.log("[sim-engine]: Simulation-Engine läuft (zustandslos, nur DB-I/O).");
  } catch (err) {
    console.error("[sim-engine]: Start fehlgeschlagen", err);
    process.exit(1);
  }
}

void main();
