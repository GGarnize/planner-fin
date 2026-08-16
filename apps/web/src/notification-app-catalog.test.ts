import { describe, expect, it } from 'vitest';
import { catalogLabelFor, NOTIFICATION_APP_CATALOG } from './notification-app-catalog';

describe('notification-app-catalog', () => {
  it('usa o packageName oficial do Banrisul (br.com.banrisul)', () => {
    const banrisul = NOTIFICATION_APP_CATALOG.find((entry) => entry.label === 'Banrisul');
    expect(banrisul?.packageName).toBe('br.com.banrisul');
  });

  it('mantém Nubank e C6 Bank com os packageNames esperados', () => {
    expect(catalogLabelFor('com.nu.production')).toBe('Nubank');
    expect(catalogLabelFor('com.c6bank.app')).toBe('C6 Bank');
  });

  it('não expõe nenhum packageName fora do catálogo versionado', () => {
    expect(catalogLabelFor('com.whatsapp')).toBeNull();
  });
});
