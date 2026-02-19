import { Router } from 'express';
import {
  bootstrapAdmin,
  completeTotpLogin,
  confirmTotp,
  disableTotp,
  getCurrentUser,
  login,
  setupTotp
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/bootstrap-admin', bootstrapAdmin);
router.post('/login', login);
router.get('/me', requireAuth, getCurrentUser);

// 2FA login step 2
router.post('/2fa/complete-login', completeTotpLogin);

// 2FA management (authenticated)
router.post('/2fa/setup', requireAuth, setupTotp);
router.post('/2fa/confirm', requireAuth, confirmTotp);
router.post('/2fa/disable', requireAuth, disableTotp);

export default router;
