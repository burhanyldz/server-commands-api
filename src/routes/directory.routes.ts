import { Router } from 'express';
import {
  createDirectory,
  deleteDirectory,
  listDirectories,
  updateDirectory
} from '../controllers/directory.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.post('/', createDirectory);
router.get('/', listDirectories);
router.put('/:id', updateDirectory);
router.delete('/:id', deleteDirectory);

export default router;
