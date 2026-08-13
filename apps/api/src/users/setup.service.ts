import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type FinancialCategoryType, type UserInitialSetup } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type {
  InitialSetupCategoryDraft,
  InitialSetupConfirmResponse,
  InitialSetupDraft,
  InitialSetupPreviewResponse,
  InitialSetupSkipResponse,
  InitialSetupStateResponse,
} from '@planner-fin/shared';
import { normalizeCategoryName } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertCivilDate } from './setup.dto';

const SUGGESTION_VERSION = 1;
const PREVIEW_TTL_MS = 15 * 60 * 1000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SETUP_SUGGESTIONS: InitialSetupCategoryDraft[] = [
  { key: 'income', name: 'Renda', type: 'INCOME', icon: 'WORK', selected: true },
  { key: 'housing', name: 'Moradia', type: 'EXPENSE', icon: 'HOME', selected: true },
  {
    key: 'food',
    name: 'Alimentacao',
    type: 'EXPENSE',
    icon: 'RESTAURANT',
    selected: true,
  },
  {
    key: 'transport',
    name: 'Transporte',
    type: 'EXPENSE',
    icon: 'DIRECTIONS_CAR',
    selected: true,
  },
  {
    key: 'health',
    name: 'Saude',
    type: 'EXPENSE',
    icon: 'HEALTH_AND_SAFETY',
    selected: true,
  },
  { key: 'education', name: 'Educacao', type: 'EXPENSE', icon: 'SCHOOL', selected: true },
  { key: 'leisure', name: 'Lazer', type: 'EXPENSE', icon: 'SAVINGS', selected: true },
];

const validation = (field: string, message: string) =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Revise os dados informados.',
    details: [{ field, message }],
  });
const ineligible = () =>
  new ConflictException({
    code: 'SETUP_INELIGIBLE',
    message: 'Setup inicial indisponivel para este usuario.',
  });
