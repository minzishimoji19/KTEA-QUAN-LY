import { Router } from 'express';
import { login, getSession, logout, getMe } from '../controllers/auth.controller.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.get('/session', getSession);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

export default router;
