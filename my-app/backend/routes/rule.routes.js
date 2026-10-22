import { Router } from "express";
import {
  createRule,
  getRules,
  updateRule,
  deleteRule,
} from "../controllers/rule.controller.js";

const router = Router();

router.get("/", getRules);
router.post("/", createRule);
router.put("/:id", updateRule);
router.delete("/:id", deleteRule);

export default router;