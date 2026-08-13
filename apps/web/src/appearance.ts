import { reactive } from 'vue';
import type {
  UpdateUserPreferencesRequest,
  UserAccent,
  UserAppearance,
  UserPreferencesResponse,
} from '@planner-fin/shared';

export const APPEARANCES: Array<{ value: UserAppearance; label: string; description: string }> = [
  { value: 'SYSTEM', label: 'Sistema', description: 'Acompanha claro ou escuro do dispositivo.' },
  { value: 'LIGHT', label: 'Claro', description: 'Mantem o app em tema claro.' },
  { value: 'DARK', label: 'Escuro', description: 'Mantem o app em tema escuro.' },
];
export const ACCENTS: Array<{ value: UserAccent; label: string }> = [
  { value: 'BLUE', label: 'Azul' },
  { value: 'TEAL', label: 'Verde-azulado' },
  { value: 'PURPLE', label: 'Violeta' },
  { value: 'ORANGE', label: 'Laranja' },
];

const DEFAULTS = { appearance: 'SYSTEM' as const, accent: 'BLUE' as const };
const CACHE_KEY = 'plannerfin.visual.v1';
const appearanceValues = new Set(APPEARANCES.map((item) => item.value));
const accentValues = new Set(ACCENTS.map((item) => item.value));

export type VisualPreferences = Pick<UserPreferencesResponse, 'appearance' | 'accent'>;

export const appearanceState = reactive<{
  current: VisualPreferences;
  canonical: UserPreferencesResponse | null;
  loading: boolean;
  saving: boolean;
  error: string;
  savedMessage: string;
}>({
  current: { ...DEFAULTS },
  canonical: null,
  loading: false,
  saving: false,
  error: '',
  savedMessage: '',
});

function isVisual(value: unknown): value is VisualPreferences {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return (
    keys.length === 2 &&
    keys.every((key) => key === 'appearance' || key === 'accent') &&
    typeof record.appearance === 'string' &&
    typeof record.accent === 'string' &&
    appearanceValues.has(record.appearance as UserAppearance) &&
    accentValues.has(record.accent as UserAccent)
  );
}

function readCache(): VisualPreferences | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as unknown;
    if (isVisual(parsed)) return parsed;
    if (parsed !== null) localStorage.removeItem(CACHE_KEY);
  } catch {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // O cache visual e opcional; falhas de storage nao devem bloquear a UI.
    }
  }
  return null;
}

function writeCache(value: VisualPreferences): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // O servidor continua sendo a fonte canonica.
  }
}

export function clearVisualCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // O cache visual e opcional.
  }
}

const media =
  typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function resolveTheme(appearance: UserAppearance): 'light' | 'dark' {
  if (appearance === 'DARK') return 'dark';
  if (appearance === 'LIGHT') return 'light';
  return media?.matches ? 'dark' : 'light';
}

export function applyVisualPreferences(value: VisualPreferences): void {
  appearanceState.current = { appearance: value.appearance, accent: value.accent };
  const root = document.documentElement;
  const resolved = resolveTheme(value.appearance);
  root.dataset.appearance = value.appearance;
  root.dataset.accent = value.accent;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

export function applyCachedVisualPreferences(): void {
  applyVisualPreferences(readCache() ?? DEFAULTS);
}

export function applyCanonicalPreferences(value: UserPreferencesResponse): void {
  appearanceState.canonical = value;
  appearanceState.error = '';
  applyVisualPreferences(value);
  writeCache({ appearance: value.appearance, accent: value.accent });
}

export function resetPublicVisualPreferences(): void {
  appearanceState.canonical = null;
  appearanceState.error = '';
  appearanceState.savedMessage = '';
  clearVisualCache();
  applyVisualPreferences(DEFAULTS);
}

export async function loadCanonicalPreferences(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<UserPreferencesResponse> {
  appearanceState.loading = true;
  appearanceState.error = '';
  try {
    const response = await fetcher('/users/me/preferences');
    const data = (await response.json().catch(() => ({}))) as
      | UserPreferencesResponse
      | { error?: { message?: string } };
    if (!response.ok || !('appearance' in data))
      throw new Error(
        'error' in data
          ? (data.error?.message ?? 'Nao foi possivel carregar as preferencias.')
          : 'Nao foi possivel carregar as preferencias.',
      );
    applyCanonicalPreferences(data);
    return data;
  } catch (error) {
    appearanceState.error =
      error instanceof Error ? error.message : 'Nao foi possivel carregar as preferencias.';
    throw error;
  } finally {
    appearanceState.loading = false;
  }
}

let saveRequest = 0;
let saveChain = Promise.resolve();

export async function saveVisualPreferences(
  patch: UpdateUserPreferencesRequest,
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const next = { ...appearanceState.current, ...patch };
  applyVisualPreferences(next);
  appearanceState.saving = true;
  appearanceState.error = '';
  appearanceState.savedMessage = '';
  const request = ++saveRequest;
  saveChain = saveChain.catch(() => undefined).then(async () => {
    const intended = { ...appearanceState.current };
    const response = await fetcher('/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(intended),
    });
    const data = (await response.json().catch(() => ({}))) as
      | UserPreferencesResponse
      | { error?: { message?: string } };
    if (!response.ok || !('appearance' in data))
      throw new Error(
        'error' in data
          ? (data.error?.message ?? 'Nao foi possivel salvar as preferencias.')
          : 'Nao foi possivel salvar as preferencias.',
      );
    if (request === saveRequest) {
      applyCanonicalPreferences(data);
      appearanceState.savedMessage = 'Preferencias de aparencia salvas.';
    }
  });
  try {
    await saveChain;
  } catch (error) {
    if (request === saveRequest) {
      appearanceState.error =
        error instanceof Error ? error.message : 'Nao foi possivel salvar as preferencias.';
      const fallback = appearanceState.canonical ?? { ...DEFAULTS, updatedAt: new Date(0).toISOString() };
      applyVisualPreferences(fallback);
    }
  } finally {
    if (request === saveRequest) appearanceState.saving = false;
  }
}

media?.addEventListener('change', () => {
  if (appearanceState.current.appearance === 'SYSTEM') applyVisualPreferences(appearanceState.current);
});

applyCachedVisualPreferences();
