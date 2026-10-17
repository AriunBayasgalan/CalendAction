import { STATUS_CODES } from "node:http";

// Builds text like "404 Not Found" from a status number
function statusLine(code) {
  return `${code} ${STATUS_CODES[code]}`;
}

// Runs when no route matched the request
export function notFound(req, res) {
  res
    .status(404)
    .type("text")
    .send(`${statusLine(404)}: ${req.method} ${req.originalUrl}`);
}

// Runs when something throws an error anywhere in the app
export function errorHandler(err, req, res, next) {
  const code = err.status || 500;

  if (code === 500) console.error(err);

  res.status(code).type("text").send(statusLine(code));
}