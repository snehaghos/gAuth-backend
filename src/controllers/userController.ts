import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { verifyRecaptcha, verifyRecaptchaV2 } from "../lib/recaptcha.ts";
import { User } from "../model/users.ts";
import { OTP } from "../model/otp.ts";
import { generateOTP, getOTPExpiryTime } from "../lib/otpGenerator.ts";
import { sendOtpEmail } from "../lib/emailService.ts";
import fs from "fs";
import path from "path";

const GOOGLE_CLIENT_ID =
  "686091193697-em47bkmhkasm4ndf8f1o5473li887rvr.apps.googleusercontent.com";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


const log = (message: string) => {
  process.stdout.write(message + "\n"); 
  const logFile = path.join(process.cwd(), "backend.log");
  fs.appendFileSync(logFile, message + "\n");
};

const getRequestValue = (source: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
};

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const ClientToken = getRequestValue(body, ["ClientToken", "clientToken", "credential", "idToken", "token"]);
    const recaptchaToken = getRequestValue(body, ["recaptchaToken", "recaptcha", "captchaToken", "captcha", "g-recaptcha-response", "gRecaptchaResponse", "recaptcha_response"]);
    log("Token: " + ClientToken);

    if (!ClientToken) {
      return res.status(400).json({ 
        success: false, 
        code: "GOOGLE_TOKEN_MISSING",
        message: "Google client token is required",
        expectedFields: ["ClientToken", "clientToken", "credential", "idToken", "token"]
      });
    }

    const recaptchaResult = await verifyRecaptcha(recaptchaToken, 0.5);
    log("reCAPTCHA verification: " + JSON.stringify(recaptchaResult));
    log("reCAPTCHA Score: " + recaptchaResult.score);
    log("reCAPTCHA Valid: " + recaptchaResult.isValid);


    if (!recaptchaResult.isValid) {
      return res.status(400).json({ 
        success: false, 
        code: "RECAPTCHA_FAILED",
        message: recaptchaResult.message,
        expectedFields: ["recaptchaToken", "recaptcha", "captchaToken", "captcha", "g-recaptcha-response", "gRecaptchaResponse", "recaptcha_response"],
        recaptchaScore: recaptchaResult.score
      });
    }

    // verify Google token
    const googleVerification = await googleClient.verifyIdToken({
      idToken: ClientToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = googleVerification.getPayload();
    log("Payload: " + JSON.stringify(payload));


    if (payload?.email) {
      const user = await User.findOneAndUpdate(
        { email: payload.email },
        {
          name: payload.name || "",
          email: payload.email,
          picture: payload.picture || "",
          authMethod: "google"
        },
        { upsert: true, new: true }
      );
      log("User saved/updated: " + JSON.stringify(user));
      
      res.json({ 
        success: true, 
        user: user,
        recaptchaScore: recaptchaResult.score 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        code: "INVALID_PAYLOAD",
        message: "Google payload missing email" 
      });
    }
  } catch (error) {
    log("Error: " + JSON.stringify(error));
    res.status(500).json({ success: false, code: "GOOGLE_LOGIN_FAILED", message: "Google login failed" });
  }
};


export const verifyRecaptchaV2Token = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const recaptchaToken = getRequestValue(body, ["recaptchaToken", "recaptcha", "captchaToken", "captcha", "g-recaptcha-response", "gRecaptchaResponse", "recaptcha_response"]);
    log("Verifying reCAPTCHA v2 token");

    if (!recaptchaToken) {
      return res.status(400).json({ 
        success: false, 
        code: "RECAPTCHA_TOKEN_MISSING",
        message: "reCAPTCHA v2 token is required",
        expectedFields: ["recaptchaToken", "recaptcha", "captchaToken", "captcha", "g-recaptcha-response", "gRecaptchaResponse", "recaptcha_response"]
      });
    }

    const recaptchaResult = await verifyRecaptchaV2(recaptchaToken);
    log("reCAPTCHA v2 verification: " + JSON.stringify(recaptchaResult));

    if (!recaptchaResult.isValid) {
      return res.status(400).json({ 
        success: false, 
        code: "RECAPTCHA_V2_FAILED",
        message: recaptchaResult.message 
      });
    }

    res.json({ 
      success: true, 
      message: recaptchaResult.message,
      challengeTs: recaptchaResult.challengeTs,
      hostname: recaptchaResult.hostname
    });
  } catch (error) {
    log("Error: " + JSON.stringify(error));
    res.status(500).json({ success: false, code: "RECAPTCHA_V2_VERIFY_FAILED", message: "reCAPTCHA v2 verification failed" });
  }
};

