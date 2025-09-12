import express  from "express";
import { googleLogin } from "../controllers/userController.ts";

const router = express.Router();

router.post("/google-login",googleLogin);

export default router;