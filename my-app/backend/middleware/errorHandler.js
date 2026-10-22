import { STATUS_CODES } from "node:http";

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
  const status = err.status || 500;
  const message =
    status === 500 ? "500 Internal server error" : statusLine(status);

  if (status === 500) console.error(err);

  res.status(status).type("text").send(message);
}