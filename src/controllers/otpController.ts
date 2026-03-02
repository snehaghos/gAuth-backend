import type { Request, Response } from "express";
import { OTP } from "../model/otp.ts";
import { generateOTP, getOTPExpiryTime } from "../lib/otpGenerator.ts";
import { sendOtpEmail } from "../lib/emailService.ts";
import { verifyRecaptchaV2 } from "../lib/recaptcha.ts";
import fs from "fs";
import path from "path";

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

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Step 1: User submits email and reCAPTCHA
 * Generates and sends OTP to the email
 */
export const requestOTP = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = getRequestValue(body, ["email", "userEmail"]);
    const recaptchaToken = getRequestValue(body, [
      "recaptchaToken",
      "recaptcha",
      "captchaToken",
      "captcha",
    ]);

    log(`OTP Request - Email: ${email}`);

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_MISSING",
        message: "Email is required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "Invalid email format",
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
      message: "OTP sent to your email",
      email,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error) {
    log(`Error in requestOTP: ${JSON.stringify(error)}`);
    res.status(500).json({
      success: false,
      code: "REQUEST_OTP_FAILED",
      message: "Failed to request OTP",
    });
  }
};

/**
 * Step 2: User submits email and OTP
 * Verifies the OTP and completes authentication
 */
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = getRequestValue(body, ["email", "userEmail"]);
    const otp = getRequestValue(body, ["otp", "otpCode"]);

    log(`OTP Verification - Email: ${email}, OTP: ${otp}`);

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "Email and OTP are required",
      });
    }

    // Find the latest valid OTP for this email
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

    // Generate authentication token (you can use JWT here)
    const authToken = Buffer.from(`${email}:${Date.now()}`).toString("base64");

    res.json({
      success: true,
      message: "OTP verified successfully",
      email,
      authToken,
      verifiedAt: new Date(),
    });
  } catch (error) {
    log(`Error in verifyOTP: ${JSON.stringify(error)}`);
    res.status(500).json({
      success: false,
      code: "VERIFY_OTP_FAILED",
      message: "Failed to verify OTP",
    });
  }
};

/**
 * (Optional) Resend OTP if user didn't receive it
 */
export const resendOTP = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = getRequestValue(body, ["email", "userEmail"]);

    log(`Resend OTP - Email: ${email}`);

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_MISSING",
        message: "Email is required",
      });
    }

    // Find the latest unexpired OTP for this email
    const latestOTP = await OTP.findOne({
      email,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!latestOTP) {
      return res.status(400).json({
        success: false,
        code: "NO_ACTIVE_OTP",
        message: "No active OTP found for this email. Please request a new one.",
      });
    }

    // Resend the existing OTP
    const emailSent = await sendOtpEmail(email, latestOTP.otp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        code: "EMAIL_SEND_FAILED",
        message: "Failed to resend OTP",
      });
    }

    res.json({
      success: true,
      message: "OTP resent to your email",
      email,
      expiresIn: Math.floor(
        (latestOTP.expiresAt.getTime() - Date.now()) / 1000
      ),
    });
  } catch (error) {
    log(`Error in resendOTP: ${JSON.stringify(error)}`);
    res.status(500).json({
      success: false,
      code: "RESEND_OTP_FAILED",
      message: "Failed to resend OTP",
    });
  }
};
