// Every API error response has one shape (see backend/services/apiErrors.js):
//   { error: string, details?: [{ field, message }] }

export type ApiErrorDetail = { field: string; message: string }

export type ApiErrorBody = {
  error?: string
  details?: ApiErrorDetail[]
}

// Reads an error body without trusting its shape: anything that isn't the
// documented shape is ignored rather than crashing the form.
export function parseApiError(body: unknown): { error?: string; details: ApiErrorDetail[] } {
  if (!body || typeof body !== 'object') return { details: [] }
  const { error, details } = body as { error?: unknown; details?: unknown }
  return {
    error: typeof error === 'string' && error ? error : undefined,
    details: Array.isArray(details)
      ? details.filter(
          (d): d is ApiErrorDetail =>
            !!d && typeof d === 'object' && typeof d.field === 'string' && typeof d.message === 'string',
        )
      : [],
  }
}

// One message for a form that shows a single error: the first field problem,
// else the summary, else `fallback`.
export function firstErrorMessage(body: unknown, fallback: string) {
  const { error, details } = parseApiError(body)
  return details[0]?.message ?? error ?? fallback
}

// Same as firstErrorMessage, for a failed Response. Plain text, HTML (e.g. a
// proxy error page) or an empty body fall back to `fallback`.
export async function readErrorMessage(res: Response, fallback: string) {
  if (!res.headers.get('content-type')?.includes('application/json')) return fallback
  try {
    return firstErrorMessage(await res.json(), fallback)
  } catch {
    return fallback
  }
}
