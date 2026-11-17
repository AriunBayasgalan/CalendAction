const FALLBACK = 'http://localhost:5173';

// CLIENT_ORIGIN may be one origin or a comma-separated list (local + production).
export function allowedOrigins(raw = process.env.CLIENT_ORIGIN, fallback = FALLBACK) {
  const list = String(raw ?? fallback)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return list.length > 0 ? list : [fallback];
}

export function corsOriginCallback(origins) {
  return (origin, callback) => {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(null, false);
  };
}
