import { reactive } from 'vue';
import type {
  InitialSetupDraft,
  InitialSetupPreviewResponse,
  InitialSetupStateResponse,
} from '@planner-fin/shared';
import { authState, authenticatedFetch } from './auth';

export const setupState = reactive<{
  data: InitialSetupStateResponse | null;
  loading: boolean;
  saving: boolean;
  error: string;
  preview: InitialSetupPreviewResponse | null;
}>({ data: null, loading: false, saving: false, error: '', preview: null });

let confirmIdempotencyKey = '';
let setupOwnerId: string | null = null;

function clearConfirmAttempt(): void {
  confirmIdempotencyKey = '';
}

function csrf(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...init.headers,
      'Content-Type': 'application/json',
      ...(authState.csrfToken ? { 'X-CSRF-Token': authState.csrfToken } : {}),
    },
  };
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T | { error?: { message?: string } };
  const message =
    data && typeof data === 'object' && 'error' in data ? data.error?.message : undefined;
  if (!response.ok) throw new Error(message ?? fallback);
  return data as T;
}

export function resetInitialSetupMemory(): void {
  setupState.data = null;
  setupState.error = '';
  setupState.preview = null;
  setupOwnerId = null;
  clearConfirmAttempt();
}

window.addEventListener('plannerfin:auth-cleared', resetInitialSetupMemory);

export async function loadInitialSetup(): Promise<InitialSetupStateResponse | null> {
  setupState.loading = true;
  setupState.error = '';
  try {
    const data = await parse<InitialSetupStateResponse>(
      await authenticatedFetch('/users/me/setup'),
      'Nao foi possivel carregar o setup inicial.',
    );
    if (setupOwnerId !== authState.user?.id) {
      setupOwnerId = authState.user?.id ?? null;
      clearConfirmAttempt();
    }
    setupState.data = data;
    return data;
  } catch (error) {
    setupState.error =
      error instanceof Error ? error.message : 'Nao foi possivel carregar o setup inicial.';
    return null;
  } finally {
    setupState.loading = false;
  }
}

export async function saveInitialSetupDraft(draft: InitialSetupDraft) {
  setupState.saving = true;
  setupState.error = '';
  setupState.preview = null;
  clearConfirmAttempt();
  try {
    setupState.data = await parse<InitialSetupStateResponse>(
      await authenticatedFetch(
        '/users/me/setup/draft',
        csrf({
          method: 'PUT',
          body: JSON.stringify({
            expectedDraftVersion: setupState.data?.draftVersion ?? null,
            draft,
          }),
        }),
      ),
      'Nao foi possivel salvar o setup inicial.',
    );
    return setupState.data;
  } catch (error) {
    setupState.error =
      error instanceof Error ? error.message : 'Nao foi possivel salvar o setup inicial.';
    throw error;
  } finally {
    setupState.saving = false;
  }
}

export async function skipInitialSetup(): Promise<void> {
  setupState.saving = true;
  setupState.error = '';
  clearConfirmAttempt();
  try {
    await parse(
      await authenticatedFetch('/users/me/setup/skip', csrf({ method: 'POST' })),
      'Falha ao pular setup.',
    );
    await loadInitialSetup();
  } finally {
    setupState.saving = false;
  }
}

export async function previewInitialSetup(): Promise<InitialSetupPreviewResponse> {
  if (setupState.data?.draftVersion === null || setupState.data?.draftVersion === undefined)
    throw new Error('Salve o draft antes da revisao.');
  setupState.saving = true;
  setupState.error = '';
  clearConfirmAttempt();
  try {
    setupState.preview = await parse<InitialSetupPreviewResponse>(
      await authenticatedFetch(
        '/users/me/setup/preview',
        csrf({
          method: 'POST',
          body: JSON.stringify({ draftVersion: setupState.data.draftVersion }),
        }),
      ),
      'Nao foi possivel gerar o preview.',
    );
    confirmIdempotencyKey = crypto.randomUUID();
    return setupState.preview;
  } catch (error) {
    setupState.error = error instanceof Error ? error.message : 'Nao foi possivel gerar o preview.';
    throw error;
  } finally {
    setupState.saving = false;
  }
}

export async function confirmInitialSetup(): Promise<void> {
  if (!setupState.preview) throw new Error('Gere o preview antes de confirmar.');
  if (!confirmIdempotencyKey) confirmIdempotencyKey = crypto.randomUUID();
  setupState.saving = true;
  setupState.error = '';
  try {
    await parse(
      await authenticatedFetch(
        '/users/me/setup/confirm',
        csrf({
          method: 'POST',
          headers: { 'Idempotency-Key': confirmIdempotencyKey },
          body: JSON.stringify({ previewToken: setupState.preview.previewToken }),
        }),
      ),
      'Nao foi possivel confirmar o setup.',
    );
    clearConfirmAttempt();
    await loadInitialSetup();
  } catch (error) {
    setupState.error =
      error instanceof Error ? error.message : 'Nao foi possivel confirmar o setup.';
    throw error;
  } finally {
    setupState.saving = false;
  }
}
