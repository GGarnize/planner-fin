export function safeApiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object' || !('error' in body)) return fallback;
  const error = body.error;
  if (!error || typeof error !== 'object') return fallback;
  const details = 'details' in error && Array.isArray(error.details) ? error.details : [];
  const detail = details.find((item): item is { message: string } =>
    Boolean(
      item &&
      typeof item === 'object' &&
      'message' in item &&
      typeof item.message === 'string' &&
      item.message,
    ),
  );
  if (detail) return detail.message;
  return 'message' in error && typeof error.message === 'string' && error.message
    ? error.message
    : fallback;
}
