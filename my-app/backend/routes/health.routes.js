import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";

const router = Router();
router.get("/", getHealth);

export default router;
//const router = Router() creates a new router
//Router() makes mini set of routes that can be used in the main app.js file.
//router.get("/", getHealth) means when a GET request is made to the root path of this router, the getHealth function will be called to handle the request.