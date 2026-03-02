import mongoose from "mongoose";

export interface IOTP {
  email: string;
  otp: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
  usedAt?: Date;
}

const otpSchema = new mongoose.Schema<IOTP>({
  email: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  isUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  usedAt: { type: Date }
});

// delete expired OTPs
// otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.model<IOTP>("OTP", otpSchema);