/**
 * Google Login with reCAPTCHA v2
*/
export const googleLoginV2 = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const ClientToken = getRequestValue(body, ["ClientToken", "clientToken", "credential", "idToken", "token"]);
    const recaptchaToken = getRequestValue(body, ["recaptchaToken", "recaptcha", "captchaToken", "captcha", "g-recaptcha-response", "gRecaptchaResponse", "recaptcha_response"]);
    log("Google Login with reCAPTCHA v2 - Token: " + ClientToken);

    if (!ClientToken) {
      return res.status(400).json({ 
        success: false, 
        code: "GOOGLE_TOKEN_MISSING",
        message: "Google client token is required",
        expectedFields: ["ClientToken", "clientToken", "credential", "idToken", "token"]
      });
    }

    // Verify reCAPTCHA v2
    const recaptchaResult = await verifyRecaptchaV2(recaptchaToken);
    log("reCAPTCHA v2 verification: " + JSON.stringify(recaptchaResult));

    if (!recaptchaResult.isValid) {
      return res.status(400).json({ 
        success: false, 
        code: "RECAPTCHA_V2_FAILED",
        message: recaptchaResult.message 
      });
    }

    // Verify Google token
    const googleVerification = await googleClient.verifyIdToken({
      idToken: ClientToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = googleVerification.getPayload();
    log("Payload: " + JSON.stringify(payload));

    if (payload?.email) {
      const user = await User.findOneAndUpdate(
        { email: payload.email },
        {
          name: payload.name || "",
          email: payload.email,
          picture: payload.picture || ""
        },
        { upsert: true, new: true }
      );
      log("User saved/updated: " + JSON.stringify(user));
      
      res.json({ 
        success: true, 
        user: user,
        recaptchaVerified: true,
        recaptchaVersion: 'v2'
      });
    } else {
      res.status(400).json({ 
        success: false, 
        code: "INVALID_PAYLOAD",
        message: "Google payload missing email" 
      });
    }
  } catch (error) {
    log("Error: " + JSON.stringify(error));
    res.status(500).json({ success: false, code: "GOOGLE_LOGIN_V2_FAILED", message: "Google login with v2 failed" });
  }
};

/**
 * Step 1: User registers with email and password
 */
export const emailPasswordSignup = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = getRequestValue(body, ["email", "userEmail"]);
    const password = getRequestValue(body, ["password"]);
    const name = getRequestValue(body, ["name", "fullName"]);
    const recaptchaToken = getRequestValue(body, [
      "recaptchaToken",
      "recaptcha",
      "captchaToken",
      "captcha",
    ]);

    log(`Signup Request - Email: ${email}`);

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "Email, password, and name are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_TOO_SHORT",
        message: "Password must be at least 6 characters",
      });
    }

    // Verify reCAPTCHA v2
    const recaptchaResult = await verifyRecaptchaV2(recaptchaToken);
    log(`reCAPTCHA v2 verification: ${JSON.stringify(recaptchaResult)}`);

    if (!recaptchaResult.isValid) {
      return res.status(400).json({
        success: false,
        code: "RECAPTCHA_FAILED",
        message: recaptchaResult.message,
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        code: "USER_EXISTS",
        message: "User already exists with this email",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      authMethod: "email",
    });

    await newUser.save();
    log(`User registered: ${email}`);

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    log(`Error in emailPasswordSignup: ${JSON.stringify(error)}`);
    res.status(500).json({
      success: false,
      code: "SIGNUP_FAILED",
      message: "Failed to register user",
    });
  }
};

/**
 * Step 2: User logs in with email and password
 */
