// Every error response from the API has one JSON shape:
//   { error: string, details?: [{ field, message }] }
// `error` is a short summary the UI can show as-is; `details` lists per-field
// problems (field is the dotted path, e.g. "end" or "items.0.name").

// Zod issues -> [{ field, message }]. Issues about the whole body (empty path)
// are not field errors, so they are left out here and used as `error` instead.
export function zodDetails(zodError) {
  return zodError.issues
    .filter((issue) => issue.path.length > 0)
    .map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
}

// Sends a 400 for a failed safeParse. `summary` is used as `error` unless Zod
// reported a whole-body problem (e.g. "No fields to update"), which is more useful.
export function sendValidationError(res, zodError, summary = 'Validation failed') {
  const bodyIssue = zodError.issues.find((issue) => issue.path.length === 0);
  const details = zodDetails(zodError);
  return res.status(400).json({
    error: bodyIssue?.message ?? summary,
    ...(details.length > 0 ? { details } : {}),
  });
}
