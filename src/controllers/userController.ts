import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { verifyRecaptcha, verifyRecaptchaV2 } from "../lib/recaptcha.ts";
import fs from "fs";
import path from "path";

const GOOGLE_CLIENT_ID =
  "686091193697-em47bkmhkasm4ndf8f1o5473li887rvr.apps.googleusercontent.com";

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

    res.json({ 
      success: true, 
      user: payload,
      recaptchaScore: recaptchaResult.score 
    });
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

    res.json({ 
      success: true, 
      user: payload,
      recaptchaVerified: true,
      recaptchaVersion: 'v2'
    });
  } catch (error) {
    log("Error: " + JSON.stringify(error));
    res.status(500).json({ success: false, code: "GOOGLE_LOGIN_V2_FAILED", message: "Google login with v2 failed" });
  }
};
