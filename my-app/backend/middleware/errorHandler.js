import { STATUS_CODES } from "node:http";
import mongoose from "mongoose";

// Every error response uses the same JSON shape as the controllers:
//   { error: string, details?: [{ field, message }] }

// Runs when no route matched the request
export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Runs when something throws an error anywhere in the app (Express 5 also sends
// rejected promises from async handlers here)
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Mongoose validation failures: same shape as Zod errors in the controllers
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: "Validation failed",
      details: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // Malformed JSON body (from express.json())
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;

  if (status >= 500) {
    // Log the real error for debugging; never send its details to the client
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }

  res.status(status).json({ error: STATUS_CODES[status] ?? "Request failed" });
}
