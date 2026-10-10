import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import rootRoutes from "./routes/rootRoutes.js";

const port = Number(process.env.PORT) || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const mongoUri = process.env.MONGODB_URI;

const app = express();

app.use(cors({ origin: clientOrigin }));
app.use(express.json());
app.use(rootRoutes);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS origin: ${clientOrigin}`);
  console.log(
    process.env.JWT_SECRET ? "JWT_SECRET is set." : "JWT_SECRET is not set.",
  );
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
