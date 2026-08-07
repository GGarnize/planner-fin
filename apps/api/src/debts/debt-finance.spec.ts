import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { installmentTotal, projections, validateAggregate } from './debt-finance';
const date = (s: string) => new Date(`${s}T00:00:00Z`);
const installment = (
  n: number,
  due: string,
  status: 'PENDING' | 'PAID' = 'PENDING',
  p = '50.00',
  i = '2.00',
  f = '1.00',
) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  debtId: 'd',
  installmentNumber: n,
  dueDate: date(due),
  principalAmount: new Prisma.Decimal(p),
  interestAmount: new Prisma.Decimal(i),
  feeAmount: new Prisma.Decimal(f),
  status,
  createdAt: new Date(),
  updatedAt: new Date(),
});
const payment = (n: number, p = '50.00', i = '2.00', f = '1.00') => ({
  id: `p${n}`,
  userId: 'u',
  debtId: 'd',
  installmentId: `i${n}`,
  accountId: 'a',
  paymentDate: date('2026-08-01'),
  principalAmount: new Prisma.Decimal(p),
  interestAmount: new Prisma.Decimal(i),
  feeAmount: new Prisma.Decimal(f),
  createdAt: new Date(),
});
describe('finanças de dívidas', () => {
  it('soma o total exato sem float', () =>
    expect(installmentTotal(installment(1, '2026-09-01')).toFixed(2)).toBe('53.00'));
  it('valida sequência, datas, soma e funding integral por tipo', () => {
    const base = {
      type: 'LOAN',
      originalPrincipal: '100.00',
      startDate: '2026-08-01',
      installmentCount: 2,
      installments: [
        {
          installmentNumber: 1,
          dueDate: '2026-09-01',
          principalAmount: '50.00',
          interestAmount: '1.00',
          feeAmount: '0.00',
        },
        {
          installmentNumber: 2,
          dueDate: '2026-10-01',
          principalAmount: '50.00',
          interestAmount: '1.00',
          feeAmount: '0.00',
        },
      ],
      funding: { accountId: 'a', amount: '100.00', fundingDate: '2026-08-01' },
    };
    expect(() => validateAggregate(base)).not.toThrow();
    expect(() => validateAggregate({ ...base, funding: undefined })).toThrow('funding integral');
    expect(() => validateAggregate({ ...base, type: 'FINANCING' })).toThrow('somente');
    expect(() =>
      validateAggregate({ ...base, installments: [base.installments[1]!, base.installments[0]!] }),
    ).toThrow('sequência');
    expect(() =>
      validateAggregate({
        ...base,
        originalPrincipal: '99.00',
        funding: { ...base.funding, amount: '99.00' },
      }),
    ).toThrow('soma');
  });
  it('deriva outstanding, custos, overdue, hoje e próxima parcela', () => {
    const rows = [
      installment(1, '2026-07-31', 'PAID'),
      installment(2, '2026-08-07'),
      installment(3, '2026-08-08'),
    ];
    const p = projections(new Prisma.Decimal('150'), rows, [payment(1)], '2026-08-07');
    expect(p).toMatchObject({
      outstandingPrincipal: '100.00',
      paidPrincipal: '50.00',
      paidInterestAmount: '2.00',
      paidFeeAmount: '1.00',
      pendingInterestAmount: '4.00',
      pendingFeeAmount: '2.00',
      totalFutureAmount: '106.00',
      paidInstallmentCount: 1,
      pendingInstallmentCount: 2,
      overdueInstallmentCount: 0,
      projectedStatus: 'ACTIVE',
    });
    expect(p.nextInstallment?.installmentNumber).toBe(2);
    expect(p.nextInstallment?.isOverdue).toBe(false);
  });
  it('PAID nunca fica overdue e última parcela projeta PAID_OFF', () => {
    const p = projections(
      new Prisma.Decimal('50'),
      [installment(1, '2020-01-01', 'PAID')],
      [payment(1)],
      '2026-08-07',
    );
    expect(p.overdueInstallmentCount).toBe(0);
    expect(p.projectedStatus).toBe('PAID_OFF');
    expect(p.nextInstallment).toBeNull();
  });
  it('mantém principal fora do custo: custo realizado é somente juros e tarifa uma vez', () => {
    const p = projections(
      new Prisma.Decimal('50'),
      [installment(1, '2026-01-01', 'PAID')],
      [payment(1, '50', '2', '1')],
      '2026-08-07',
    );
    expect(new Prisma.Decimal(p.paidInterestAmount).plus(p.paidFeeAmount).toFixed(2)).toBe('3.00');
    expect(p.paidPrincipal).toBe('50.00');
  });
});
