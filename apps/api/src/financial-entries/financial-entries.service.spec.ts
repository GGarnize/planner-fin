import { describe, expect, it, vi } from 'vitest';
import { FinancialEntriesService } from './financial-entries.service';

function service() {
  const prisma = { $queryRaw: vi.fn() };
  return new FinancialEntriesService(prisma as never, { jwtSecret: 'x'.repeat(32) } as never);
}

describe('validação do feed unificado de lançamentos', () => {
  it.each(['0', '101', 'abc', '-1'])('rejeita limit inválido (%s)', async (limit) => {
    await expect(service().list('owner', { limit })).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    ['dueDateFrom', { dueDateFrom: '2026-08-31', dueDateTo: '2026-08-01' }],
    ['paidAtFrom', { paidAtFrom: '2026-08-31', paidAtTo: '2026-08-01' }],
  ])('rejeita intervalo de %s invertido', async (_, query) => {
    await expect(service().list('owner', query)).rejects.toMatchObject({ status: 400 });
  });

  it.each(['2026-13-01', '2026-02-30', 'not-a-date'])(
    'rejeita data civil inexistente (%s)',
    async (date) => {
      await expect(service().list('owner', { dueDateFrom: date })).rejects.toMatchObject({
        status: 400,
      });
    },
  );

  it('rejeita cursor malformado antes de consultar o banco', async () => {
    const s = service();
    await expect(s.list('owner', { cursor: 'garbage' })).rejects.toMatchObject({
      response: { code: 'INVALID_CURSOR' },
    });
  });
});