const dataConflict = () =>
  new ConflictException({
    code: 'SETUP_DATA_CONFLICT',
    message: 'Dados financeiros foram alterados. Continue manualmente ou recarregue o setup.',
  });

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function date(value: string): Date {
  assertCivilDate(value);
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class InitialSetupService {
  constructor(private readonly prisma: PrismaService) {}

  async createForNewUser(userId: string, client: Prisma.TransactionClient = this.prisma) {
    await client.userInitialSetup.upsert({
      where: { userId },
      create: { userId, status: 'NOT_STARTED', suggestionVersion: SUGGESTION_VERSION },
      update: {},
    });
  }

  async get(userId: string): Promise<InitialSetupStateResponse> {
    const [setup, hasData] = await Promise.all([
      this.prisma.userInitialSetup.findUnique({ where: { userId } }),
      this.hasFinancialData(userId),
    ]);
    return this.state(setup, hasData);
  }

  async saveDraft(userId: string, expected: number | null, draft: InitialSetupDraft) {
    const canonical = this.canonicalDraft(draft);
    return this.prisma.$transaction(async (tx) => {
      let setup = await tx.userInitialSetup.findUnique({ where: { userId } });
      if (!setup) {
        if (expected !== null) throw this.versionConflict(null);
        await this.ensureEligible(userId, tx);
        setup = await tx.userInitialSetup.create({
          data: {
            userId,
            status: 'NOT_STARTED',
            suggestionVersion: SUGGESTION_VERSION,
            draft: canonical as unknown as Prisma.InputJsonValue,
            draftVersion: 1,
          },
        });
      } else {
        if (setup.status === 'COMPLETED')
          throw new ConflictException({
            code: 'SETUP_ALREADY_COMPLETED',
            message: 'Setup inicial ja foi concluido.',
          });
        await this.ensureEligible(userId, tx);
        if (setup.draftVersion !== (expected ?? -1)) throw this.versionConflict(setup);
        setup = await tx.userInitialSetup.update({
          where: { userId },
          data: {
            status: 'NOT_STARTED',
            draft: canonical as unknown as Prisma.InputJsonValue,
            draftVersion: { increment: 1 },
            suggestionVersion: SUGGESTION_VERSION,
            previewTokenHash: null,
            previewPayloadHash: null,
            previewExpiresAt: null,
          },
        });
      }
      return this.state(setup, false);
    });
  }

  async skip(userId: string): Promise<InitialSetupSkipResponse> {
    await this.prisma.$transaction(async (tx) => {
      const setup = await tx.userInitialSetup.findUnique({ where: { userId } });
      if (setup?.status === 'COMPLETED') return;
      await tx.userInitialSetup.upsert({
        where: { userId },
        create: { userId, status: 'SKIPPED', skippedAt: new Date() },
        update: {
          status: 'SKIPPED',
          skippedAt: setup?.skippedAt ?? new Date(),
          previewTokenHash: null,
          previewPayloadHash: null,
          previewExpiresAt: null,
        },
      });
    });
    return { status: 'SKIPPED' };
  }

  async preview(userId: string, draftVersion: number): Promise<InitialSetupPreviewResponse> {
    return this.prisma.$transaction(async (tx) => {
      const setup = await tx.userInitialSetup.findUnique({ where: { userId } });
      if (!setup || setup.status !== 'NOT_STARTED' || !setup.draft) throw ineligible();
      await this.ensureEligible(userId, tx);
      if (setup.draftVersion !== draftVersion) throw this.versionConflict(setup);
      const draft = this.canonicalDraft(setup.draft as unknown as InitialSetupDraft);
      const summary = this.summary(draft);
      const previewToken = randomUUID();
      const payloadHash = sha({ userId, draftVersion, summary });
      await tx.userInitialSetup.update({
        where: { userId },
        data: {
          previewTokenHash: sha(previewToken),
          previewPayloadHash: payloadHash,
          previewExpiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
        },
      });
      return { previewToken, draftVersion, summary };
    });
  }

  async confirm(
    userId: string,
    previewToken: string,
    idempotencyKey: string,
  ): Promise<{ statusCode: 200 | 201; body: InitialSetupConfirmResponse }> {
    if (!UUID.test(idempotencyKey)) throw validation('Idempotency-Key', 'Informe uma chave UUID.');
    const tokenHash = sha(previewToken);
    const existing = await this.prisma.setupConfirmation.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    const requestHash = sha({ previewTokenHash: tokenHash });
    if (existing) {
      if (existing.payloadHash !== requestHash)
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'A chave idempotente ja foi usada com outro payload.',
        });
      return { statusCode: 200, body: existing.result as unknown as InitialSetupConfirmResponse };
    }

    try {
      const body = await this.prisma.$transaction(
        async (tx) => {
          const setup = await tx.userInitialSetup.findUnique({ where: { userId } });
          if (!setup) throw ineligible();
          if (setup.status === 'COMPLETED')
            throw new ConflictException({
              code: 'SETUP_ALREADY_COMPLETED',
              message: 'Setup inicial ja foi concluido.',
            });
          if (
            setup.status !== 'NOT_STARTED' ||
            !setup.draft ||
            setup.previewTokenHash !== tokenHash ||
            !setup.previewExpiresAt ||
            setup.previewExpiresAt <= new Date()
          )
            throw new NotFoundException({
              code: 'SETUP_PREVIEW_NOT_FOUND',
              message: 'Preview expirado ou invalido.',
            });
          await this.ensureEligible(userId, tx);
          const draft = this.canonicalDraft(setup.draft as unknown as InitialSetupDraft);
          const summary = this.summary(draft);
          const payloadHash = sha({ userId, draftVersion: setup.draftVersion, summary });
          if (payloadHash !== setup.previewPayloadHash)
            throw new ConflictException({
              code: 'SETUP_PREVIEW_STALE',
              message: 'Gere um novo preview antes de confirmar.',
            });

          const account = await tx.financialAccount.create({
            data: {
              userId,
              name: summary.account.name,
              type: summary.account.type,
              institution: null,
              currency: 'BRL',
              openingBalance: new Prisma.Decimal(summary.account.openingBalance),
              openingBalanceDate: date(summary.account.openingBalanceDate),
            },
          });
          const categoryRows =
            summary.categories.length === 0
              ? []
              : await Promise.all(
                  summary.categories.map((category) =>
                    tx.financialCategory.create({
                      data: {
                        userId,
                        name: category.name,
                        normalizedName: normalizeCategoryName(category.name),
                        type: category.type,
                        color: null,
                        icon: category.icon,
                      },
                    }),
                  ),
                );
          const result: InitialSetupConfirmResponse = {
            status: 'COMPLETED',
            created: { accountId: account.id, categoryIds: categoryRows.map((row) => row.id) },
            counts: summary.counts,
          };
          await tx.setupConfirmation.create({
            data: {
              userId,
              idempotencyKey,
              payloadHash: requestHash,
              result: result as unknown as Prisma.InputJsonValue,
            },
          });
          await tx.userInitialSetup.update({
            where: { userId },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              draft: Prisma.JsonNull,
              previewTokenHash: null,
              previewPayloadHash: null,
              previewExpiresAt: null,
            },
          });
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { statusCode: 201, body };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw dataConflict();
      throw error;
    }
  }

  private state(
    setup: UserInitialSetup | null,
    hasData: boolean,
  ): InitialSetupStateResponse {
    const status = setup?.status ?? null;
    const eligible = Boolean(setup && status === 'NOT_STARTED' && !hasData);
    const reason = !setup
      ? hasData
        ? 'HAS_FINANCIAL_DATA'
        : 'NOT_IN_ROLLOUT'
      : hasData
        ? 'HAS_FINANCIAL_DATA'
        : status === 'SKIPPED'
          ? 'SETUP_SKIPPED'
          : status === 'COMPLETED'
            ? 'SETUP_COMPLETED'
            : null;
    return {
      participating: Boolean(setup),
      eligible,
      status,
      ineligibleReason: eligible ? null : reason,
      draft: setup?.draft ? this.canonicalDraft(setup.draft as unknown as InitialSetupDraft) : null,
      draftVersion: setup?.draftVersion ?? null,
      suggestionVersion: SUGGESTION_VERSION,
      suggestions: SETUP_SUGGESTIONS,
      lastValidStep: setup?.draft ? this.canonicalDraft(setup.draft as unknown as InitialSetupDraft).step : 'INTRO',
    };
  }

  private async hasFinancialData(
    userId: string,
    client: Pick<
      PrismaService,
      'financialAccount' | 'financialCategory' | 'financialTransaction'
    > = this.prisma,
  ) {
    const [accounts, categories, transactions] = await Promise.all([
      client.financialAccount.count({ where: { userId } }),
      client.financialCategory.count({ where: { userId } }),
      client.financialTransaction.count({ where: { userId } }),
    ]);
    return accounts + categories + transactions > 0;
  }

  private async ensureEligible(userId: string, client: Prisma.TransactionClient) {
    if (await this.hasFinancialData(userId, client)) throw dataConflict();
  }

  private canonicalDraft(draft: InitialSetupDraft): InitialSetupDraft {
    if (!draft?.account) throw validation('draft', 'Informe o draft completo.');
    const balance = draft.account.openingBalance?.trim() || '0.00';
    if (!/^-?(0|[1-9][0-9]{0,16})(\.[0-9]{1,2})?$/.test(balance))
      throw validation('openingBalance', 'Informe um saldo valido.');
    const decimal = new Prisma.Decimal(balance).toFixed(2);
    try {
      assertCivilDate(draft.account.openingBalanceDate);
    } catch {
      throw validation('openingBalanceDate', 'Informe uma data civil valida.');
    }
    const categories = draft.categories.map((category) => ({
      key: category.key,
      name: category.name.trim(),
      type: category.type,
      icon: category.icon,
      selected: Boolean(category.selected),
    }));
    const seen = new Set<string>();
    for (const category of categories.filter((item) => item.selected)) {
      const key = `${category.type}:${normalizeCategoryName(category.name)}`;
      if (seen.has(key)) throw validation('categories', 'Categorias selecionadas nao podem repetir nome e natureza.');
      seen.add(key);
    }
    return {
      step: draft.step,
      account: {
        name: draft.account.name.trim(),
        type: draft.account.type,
        openingBalance: decimal,
        openingBalanceDate: draft.account.openingBalanceDate,
      },
      categories,
    };
  }

  private summary(draft: InitialSetupDraft): InitialSetupPreviewResponse['summary'] {
    const canonical = this.canonicalDraft(draft);
    if (!canonical.account.name) throw validation('name', 'Informe o nome da conta.');
    const categories = canonical.categories
      .filter((category) => category.selected)
      .map((category) => ({
        name: category.name,
        type: category.type as FinancialCategoryType,
        icon: category.icon,
        color: null,
      }));
    return {
      account: {
        name: canonical.account.name,
        type: canonical.account.type,
        currency: 'BRL',
        institution: null,
        openingBalance: canonical.account.openingBalance ?? '0.00',
        openingBalanceDate: canonical.account.openingBalanceDate,
      },
      categories,
      counts: {
        accounts: 1,
        categories: categories.length,
        transactions: 0,
        recurrences: 0,
        total: 1 + categories.length,
      },
    };
  }

  private versionConflict(setup: UserInitialSetup | null) {
    return new ConflictException({
      code: 'SETUP_VERSION_CONFLICT',
      message: 'O draft foi alterado em outro dispositivo.',
      details: [{ field: 'expectedDraftVersion', message: String(setup?.draftVersion ?? 0) }],
    });
  }
}
