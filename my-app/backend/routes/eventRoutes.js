import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js'; 
import * as controller from '../controllers/eventController.js';
import requireValidId from '../middleware/requireValidId.js';


const router = Router();

router.use(requireAuth);

router.post("/", controller.createEvent);
router.get("/", controller.listEvents);
router.get("/:id", requireValidId, controller.getEvent);
router.patch("/:id", requireValidId, controller.updateEvent);
router.post("/:id/start", requireValidId, controller.startEvent);
router.delete("/:id", requireValidId, controller.deleteEvent);

export default router;