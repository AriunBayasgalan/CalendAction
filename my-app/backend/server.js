import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";

const port = Number(process.env.PORT) || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const mongoUri = process.env.MONGODB_URI;

const app = express();

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ name: "CalendAction API" });
});

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
