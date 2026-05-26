import { Router } from 'express';
import {
  getInfrastructureTopology,
  getSystemStatusHandler,
  toggleSimulation,
  getUsageHandler,
  getAiActivity,
} from '../controllers/infrastructureController';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/topology', getInfrastructureTopology);
router.get('/system-status', getSystemStatusHandler);
router.get('/usage', getUsageHandler);
router.get('/ai-activity', getAiActivity);
router.post('/toggle-simulation', requireAdmin, toggleSimulation);

export default router;
