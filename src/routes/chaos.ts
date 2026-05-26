import { Router } from 'express';
import {
  triggerRansomware,
  triggerIntegrityLoss,
} from '../controllers/chaosController';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireAdmin);

router.post('/ransomware', triggerRansomware);
router.post('/integrity-loss', triggerIntegrityLoss);

export default router;
