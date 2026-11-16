import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { createTask, listTasks, getTask, updateTask, deleteTask, placeTask, skipTask } from '../controllers/taskController.js';
import requireValidId from '../middleware/requireValidId.js';

const router = Router();

router.use(requireAuth); // 아래 모든 라우트는 로그인 필요

router.post('/', createTask);
router.post('/:id/place', requireValidId, placeTask)
router.post('/:id/skip', requireValidId, skipTask)
router.get('/', listTasks);
router.get('/:id', requireValidId, getTask);
router.patch('/:id', requireValidId, updateTask);
router.delete('/:id', requireValidId, deleteTask);


export default router;