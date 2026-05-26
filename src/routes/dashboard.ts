import { Router } from 'express';
import {
  getNodes,
  getLogs,
  getIncidents,
  getStats,
  getSituation,
  getAuditLogs,
  getSiemAlerts,
} from '../controllers/dashboardController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/nodes', getNodes);
router.get('/logs', getLogs);
router.get('/incidents', getIncidents);
router.get('/stats', getStats);
router.get('/situation', getSituation);
router.get('/audit', getAuditLogs);
router.get('/siem-alerts', getSiemAlerts);

export default router;
