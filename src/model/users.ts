import mongoose from "mongoose";
import type { IUser } from "../types/User.js";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  picture: { type: String },
});

export const User = mongoose.model<IUser>("User", userSchema);