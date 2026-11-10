import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import {
  createRule,
  getRules,
  updateRule,
  deleteRule,
} from "../controllers/rule.controller.js";

const router = Router();

// Every rule route needs a signed-in user
router.use(requireAuth);

router.get("/", getRules);
router.post("/", createRule);
router.put("/:id", updateRule);
router.delete("/:id", deleteRule);

export default router;