// Runs when no route matched the request
export function notFound(req, res) {
  res.status(404).json({
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

// Runs when something throws an error anywhere in the app
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = status === 500 ? "Internal server error" : err.message;

  if (status === 500) console.error(err);

  res.status(status).json({ error: { message } });
}
//status404 means the URL is not found
//err.status || 500 --> the server messed up--> use the error’s own status code if it has one, otherwise assume 500
//in middleware bc it. is between the incoming request and final response