import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { testDbConnection } from './config/neon';
import { initDatabase } from './config/initDb';
import { startSimulator } from './simulator/engine';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'Cyber Defense Core is operational' });
});

const startServer = async () => {
  try {
    await testDbConnection();
    await initDatabase();
    await startSimulator();
    
    app.listen(PORT, () => {
      console.log(`[server]: Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[server]: Failed to start server', error);
  }
};

startServer();
