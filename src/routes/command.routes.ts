import { Router } from 'express';
import {
  createCommand,
  deleteCommand,
  listCommands,
  updateCommand
} from '../controllers/command.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.post('/', createCommand);
router.get('/', listCommands);
router.put('/:id', updateCommand);
router.delete('/:id', deleteCommand);

export default router;
