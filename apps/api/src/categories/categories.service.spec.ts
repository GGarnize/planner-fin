import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { CategoriesService, normalizeCategoryName, publicCategory } from './categories.service';
const row = (extra = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  name: 'Mercado',
  normalizedName: 'mercado',
  type: 'EXPENSE' as const,
  color: '#12aB90',
  icon: 'SHOPPING_CART' as const,
  archivedAt: null,
  createdAt: new Date('2026-08-07T01:00:00Z'),
  updatedAt: new Date('2026-08-07T01:00:00Z'),
  ...extra,
});
const valid = { name: ' Mercado ', type: 'EXPENSE', color: '#12aB90', icon: 'SHOPPING_CART' };
describe('categorias financeiras', () => {
  it('normaliza apenas trim e lowercase Unicode', () => {
    expect(normalizeCategoryName('  ÁGUA  ')).toBe('água');
    expect(normalizeCategoryName('Super  Mercado')).toBe('super  mercado');
  });
  it('valida nome por pontos de código e rejeita vazio, controles e excesso', async () => {
    expect(await validate(plainToInstance(CreateCategoryDto, valid))).toHaveLength(0);
    for (const name of [' ', 'linha\nova', 'a'.repeat(81)])
      expect(
        (await validate(plainToInstance(CreateCategoryDto, { ...valid, name }))).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(plainToInstance(CreateCategoryDto, { ...valid, name: '😀'.repeat(80) })),
    ).toHaveLength(0);
  });
  it.each([
    { type: 'TRANSFER' },
    { color: '#fff' },
    { color: '#11223344' },
    { color: 'red' },
    { icon: '<svg>' },
    { icon: 'home' },
  ])('rejeita valor fechado inválido %o', async (change) =>
    expect(
      (await validate(plainToInstance(CreateCategoryDto, { ...valid, ...change }))).length,
    ).toBeGreaterThan(0),
  );
  it('aceita ausência nula e oito ícones', async () => {
    for (const icon of [
      'HOME',
      'WORK',
      'SHOPPING_CART',
      'RESTAURANT',
      'DIRECTIONS_CAR',
      'HEALTH_AND_SAFETY',
      'SCHOOL',
      'SAVINGS',
    ])
      expect(
        await validate(plainToInstance(CreateCategoryDto, { ...valid, color: null, icon })),
      ).toHaveLength(0);
  });
  it('PATCH não permite type e exige somente campos declarados via whitelist global', async () => {
    const dto = plainToInstance(UpdateCategoryDto, { type: 'INCOME' });
    expect(dto).toHaveProperty('type');
    expect(Object.getOwnPropertyNames(UpdateCategoryDto.prototype)).not.toContain('type');
  });
  it('projeta sem userId e normalizedName', () => {
    const output = publicCategory(row() as never);
    expect(output).not.toHaveProperty('userId');
    expect(output).not.toHaveProperty('normalizedName');
  });
  it('orienta reativação em duplicidade arquivada', async () => {
    const prisma = {
      financialCategory: { findFirst: vi.fn().mockResolvedValue(row({ archivedAt: new Date() })) },
    };
    await expect(
      new CategoriesService(prisma as never).create(row().userId, valid as never),
    ).rejects.toMatchObject({
      response: { code: 'CATEGORY_NAME_CONFLICT', message: expect.stringContaining('Reative') },
    });
  });
  it('bloqueia edição arquivada', async () => {
    const prisma = {
      financialCategory: { findFirst: vi.fn().mockResolvedValue(row({ archivedAt: new Date() })) },
    };
    await expect(
      new CategoriesService(prisma as never).update(row().userId, row().id, { name: 'Outro' }),
    ).rejects.toMatchObject({ response: { code: 'CATEGORY_ARCHIVED' } });
  });
  it('mantém archive e restore repetidos sem update', async () => {
    const update = vi.fn();
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(row({ archivedAt: new Date() }))
      .mockResolvedValueOnce(row());
    const service = new CategoriesService({ financialCategory: { findFirst, update } } as never);
    await service.archive(row().userId, row().id);
    await service.restore(row().userId, row().id);
    expect(update).not.toHaveBeenCalled();
  });
});
