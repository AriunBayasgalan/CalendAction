import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import streakRoutes from './routes/streakRoutes.js';
import requireAuth from './middleware/requireAuth.js';
import healthRoutes from "./routes/health.routes.js";
import ruleRoutes from "./routes/rule.routes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { allowedOrigins, corsOriginCallback } from "./services/corsOrigins.js";
import User from './models/User.js';

const port = Number(process.env.PORT) || 5000;
const clientOrigins = allowedOrigins();
const mongoUri = process.env.MONGODB_URI;

const app = express();

app.use(cors({ origin: corsOriginCallback(clientOrigins) }));
app.use(express.json());

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is required");
  process.exit(1);
}

app.get("/", (_req, res) => {
  res.status(200).type("text").send("200 OK");
});

app.use("/health", healthRoutes);
app.use("/rules", ruleRoutes);

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
app.use('/tasks', taskRoutes);
app.use('/events', eventRoutes);
app.use('/streak', streakRoutes);

app.use(notFound);
//if there are no matches
app.use(errorHandler);
//if there is a crash
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS origins: ${clientOrigins.join(", ")}`);
  connectMongo();
});

async function connectMongo() {
  if (!mongoUri) {
    console.error("MONGODB_URI is not set. Add it to my-app/backend/.env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.db.admin().ping();
    // Only the database name: the URI can contain credentials, so it is never logged
    console.log(`Connected to MongoDB (db: ${mongoose.connection.name})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MongoDB connection failed: ${message}`);
    process.exit(1);
  }

}
