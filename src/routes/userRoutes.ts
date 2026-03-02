import express  from "express";
import { googleLogin, googleLoginV2, verifyRecaptchaV2Token, emailPasswordSignup, emailPasswordLogin, forgotPassword, resetPassword } from "../controllers/userController.ts";
import { requestOTP, verifyOTP, resendOTP } from "../controllers/otpController.ts";

const router = express.Router();

// Email/Password Authentication Routes
router.post("/signup", emailPasswordSignup);
router.post("/login", emailPasswordLogin);

// Password Reset Routes (using OTP)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Google OAuth Routes
router.post("/google-login", googleLogin);
router.post("/verify-recaptcha-v2", verifyRecaptchaV2Token);
router.post("/google-login-v2", googleLoginV2);

// OTP Routes (alternative login method)
router.post("/request-otp", requestOTP);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);

export default router;