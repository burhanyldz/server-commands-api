import { Router } from 'express';
import {
  createChainTemplate,
  deleteChainTemplate,
  getChainTemplateById,
  listChainTemplates,
  updateChainTemplate
} from '../controllers/chain-template.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.post('/', createChainTemplate);
router.get('/', listChainTemplates);
router.get('/:id', getChainTemplateById);
router.put('/:id', updateChainTemplate);
router.delete('/:id', deleteChainTemplate);

export default router;
