import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID =
  "686091193697-em47bkmhkasm4ndf8f1o5473li887rvr.apps.googleusercontent.com";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { ClientToken } = req.body;
    console.log("Token:", ClientToken);

    const googleVerification = await googleClient.verifyIdToken({
      idToken: ClientToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = googleVerification.getPayload();
    console.log(payload);

    res.json({ success: true, user: payload });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Google login failed" });
  }
};
