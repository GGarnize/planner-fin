import 'reflect-metadata';
import type { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateBudgetDto } from '../budgets/dto';
import { createValidationPipe } from './validation-error';

const categoryId = '00000000-0000-4000-8000-000000000001';
const otherCategoryId = '00000000-0000-4000-8000-000000000002';

describe('contrato global de erros de validação', () => {
  async function validationResponse(body: unknown) {
    try {
      await createValidationPipe().transform(body, {
        type: 'body',
        metatype: CreateBudgetDto,
        data: undefined,
      });
      throw new Error('A validação deveria rejeitar o payload.');
    } catch (error) {
      return (error as BadRequestException).getResponse() as {
        code: string;
        message: string;
        details: Array<{ field: string; message: string }>;
      };
    }
  }

  it('mantém payload válido aceito pelo pipe', async () => {
    await expect(
      createValidationPipe().transform(
        {
          month: '2026-08',
          totalLimit: '1000.00',
          categories: [{ categoryId, limitAmount: '100.00' }],
        },
        { type: 'body', metatype: CreateBudgetDto, data: undefined },
      ),
    ).resolves.toBeInstanceOf(CreateBudgetDto);
  });

  it('preserva o contrato de erro simples', async () => {
    const result = await validationResponse({
      month: '2026-08',
      totalLimit: '5.000,50',
      categories: [],
    });

    expect(result).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.',
    });
    expect(result.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'totalLimit' })]),
    );
  });

  it('informa o caminho de categories.0.limitAmount', async () => {
    const result = await validationResponse({
      month: '2026-08',
      totalLimit: '1000.00',
      categories: [{ categoryId, limitAmount: '1.000,00' }],
    });

    expect(result.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'categories.0.limitAmount' })]),
    );
    expect(result.details).not.toHaveLength(0);
  });

  it('preserva o índice de outra categoria', async () => {
    const result = await validationResponse({
      month: '2026-08',
      totalLimit: '1000.00',
      categories: [
        { categoryId, limitAmount: '100.00' },
        { categoryId: 'categoria-invalida', limitAmount: '200.00' },
      ],
    });

    expect(result.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'categories.1.categoryId' })]),
    );
  });

  it('serializa múltiplos erros aninhados sem expor os valores recebidos', async () => {
    const sensitiveValue = 'valor-financeiro-sensivel';
    const result = await validationResponse({
      month: '2026-08',
      totalLimit: '1000.00',
      categories: [
        { categoryId, limitAmount: sensitiveValue },
        { categoryId: 'categoria-invalida', limitAmount: 'tambem-invalido' },
        { categoryId: otherCategoryId, limitAmount: '300.00' },
      ],
    });

    expect(result.details.map((detail) => detail.field)).toEqual(
      expect.arrayContaining([
        'categories.0.limitAmount',
        'categories.1.categoryId',
        'categories.1.limitAmount',
      ]),
    );
    expect(result.details.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(result)).not.toContain(sensitiveValue);
  });
});
