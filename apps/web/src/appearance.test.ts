import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadAppearance() {
  vi.resetModules();
  return import('./appearance');
}

describe('appearance visual preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-appearance');
    vi.unstubAllGlobals();
  });

  it('aplica defaults SYSTEM + BLUE e responde ao sistema', async () => {
    let dark = false;
    const listeners: Array<() => void> = [];
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return dark;
      },
      addEventListener: (_event: string, listener: () => void) => listeners.push(listener),
    }));

    const { applyVisualPreferences } = await loadAppearance();
    applyVisualPreferences({ appearance: 'SYSTEM', accent: 'BLUE' });
    expect(document.documentElement.dataset.theme).toBe('light');
    dark = true;
    listeners.forEach((listener) => listener());
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('LIGHT/DARK forcam tema e ignoram mudanca do sistema', async () => {
    let dark = false;
    const listeners: Array<() => void> = [];
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return dark;
      },
      addEventListener: (_event: string, listener: () => void) => listeners.push(listener),
    }));
    const { applyVisualPreferences } = await loadAppearance();
    applyVisualPreferences({ appearance: 'LIGHT', accent: 'TEAL' });
    dark = true;
    listeners.forEach((listener) => listener());
    expect(document.documentElement.dataset.theme).toBe('light');
    applyVisualPreferences({ appearance: 'DARK', accent: 'PURPLE' });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('cache aceita somente appearance/accent allowlisted', async () => {
    localStorage.setItem(
      'plannerfin.visual.v1',
      JSON.stringify({ appearance: 'DARK', accent: 'ORANGE' }),
    );
    const { applyCachedVisualPreferences, appearanceState } = await loadAppearance();
    applyCachedVisualPreferences();
    expect(appearanceState.current).toEqual({ appearance: 'DARK', accent: 'ORANGE' });

    localStorage.setItem(
      'plannerfin.visual.v1',
      JSON.stringify({ appearance: 'LIGHT', accent: 'BLUE', userId: 'u' }),
    );
    applyCachedVisualPreferences();
    expect(appearanceState.current).toEqual({ appearance: 'SYSTEM', accent: 'BLUE' });
    expect(localStorage.getItem('plannerfin.visual.v1')).toBeNull();
  });

  it('servidor prevalece sobre cache stale', async () => {
    localStorage.setItem(
      'plannerfin.visual.v1',
      JSON.stringify({ appearance: 'DARK', accent: 'TEAL' }),
    );
    const { applyCachedVisualPreferences, loadCanonicalPreferences, appearanceState } =
      await loadAppearance();
    applyCachedVisualPreferences();
    await loadCanonicalPreferences(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            appearance: 'LIGHT',
            accent: 'BLUE',
            updatedAt: '2026-08-12T10:00:00.000Z',
          }),
          { status: 200 },
        ),
      ),
    );
    expect(appearanceState.current).toEqual({ appearance: 'LIGHT', accent: 'BLUE' });
    expect(JSON.parse(localStorage.getItem('plannerfin.visual.v1')!)).toEqual({
      appearance: 'LIGHT',
      accent: 'BLUE',
    });
  });

  it('falha de PATCH reverte para canonico e preserva cache', async () => {
    const { applyCanonicalPreferences, saveVisualPreferences, appearanceState } =
      await loadAppearance();
    applyCanonicalPreferences({
      appearance: 'LIGHT',
      accent: 'BLUE',
      updatedAt: '2026-08-12T10:00:00.000Z',
    });
    await saveVisualPreferences({ appearance: 'DARK' }, () =>
      Promise.resolve(new Response(JSON.stringify({ error: { message: 'Falha' } }), { status: 500 })),
    );

    expect(appearanceState.current).toEqual({ appearance: 'LIGHT', accent: 'BLUE' });
    expect(appearanceState.error).toBe('Falha');
    expect(JSON.parse(localStorage.getItem('plannerfin.visual.v1')!)).toEqual({
      appearance: 'LIGHT',
      accent: 'BLUE',
    });
  });

  it('sucesso PATCH aplica resposta canonica e quatro accents sao suportados', async () => {
    const { saveVisualPreferences, appearanceState } = await loadAppearance();
    for (const accent of ['BLUE', 'TEAL', 'PURPLE', 'ORANGE'] as const) {
      await saveVisualPreferences({ accent }, () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              appearance: 'SYSTEM',
              accent,
              updatedAt: '2026-08-12T10:00:00.000Z',
            }),
            { status: 200 },
          ),
        ),
      );
      expect(appearanceState.current.accent).toBe(accent);
      expect(document.documentElement.dataset.accent).toBe(accent);
    }
  });

  it('reset de logout limpa cache e volta ao publico', async () => {
    const { applyCanonicalPreferences, resetPublicVisualPreferences, appearanceState } =
      await loadAppearance();
    applyCanonicalPreferences({
      appearance: 'DARK',
      accent: 'PURPLE',
      updatedAt: '2026-08-12T10:00:00.000Z',
    });
    resetPublicVisualPreferences();
    expect(appearanceState.current).toEqual({ appearance: 'SYSTEM', accent: 'BLUE' });
    expect(localStorage.getItem('plannerfin.visual.v1')).toBeNull();
  });
});
