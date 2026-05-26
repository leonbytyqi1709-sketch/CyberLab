import { Request, Response } from 'express';
import { getTopology } from '../services/topology';
import {
  getSystemStatus,
  setSimulationActive,
  isSimulationActive,
} from '../services/systemControl';
import { getUsageSummary } from '../services/usageTracker';
import { getActivitySnapshot } from '../services/aiActivity';

export const getInfrastructureTopology = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const topology = await getTopology();
    res.json({
      ...topology,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[infrastructure]: getTopology failed', error);
    res.status(500).json({ error: 'Failed to load topology' });
  }
};

const getClientIp = (req: Request): string => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
};

export const getSystemStatusHandler = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.json({
    ...getSystemStatus(),
    server_time: new Date().toISOString(),
  });
};

export const getUsageHandler = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const summary = await getUsageSummary();
    res.json(summary);
  } catch (error) {
    console.error('[infrastructure]: getUsage failed', error);
    res.status(500).json({ error: 'Failed to load usage summary' });
  }
};

export const getAiActivity = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 50);
    const snap = await getActivitySnapshot(limit);
    res.json(snap);
  } catch (error) {
    console.error('[infrastructure]: getAiActivity failed', error);
    res.status(500).json({ error: 'Failed to load AI activity' });
  }
};

export const toggleSimulation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const desired =
      typeof req.body?.active === 'boolean' ? req.body.active : !isSimulationActive();
    const actor = req.auth ? `user:${req.auth.email}` : 'user:unknown';
    const status = await setSimulationActive(desired, actor, getClientIp(req));
    res.json({
      ok: true,
      ...status,
      message: desired
        ? 'Autopilot engaged. Simulator and SIEM correlator going hot.'
        : 'Autopilot paused. System idle, zero API cost.',
    });
  } catch (error) {
    console.error('[infrastructure]: toggleSimulation failed', error);
    res.status(500).json({ ok: false, error: 'Toggle failed' });
  }
};
