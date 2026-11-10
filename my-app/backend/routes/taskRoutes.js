import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { createTask, listTasks, getTask, updateTask, deleteTask } from '../controllers/taskController.js';

const router = Router();

router.use(requireAuth); // 아래 모든 라우트는 로그인 필요

router.post('/', createTask);
router.get('/', listTasks);
router.get('/:id', getTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;