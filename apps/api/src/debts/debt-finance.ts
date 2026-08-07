import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, type DebtInstallment, type DebtPayment } from '@prisma/client';
import type {
  DebtInstallmentInput,
  DebtProjections,
  PublicDebtInstallment,
} from '@planner-fin/shared';
import { isCivilDate } from '../accounts/dto';
export const civilDate = (v: string) => new Date(`${v}T00:00:00.000Z`);
export const civilString = (v: Date) => v.toISOString().slice(0, 10);
export const installmentTotal = (x: {
  principalAmount: Prisma.Decimal;
  interestAmount: Prisma.Decimal;
  feeAmount: Prisma.Decimal;
}) => x.principalAmount.plus(x.interestAmount).plus(x.feeAmount);
export const publicInstallment = (x: DebtInstallment, today: string): PublicDebtInstallment => ({
  id: x.id,
  installmentNumber: x.installmentNumber,
  dueDate: civilString(x.dueDate),
  principalAmount: x.principalAmount.toFixed(2),
  interestAmount: x.interestAmount.toFixed(2),
  feeAmount: x.feeAmount.toFixed(2),
  totalAmount: installmentTotal(x).toFixed(2),
  status: x.status,
  isOverdue: x.status === 'PENDING' && civilString(x.dueDate) < today,
  createdAt: x.createdAt.toISOString(),
  updatedAt: x.updatedAt.toISOString(),
});
export function validateAggregate(dto: {
  type: string;
  originalPrincipal: string;
  startDate: string;
  installmentCount: number;
  installments: DebtInstallmentInput[];
  funding?: { amount: string };
}) {
  const fail = (message: string) => {
    throw new UnprocessableEntityException({ code: 'INVALID_DEBT_AGGREGATE', message });
  };
  if (!isCivilDate(dto.startDate) || dto.installments.some((x) => !isCivilDate(x.dueDate)))
    fail('Informe datas civis válidas.');
  if (dto.installments.length !== dto.installmentCount)
    fail('O cronograma deve conter exatamente a quantidade de parcelas informada.');
  let sum = new Prisma.Decimal(0),
    previous = '';
  dto.installments.forEach((x, i) => {
    if (x.installmentNumber !== i + 1) fail('Numere as parcelas em sequência de 1 a N.');
    if (x.dueDate < dto.startDate || (previous && x.dueDate <= previous))
      fail('As datas devem ser crescentes e posteriores ao início.');
    previous = x.dueDate;
    sum = sum.plus(x.principalAmount);
  });
  if (!sum.equals(dto.originalPrincipal))
    fail('A soma do principal das parcelas deve ser igual ao principal original.');
  if (dto.type === 'LOAN') {
    if (!dto.funding) fail('Empréstimo exige funding integral.');
    if (!new Prisma.Decimal(dto.funding!.amount).equals(dto.originalPrincipal))
      fail('O funding deve ser igual ao principal original.');
  } else if (dto.funding) fail('Funding é permitido somente para empréstimo.');
}
export function projections(
  original: Prisma.Decimal,
  installments: DebtInstallment[],
  payments: DebtPayment[],
  today: string,
): DebtProjections {
  const paidPrincipal = payments.reduce((s, x) => s.plus(x.principalAmount), new Prisma.Decimal(0));
  const paidInterest = payments.reduce((s, x) => s.plus(x.interestAmount), new Prisma.Decimal(0));
  const paidFee = payments.reduce((s, x) => s.plus(x.feeAmount), new Prisma.Decimal(0));
  const pending = installments.filter((x) => x.status === 'PENDING');
  const pendingInterest = pending.reduce((s, x) => s.plus(x.interestAmount), new Prisma.Decimal(0));
  const pendingFee = pending.reduce((s, x) => s.plus(x.feeAmount), new Prisma.Decimal(0));
  const next = [...pending].sort(
    (a, b) =>
      civilString(a.dueDate).localeCompare(civilString(b.dueDate)) ||
      a.installmentNumber - b.installmentNumber,
  )[0];
  return {
    outstandingPrincipal: original.minus(paidPrincipal).toFixed(2),
    paidPrincipal: paidPrincipal.toFixed(2),
    paidInterestAmount: paidInterest.toFixed(2),
    paidFeeAmount: paidFee.toFixed(2),
    pendingInterestAmount: pendingInterest.toFixed(2),
    pendingFeeAmount: pendingFee.toFixed(2),
    totalFutureAmount: pending
      .reduce((s, x) => s.plus(installmentTotal(x)), new Prisma.Decimal(0))
      .toFixed(2),
    paidInstallmentCount: installments.length - pending.length,
    pendingInstallmentCount: pending.length,
    overdueInstallmentCount: pending.filter((x) => civilString(x.dueDate) < today).length,
    nextInstallment: next ? publicInstallment(next, today) : null,
    projectedStatus: pending.length ? 'ACTIVE' : 'PAID_OFF',
  };
}
export const invalidUuid = (id: string) =>
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function requireCivil(value: string, field: string) {
  if (!isCivilDate(value))
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${field} inválida.` });
}
