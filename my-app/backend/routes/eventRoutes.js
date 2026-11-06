import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js'; 
import * as controller from '../controllers/eventController.js';


const router = Router();

router.use(requireAuth);

router.post("/", controller.createEvent);
router.get("/", controller.listEvents);
router.get("/:id", controller.getEvent);
router.patch("/:id", controller.updateEvent);
router.delete("/:id", controller.deleteEvent);

export default router;