import { STATUS_CODES } from "node:http";
import mongoose from "mongoose";

// Builds text like "400 Bad Request" from a status number
function statusLine(code) {
  return `${code} ${STATUS_CODES[code]}`;
}

// Runs when no route matched the request
export function notFound(req, res) {
  res
    .status(404)
    .type("text")
    .send(`404 Route not found: ${req.method} ${req.originalUrl}`);
}

// Runs when something throws an error anywhere in the app
export function errorHandler(err, req, res, next) {
  // Mongoose validation failures use the same JSON shape as Zod errors in the controllers:
  // { error, details: [{ field, message }] }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: "Validation failed",
      details: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  const status = err.status || 500;
  const message =
    status === 500 ? "500 Internal server error" : statusLine(status);

  if (status === 500) console.error(err);

  res.status(status).type("text").send(message);
}