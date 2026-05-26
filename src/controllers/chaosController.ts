import { Request, Response } from 'express';
import { triggerChaos, ChaosScenario } from '../services/chaos';

const getClientIp = (req: Request): string => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const handle = (scenario: ChaosScenario) => async (req: Request, res: Response): Promise<void> => {
  try {
    const targetNode = typeof req.body?.target_node === 'string' ? req.body.target_node : undefined;
    const result = await triggerChaos(scenario, {
      targetNode,
      actor: req.auth ? `user:${req.auth.email}` : 'user:unknown',
      ipAddress: getClientIp(req),
    });
    res.json({
      ok: true,
      message: `${scenario} scenario injected. AEGIS pipeline will react within ~30 seconds.`,
      result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    console.error(`[chaos]: ${scenario} failed`, error);
    res.status(500).json({ ok: false, error: msg });
  }
};

export const triggerRansomware = handle('RANSOMWARE');
export const triggerIntegrityLoss = handle('DATA_INTEGRITY_LOSS');
