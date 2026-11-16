import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { createTask, listTasks, getTask, updateTask, deleteTask, placeTask, skipTask, startTask } from '../controllers/taskController.js';
import requireValidId from '../middleware/requireValidId.js';

const router = Router();

router.use(requireAuth); // every route below requires a signed-in user

router.post('/', createTask);
router.post('/:id/place', requireValidId, placeTask)
router.post('/:id/skip', requireValidId, skipTask)
router.post('/:id/start', requireValidId, startTask)
router.get('/', listTasks);
router.get('/:id', requireValidId, getTask);
router.patch('/:id', requireValidId, updateTask);
router.delete('/:id', requireValidId, deleteTask);


export default router;