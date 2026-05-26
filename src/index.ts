import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { testDbConnection } from './config/neon';
import { initDatabase } from './config/initDb';
import { startSimulator } from './simulator/engine';
import { startAnalyzer } from './ai-engine/analyzer';
import { startReactor } from './autopilot/reactor';
import { startSituationReporter } from './services/situationReporter';
import { loadSystemSettings } from './services/systemControl';
import dashboardRouter from './routes/dashboard';
import authRouter from './routes/auth';
import chaosRouter from './routes/chaos';
import infrastructureRouter from './routes/infrastructure';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'Cyber Defense Core is operational' });
});

app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/chaos', chaosRouter);
app.use('/api/infrastructure', infrastructureRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

const startServer = async () => {
  try {
    await testDbConnection();
    await initDatabase();
    await loadSystemSettings();
    await startSimulator();
    await startAnalyzer();
    await startReactor();
    await startSituationReporter();

    app.listen(PORT, () => {
      console.log(`[server]: Server is running at http://localhost:${PORT}`);
      console.log(`[server]: Dashboard available at http://localhost:${PORT}/login.html`);
    });
  } catch (error) {
    console.error('[server]: Failed to start server', error);
  }
};

startServer();
