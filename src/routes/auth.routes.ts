import { Router } from 'express';
import { bootstrapAdmin, getCurrentUser, login } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/bootstrap-admin', bootstrapAdmin);
router.post('/login', login);
router.get('/me', requireAuth, getCurrentUser);

export default router;
