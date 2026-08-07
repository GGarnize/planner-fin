import { describe, expect, it } from 'vitest';
import { createCardCursor, paginationFingerprint, readCardCursor } from './card-pagination';

describe('cursor opaco de cartões', () => {
  it('autentica e vincula o cursor aos filtros e limite', () => {
    const fingerprint = paginationFingerprint({ cardId: 'card', limit: '20' }, 20);
    const cursor = createCardCursor({ key: '2026-08-07', id: 'id', fingerprint }, 'secret');
    expect(readCardCursor(cursor, 'secret', fingerprint).key).toBe('2026-08-07');
    expect(() => readCardCursor(`${cursor}x`, 'secret', fingerprint)).toThrow('Reinicie');
    expect(() => readCardCursor(cursor, 'secret', paginationFingerprint({}, 20))).toThrow(
      'Reinicie',
    );
  });
});
