import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import authRoutes from './routes/authRoutes.js';
import requireAuth from './middleware/requireAuth.js';
import User from './models/User.js';

const port = Number(process.env.PORT) || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const mongoUri = process.env.MONGODB_URI;

const app = express();

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is required");
  process.exit(1);
}

app.get("/", (_req, res) => {
  res.json({ name: "CalendAction API" });
});

app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    return res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.use('/auth', authRoutes);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS origin: ${clientOrigin}`);
  connectMongo();
});

async function connectMongo() {
  if (!mongoUri) {
    console.warn("MONGODB_URI is not set. API is running without MongoDB.");
    return;
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected to MongoDB.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MongoDB connection failed: ${message}`);
    console.error("API is running without a database connection.");
  }

}