export const emailPasswordLogin = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = getRequestValue(body, ["email", "userEmail"]);
    const password = getRequestValue(body, ["password"]);
    const recaptchaToken = getRequestValue(body, [
      "recaptchaToken",
      "recaptcha",
      "captchaToken",
      "captcha",
    ]);

    log(`Login Request - Email: ${email}`);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "Email and password are required",
      });
    }

    // Verify reCAPTCHA v2
    const recaptchaResult = await verifyRecaptchaV2(recaptchaToken);
    log(`reCAPTCHA v2 verification: ${JSON.stringify(recaptchaResult)}`);

    if (!recaptchaResult.isValid) {
      return res.status(400).json({
        success: false,
        code: "RECAPTCHA_FAILED",
        message: recaptchaResult.message,
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user || !user.password) {
      log(`Invalid login attempt for ${email}`);
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      log(`Invalid password for ${email}`);
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    log(`User logged in: ${email}`);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    log(`Error in emailPasswordLogin: ${JSON.stringify(error)}`);
    res.status(500).json({
      success: false,
      code: "LOGIN_FAILED",
      message: "Failed to login",
    });
  }
};

/**
 * Step 3: User forgot password - Request OTP
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = getRequestValue(body, ["email", "userEmail"]);
    const recaptchaToken = getRequestValue(body, [
      "recaptchaToken",
      "recaptcha",
      "captchaToken",
      "captcha",
    ]);

    log(`Forgot Password Request - Email: ${email}`);

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_MISSING",
        message: "Email is required",
      });
    }

    // Verify reCAPTCHA v2
    const recaptchaResult = await verifyRecaptchaV2(recaptchaToken);
    log(`reCAPTCHA v2 verification: ${JSON.stringify(recaptchaResult)}`);

    if (!recaptchaResult.isValid) {
      return res.status(400).json({
        success: false,
        code: "RECAPTCHA_FAILED",
        message: recaptchaResult.message,
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      log(`Forgot password request for non-existent email: ${email}`);
      return res.status(200).json({
        success: true,
        message: "If email exists, OTP has been sent",
      });
    }

    // Generate OTP
    const otp = generateOTP(6);
    const expiresAt = getOTPExpiryTime(10); // 10 minutes expiry

    // Save OTP to database
    const otpRecord = new OTP({
      email,
      otp,
      expiresAt,
      isUsed: false,
    });

    await otpRecord.save();
    log(`OTP saved to database for ${email}: ${otp}`);

    // Send OTP via email
    const emailSent = await sendOtpEmail(email, otp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        code: "EMAIL_SEND_FAILED",
        message: "Failed to send OTP email",
      });
    }

    res.json({
      success: true,
      message: "OTP sent to your email for password reset",
      email,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error) {
    log(`Error in forgotPassword: ${JSON.stringify(error)}`);
    res.status(500).json({
      success: false,
      code: "FORGOT_PASSWORD_FAILED",
      message: "Failed to process forgot password request",
    });
  }
};

/**
 * Step 4: User resets password with OTP
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = getRequestValue(body, ["email", "userEmail"]);
    const otp = getRequestValue(body, ["otp", "otpCode"]);
    const newPassword = getRequestValue(body, ["newPassword", "password"]);

    log(`Reset Password Request - Email: ${email}`);

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "Email, OTP, and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_TOO_SHORT",
        message: "Password must be at least 6 characters",
      });
    }

    // Verify OTP
    const otpRecord = await OTP.findOne({
      email,
      otp,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      log(`Invalid or expired OTP for ${email}`);
      return res.status(400).json({
        success: false,
        code: "INVALID_OTP",
        message: "Invalid or expired OTP",
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    otpRecord.usedAt = new Date();
    await otpRecord.save();
    log(`OTP marked as used for ${email}`);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    const user = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    log(`Password reset for ${email}`);

    res.json({
      success: true,
      message: "Password reset successfully",
      email,
    });
  } catch (error) {
    log(`Error in resetPassword: ${JSON.stringify(error)}`);
    res.status(500).json({
      success: false,
      code: "RESET_PASSWORD_FAILED",
      message: "Failed to reset password",
    });
  }
};
