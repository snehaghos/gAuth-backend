import mongoose from "mongoose";
import type { IUser } from "../types/User.js";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional - for email/password login
  picture: { type: String },
  authMethod: { type: String, enum: ["email", "google"], default: "email" }, // Track login method
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>("User", userSchema);