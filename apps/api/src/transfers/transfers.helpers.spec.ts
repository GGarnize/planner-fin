import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateTransferDto, isCivilDate, isMoney } from './dto';
import { publicTransfer, realizedBalance, readCursor, signCursor } from './transfers.helpers';
const source = '11111111-1111-4111-8111-111111111111',
  destination = '22222222-2222-4222-8222-222222222222';
const valid = {
  sourceAccountId: source,
  destinationAccountId: destination,
  status: 'PENDING',
  description: ' Reserva ',
  plannedAmount: '10.00',
  dueDate: '2026-08-07',
};
const row = (extra = {}) => ({
  id: source,
  userId: destination,
  sourceAccountId: source,
  destinationAccountId: destination,
  status: 'PENDING' as const,
  description: 'Reserva',
  notes: null,
  plannedAmount: new Prisma.Decimal('10'),
  actualAmount: null,
  dueDate: new Date('2026-08-06'),
  completedAt: null,
  createdAt: new Date('2026-08-07'),
  updatedAt: new Date('2026-08-07'),
  ...extra,
});
describe('regras de transferências', () => {
  it.each(['0.01', '1.0', '99999999999999999.99'])('aceita decimal %s', (v) =>
    expect(isMoney(v)).toBe(true),
  );
  it.each([
    1,
    '0.00',
    '-1.00',
    '+1.00',
    '1',
    '01.00',
    '1.001',
    '1e2',
    '1,00',
    '100000000000000000.00',
  ])('rejeita decimal %s', (v) => expect(isMoney(v)).toBe(false));
  it('valida DTO, textos e datas gregorianas', async () => {
    expect(await validate(plainToInstance(CreateTransferDto, valid))).toHaveLength(0);
    expect(
      (await validate(plainToInstance(CreateTransferDto, { ...valid, description: 'x\ny' })))
        .length,
    ).toBeGreaterThan(0);
    expect(isCivilDate('2028-02-29')).toBe(true);
    expect(isCivilDate('2027-02-29')).toBe(false);
  });
  it('projeta duas casas, sem owner, e deriva vencimento com relógio controlado', () => {
    const result = publicTransfer(row() as never, '2026-08-07');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('type');
    expect(result.plannedAmount).toBe('10.00');
    expect(result.isOverdue).toBe(true);
    expect(
      publicTransfer(row({ dueDate: new Date('2026-08-07') }) as never, '2026-08-07').isOverdue,
    ).toBe(false);
  });
  it('aplica sinais opostos e preserva patrimônio', () => {
    const rows = [row({ status: 'COMPLETED', actualAmount: new Prisma.Decimal('25') })];
    const origin = realizedBalance(new Prisma.Decimal('100'), source, rows as never);
    const target = realizedBalance(new Prisma.Decimal('50'), destination, rows as never);
    expect(origin.toFixed(2)).toBe('75.00');
    expect(target.toFixed(2)).toBe('75.00');
    expect(origin.plus(target).toFixed(2)).toBe('150.00');
    expect(realizedBalance(new Prisma.Decimal('100'), source, [row()] as never).toFixed(2)).toBe(
      '100.00',
    );
  });
  it('assina cursor e o vincula aos filtros', () => {
    const data = {
      dueDate: '2026-08-07',
      createdAt: '2026-08-07T00:00:00.000Z',
      id: source,
      fingerprint: 'f',
    };
    const token = signCursor(data, 'segredo');
    expect(readCursor(token, 'segredo', 'f')).toEqual(data);
    expect(() => readCursor(token + 'x', 'segredo', 'f')).toThrow();
    expect(() => readCursor(token, 'segredo', 'outro')).toThrow();
  });
});
