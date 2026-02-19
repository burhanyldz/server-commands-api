import { Router } from 'express';
import {
  createCommandRun,
  deleteCommandRun,
  getCommandRunById,
  listCommandRuns,
  retryCommandRun
} from '../controllers/command-run.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.post('/', createCommandRun);
router.get('/', listCommandRuns);
router.get('/:id', getCommandRunById);
router.post('/:id/retry', retryCommandRun);
router.delete('/:id', deleteCommandRun);

export default router;
