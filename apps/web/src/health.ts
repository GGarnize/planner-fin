import type { HealthResponse } from '@planner-fin/shared';

export type HealthState = 'loading' | 'available' | 'unavailable';

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === 2 &&
    keys[0] === 'service' &&
    keys[1] === 'status' &&
    (value as HealthResponse).status === 'ok' &&
    (value as HealthResponse).service === 'planner-fin-api'
  );
}

export async function fetchHealth(
  apiBaseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<HealthState> {
  try {
    const response = await fetcher(`${apiBaseUrl}/health`);
    if (!response.ok) return 'unavailable';
    const body: unknown = await response.json();
    return isHealthResponse(body) ? 'available' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
