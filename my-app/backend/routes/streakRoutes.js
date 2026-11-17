import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { showStreak } from '../controllers/streakController.js';

const router = Router();

router.use(requireAuth);

router.get('/', showStreak);

export default router;
