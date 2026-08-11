export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  return !origin || allowedOrigins.includes(origin);
}
