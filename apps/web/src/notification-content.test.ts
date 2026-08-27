import { describe, expect, it } from 'vitest';
import { visibleNotificationTexts } from './notification-content';

describe('visibleNotificationTexts', () => {
  it('remove duplicidade após normalizar espaços', () => {
    expect(visibleNotificationTexts('Compra aprovada', '  Compra   aprovada\n')).toEqual([
      'Compra aprovada',
    ]);
  });

  it('prefere a versão mais completa quando uma contém a outra', () => {
    expect(
      visibleNotificationTexts('Compra aprovada', 'Compra aprovada no valor de R$ 42,90.'),
    ).toEqual(['Compra aprovada no valor de R$ 42,90.']);
  });

  it('mantém os dois textos quando eles agregam informações diferentes', () => {
    expect(visibleNotificationTexts('Compra aprovada', 'Cartão final 1234')).toEqual([
      'Compra aprovada',
      'Cartão final 1234',
    ]);
  });
});
