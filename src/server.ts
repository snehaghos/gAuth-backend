import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors(
    {
        origin: "http://localhost:3000",
    }
));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || '';
app.use("/api/auth", userRoutes);
mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
    })

    
