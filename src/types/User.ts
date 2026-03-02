import { Types } from 'mongoose';
export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password?: string; // Optional for Google OAuth users
    picture?: string;
    authMethod: "email" | "google";
    createdAt: Date;
}