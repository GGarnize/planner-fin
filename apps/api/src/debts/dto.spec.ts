import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateDebtDto, DebtFundingDto, PayDebtInstallmentDto } from './dto';

const valid = {
  type: 'FINANCING',
  creditorName: 'Credor fictício',
  description: ' Contrato válido ',
  originalPrincipal: '10.00',
  startDate: '2028-02-29',
  installmentCount: 1,
  installments: [
    {
      installmentNumber: 1,
      dueDate: '2028-03-29',
      principalAmount: '10.00',
      interestAmount: '0.00',
      feeAmount: '0.00',
    },
  ],
};

describe('contrato público de dívidas', () => {
  it.each([undefined, '', ' '])(
    'rejeita description ausente ou vazia (%j)',
    async (description) => {
      const value = { ...valid, description };
      if (description === undefined) delete value.description;
      const errors = await validate(plainToInstance(CreateDebtDto, value));
      expect(errors.some((error) => error.property === 'description')).toBe(true);
    },
  );

  it('aceita e trima description não vazia', async () => {
    const dto = plainToInstance(CreateDebtDto, valid);
    expect(await validate(dto)).toEqual([]);
    expect(dto.description).toBe('Contrato válido');
  });

  it.each([DebtFundingDto, PayDebtInstallmentDto])(
    'rejeita UUID apenas parecido e aceita UUID real em %s',
    async (Dto) => {
      const Contract = Dto as typeof DebtFundingDto;
      const malformed = plainToInstance(Contract, {
        accountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        amount: '10.00',
        fundingDate: '2028-02-29',
        paymentDate: '2028-02-29',
      });
      expect((await validate(malformed)).some((error) => error.property === 'accountId')).toBe(
        true,
      );
      const uuid = plainToInstance(Contract, {
        ...malformed,
        accountId: '00000000-0000-4000-8000-000000000001',
      });
      expect((await validate(uuid)).some((error) => error.property === 'accountId')).toBe(false);
    },
  );
});
