import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const log = (message: string) => {
  process.stdout.write(message + "\n");
};

export const sendOtpEmail = async (
  email: string,
  otp: string
): Promise<boolean> => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Authentication",
      html: `
        <h2>Two-Factor Authentication</h2>
        <p>Your OTP for authentication is:</p>
        <h1 style="color: #007bff; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    log(`OTP email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    log(`Error sending OTP email: ${JSON.stringify(error)}`);
    return false;
  }
};

export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    log("Email service connected successfully");
    return true;
  } catch (error) {
    log(`Email service connection failed: ${JSON.stringify(error)}`);
    return false;
  }
};
