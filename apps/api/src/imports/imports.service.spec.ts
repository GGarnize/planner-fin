import { describe, expect, it, vi } from 'vitest';
import { ImportsService } from './imports.service';

const id = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

function prismaFor(session: Record<string, unknown>) {
  return {
    importSession: {
      findFirst: vi.fn().mockResolvedValue(session),
      findMany: vi.fn(),
    },
    importRow: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

const session = (extra: Record<string, unknown> = {}) => ({
  id,
  userId,
  accountId: '33333333-3333-4333-8333-333333333333',
  format: 'CSV',
  status: 'MAPPING_REQUIRED',
  draftVersion: 1,
  displayFileName: 'extrato.csv',
  rowCount: 2,
  expiresAt: new Date('2099-01-01T00:00:00Z'),
  mapping: null,
  sourceData: [
    ['<b>Data</b>', '=Descrição', 'Valor'],
    ['01/08/2026\u0000', '<script>SUPERMERCADO</script>', '-123,45'],
    ['02/08/2026', 'A'.repeat(100), '+10,00'],
  ],
  ...extra,
});

describe('ImportsService: amostra CSV e drafts abertos', () => {
  it('expõe amostra mínima sanitizada sem campos internos e sem renovar TTL', async () => {
    const prisma = prismaFor(session());
    const service = new ImportsService(prisma as never);
    const result = await service.get(userId, id, 100, 0, 'all');

    expect(result.csvSample).toMatchObject({
      rowCount: 2,
      columns: [
        { index: 0, header: 'Data', samples: ['01/08/2026', '02/08/2026'] },
        { index: 1, header: '’=Descrição', samples: ['SUPERMERCADO', 'A'.repeat(80)] },
        { index: 2, header: 'Valor', samples: ['’-123,45', '’+10,00'] },
      ],
    });
    expect(result.csvSample!.columns[1]!.samples[1]).toHaveLength(80);
    expect(result).not.toHaveProperty('sourceData');
    expect(result).not.toHaveProperty('fileHash');
    expect(prisma.importSession.findFirst).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['OFX', 'READY_FOR_REVIEW'],
    ['CSV', 'CONFIRMED'],
  ])('não expõe sample para formato %s em status %s', async (format, status) => {
    const service = new ImportsService(prismaFor(session({ format, status })) as never);
    expect(await service.get(userId, id, 100, 0, 'all')).not.toHaveProperty('csvSample');
  });

  it('lista somente metadados retomáveis do owner na ordem solicitada', async () => {
    const prisma = prismaFor(session());
    prisma.importSession.findMany.mockResolvedValue([
      {
        id,
        format: 'CSV',
        status: 'MAPPING_REQUIRED',
        accountId: '33333333-3333-4333-8333-333333333333',
        displayFileName: 'extrato.csv',
        draftVersion: 1,
        updatedAt: new Date('2026-08-13T12:34:00Z'),
        expiresAt: new Date('2026-08-20T12:34:00Z'),
      },
    ]);
    const result = await new ImportsService(prisma as never).listOpen(userId, 'open');

    expect(prisma.importSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          status: { in: ['UPLOADED', 'MAPPING_REQUIRED', 'READY_FOR_REVIEW'] },
        }),
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(Object.keys(result[0]!)).toEqual([
      'id',
      'format',
      'status',
      'accountId',
      'displayFileName',
      'draftVersion',
      'updatedAt',
      'expiresAt',
    ]);
  });
});
