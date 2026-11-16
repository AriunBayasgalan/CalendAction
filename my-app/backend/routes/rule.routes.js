import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import {
  createRule,
  getRules,
  updateRule,
  deleteRule,
} from "../controllers/rule.controller.js";
import requireValidId from "../middleware/requireValidId.js";

const router = Router();

// Every rule route needs a signed-in user
router.use(requireAuth);

router.get("/", getRules);
router.post("/", createRule);
router.put("/:id", requireValidId, updateRule);
router.delete("/:id", requireValidId, deleteRule);

export default router;