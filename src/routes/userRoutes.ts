import express  from "express";
import { googleLogin, googleLoginV2, verifyRecaptchaV2Token } from "../controllers/userController.ts";

const router = express.Router();


router.post("/google-login", googleLogin);

// reCAPTCHA v2 endpoints
router.post("/verify-recaptcha-v2", verifyRecaptchaV2Token);
router.post("/google-login-v2", googleLoginV2);

export default router;