import { reactive } from 'vue';
import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest } from '@planner-fin/shared';
import {
  applyCachedVisualPreferences,
  loadCanonicalPreferences,
  resetPublicVisualPreferences,
} from './appearance';
import { flushAndroidCookies, isAndroidNative } from './mobile';

export function resolveApiBaseUrl(raw = import.meta.env.VITE_API_BASE_URL): string {
  const value = raw?.trim() || 'http://localhost:3000/api';
  if (!isAndroidNative()) return value.replace(/\/$/, '');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('VITE_API_BASE_URL deve ser absoluta no Android.');
  }
  if (url.pathname.replace(/\/$/, '') !== '/api')
    throw new Error('VITE_API_BASE_URL deve apontar para /api no Android.');
  if (url.protocol !== 'https:' && import.meta.env.MODE !== 'development')
    throw new Error('VITE_API_BASE_URL Android exige HTTPS fora de debug.');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname))
    throw new Error('HTTP em Android debug exige host explicitamente autorizado.');
  return url.toString().replace(/\/$/, '');
}

const api = resolveApiBaseUrl();
export const authState = reactive<{
  token: string | null;
  csrfToken: string;
  user: PublicUser | null;
  restoring: boolean;
  error: string;
}>({ token: null, csrfToken: '', user: null, restoring: true, error: '' });

let refreshPromise: Promise<void> | null = null;

async function bootstrapCsrf(): Promise<string> {
  const response = await fetch(`${api}/auth/csrf`, { credentials: 'include' });
  const data = (await response.json().catch(() => ({}))) as { csrfToken?: string };
  if (!response.ok || !data.csrfToken) throw new Error('Não foi possível iniciar a sessão segura.');
  authState.csrfToken = data.csrfToken;
  await flushAndroidCookies();
  return data.csrfToken;
}

async function requestAuth(path: string, body?: object): Promise<AuthResponse> {
  let response: Response;
  try {
    if ((path === 'refresh' || path === 'logout') && !authState.csrfToken) await bootstrapCsrf();
    response = await fetch(`${api}/auth/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(authState.csrfToken ? { 'X-CSRF-Token': authState.csrfToken } : {}),
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
  authState.csrfToken = (data as AuthResponse).csrfToken;
  authState.user = (data as AuthResponse).user;
  await flushAndroidCookies();
  try {
    await loadCanonicalPreferences((preferencesPath, init) =>
      fetch(`${api}${preferencesPath}`, {
        ...init,
        credentials: 'include',
        headers: { ...init?.headers, Authorization: `Bearer ${authState.token ?? ''}` },
      }),
    );
  } catch {
    // A tela autenticada pode abrir com cache/default e mensagem de recuperacao em Minha Conta.
  }
  return data as AuthResponse;
}
export const register = (data: RegisterRequest) => {
  resetPublicVisualPreferences();
  return requestAuth('register', data);
};
export const login = (data: LoginRequest) => {
  resetPublicVisualPreferences();
  return requestAuth('login', data);
};
export async function restore(): Promise<void> {
  authState.restoring = true;
  applyCachedVisualPreferences();
  try {
    await bootstrapCsrf();
    await requestAuth('refresh');
  } catch {
    authState.token = null;
    authState.user = null;
    resetPublicVisualPreferences();
  } finally {
    authState.restoring = false;
  }
}
export async function logout(): Promise<void> {
  try {
    if (!authState.csrfToken) await bootstrapCsrf();
    await fetch(`${api}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${authState.token ?? ''}`,
        'X-CSRF-Token': authState.csrfToken,
        'Content-Type': 'application/json',
      },
    });
    await flushAndroidCookies();
  } catch {
    authState.error = 'A revogação da sessão não pôde ser confirmada.';
  } finally {
    authState.token = null;
    authState.csrfToken = '';
    authState.user = null;
    resetPublicVisualPreferences();
    window.dispatchEvent(new Event('plannerfin:auth-cleared'));
  }
}
async function refreshOnce(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      await bootstrapCsrf();
      await requestAuth('refresh');
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const retryAllowed = method === 'GET' || method === 'HEAD';
  const headers = { ...init.headers, Authorization: `Bearer ${authState.token ?? ''}` };
  let response = await fetch(`${api}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (response.status === 401 && retryAllowed) {
    try {
      await refreshOnce();
    } catch {
      authState.token = null;
      authState.user = null;
      return response;
    }
    response = await fetch(`${api}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${authState.token ?? ''}` },
      credentials: 'include',
    });
    if (response.status === 401) {
      authState.token = null;
      authState.user = null;
    }
  }
  return response;
}
