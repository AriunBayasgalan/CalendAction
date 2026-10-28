import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import authRoutes from './routes/authRoutes.js';
import requireAuth from './middleware/requireAuth.js';
import healthRoutes from "./routes/health.routes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

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
  res.status(200).type("text").send("200 OK");
});

app.use("/health", healthRoutes);
//tells the server to use the imported file
app.get("/bad-request", (_req, _res, next) => {
  const err = new Error("Bad request");
  err.status = 400;
  next(err);
});
// Demo route: deliberately crashes so the 500 handler can be seen
app.get("/crash", () => {
  throw new Error("Demo crash");
});

app.use('/auth', authRoutes);

app.use(notFound);
//if there are no matches
app.use(errorHandler);
//if there is a crash
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS origin: ${clientOrigin}`);
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
    console.log("MongoDB ping succeeded. Connected to Atlas.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MongoDB connection failed: ${message}`);
    process.exit(1);
  }

}
