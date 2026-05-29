import express from "express";
import { initDb } from "./db.ts";
import { rearmPendingBoots } from "./boot.ts";
import { startSimulator } from "./simulator.ts";
import { router } from "./routes.ts";

const PORT = Number(process.env.STUDIO_API_PORT ?? 3001);

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "CyberLab Studio API operational" });
});

app.use("/api", router);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** initDb mit Retry — überlebt transiente Neon-Aussetzer beim Start. */
async function initDbWithRetry(attempts = 5): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await initDb();
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[api]: DB-Init fehlgeschlagen (Versuch ${i}/${attempts}): ${msg}`);
      if (i === attempts) throw err;
      await sleep(3000 * i); // einfacher Backoff
    }
  }
}

async function start() {
  try {
    await initDbWithRetry();
    await rearmPendingBoots();
    startSimulator();
    app.listen(PORT, () => {
      console.log(`[api]: CyberLab Studio API läuft auf http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("[api]: Start nach mehreren Versuchen fehlgeschlagen", err);
    process.exit(1);
  }
}

void start();
