import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateTransactionTemplateDto } from './dto';
const valid = {
  name: ' Aluguel ',
  type: 'EXPENSE',
  categoryId: '11111111-1111-4111-8111-111111111111',
  description: ' Moradia ',
  plannedAmount: '1800.00',
  defaultAccountId: null,
  notes: '',
  dueDay: null,
};
describe('DTO de modelos de lançamento', () => {
  it.each([null, 1, 31])('aceita dueDay %s', async (dueDay) => {
    expect(
      await validate(plainToInstance(CreateTransactionTemplateDto, { ...valid, dueDay })),
    ).toHaveLength(0);
  });
  it.each([0, 32, 1.5])('rejeita dueDay %s', async (dueDay) => {
    expect(
      await validate(plainToInstance(CreateTransactionTemplateDto, { ...valid, dueDay })),
    ).not.toHaveLength(0);
  });
  it('preserva dinheiro como string exata e normaliza textos', async () => {
    const dto = plainToInstance(CreateTransactionTemplateDto, valid);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.plannedAmount).toBe('1800.00');
    expect(dto.name).toBe('Aluguel');
    expect(dto.description).toBe('Moradia');
  });
  it.each(['1800', 1800, '0.00', '1.234'])(
    'rejeita dinheiro fora do contrato: %s',
    async (plannedAmount) => {
      expect(
        await validate(plainToInstance(CreateTransactionTemplateDto, { ...valid, plannedAmount })),
      ).not.toHaveLength(0);
    },
  );
});
