import { reactive } from 'vue';
import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest } from '@planner-fin/shared';

const api = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
export const authState = reactive<{
  token: string | null;
  user: PublicUser | null;
  restoring: boolean;
  error: string;
}>({ token: null, user: null, restoring: true, error: '' });
const csrf = (): string =>
  decodeURIComponent(
    document.cookie
      .split('; ')
      .find((item) => item.startsWith('planner_fin_csrf='))
      ?.split('=')[1] ?? '',
  );

async function requestAuth(path: string, body?: object): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${api}/auth/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf() ? { 'X-CSRF-Token': csrf() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('API indisponível. Tente novamente.');
  }
  const data = (await response.json().catch(() => ({}))) as
    { error?: { message?: string } } | AuthResponse;
  if (!response.ok)
    throw new Error(
      'error' in data
        ? (data.error?.message ?? 'Não foi possível continuar.')
        : 'Não foi possível continuar.',
    );
  authState.token = (data as AuthResponse).accessToken;
  authState.user = (data as AuthResponse).user;
  return data as AuthResponse;
}
export const register = (data: RegisterRequest) => requestAuth('register', data);
export const login = (data: LoginRequest) => requestAuth('login', data);
export async function restore(): Promise<void> {
  authState.restoring = true;
  try {
    await requestAuth('refresh');
  } catch {
    authState.token = null;
    authState.user = null;
  } finally {
    authState.restoring = false;
  }
}
export async function logout(): Promise<void> {
  try {
    await fetch(`${api}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${authState.token ?? ''}`,
        'X-CSRF-Token': csrf(),
        'Content-Type': 'application/json',
      },
    });
  } catch {
    authState.error = 'A revogação da sessão não pôde ser confirmada.';
  } finally {
    authState.token = null;
    authState.user = null;
  }
}
export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...init.headers, Authorization: `Bearer ${authState.token ?? ''}` };
  let response = await fetch(`${api}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (response.status === 401) {
    await requestAuth('refresh');
    response = await fetch(`${api}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${authState.token ?? ''}` },
      credentials: 'include',
    });
  }
  return response;
}
