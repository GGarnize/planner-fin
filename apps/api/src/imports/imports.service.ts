import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ImportStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfirmImportDto, CreateImportDto, PatchImportRowDto } from './dto';
import {
  canonicalMoney,
  civilDate,
  type CsvMapping,
  fingerprints,
  type ImportUploadFile,
  IMPORT_MAX_BYTES,
  IMPORT_PARSER_VERSION,
  mapCsv,
  normalizeDescription,
  parseCsvCells,
  parseOfx,
  parseOfxIsolated,
  sanitizeFilename,
  sha256,
  validateMapping,
} from './imports.helpers';

const editable: ImportStatus[] = ['UPLOADED', 'MAPPING_REQUIRED', 'READY_FOR_REVIEW'];
const SAMPLE_LIMIT = 5;
const SAMPLE_CELL_LIMIT = 80;
const expiresAt = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const isSerializableConflict = (error: unknown) =>
  (error as { code?: string }).code === 'P2034' ||
  (error instanceof Error && /write conflict|transaction.*closed|serializ/i.test(error.message));
const notFound = () =>
  new NotFoundException({ code: 'IMPORT_NOT_FOUND', message: 'Importação não encontrada.' });

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateImportDto, file?: ImportUploadFile) {
    if (!file?.buffer?.length)
      throw new BadRequestException({
        code: 'INVALID_IMPORT_FILE',
        message: 'Envie um arquivo válido.',
      });
    if (file.size > IMPORT_MAX_BYTES)
      throw new BadRequestException({
        code: 'IMPORT_FILE_TOO_LARGE',
        message: 'O arquivo excede 10 MiB.',
      });
    const filename = sanitizeFilename(file.originalname);
    this.assertMedia(dto.format, filename, file.mimetype, file.buffer);
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.accountId, userId },
    });
    if (!account) throw notFound();
    if (account.archivedAt || account.currency !== 'BRL')
      throw new ConflictException({
        code: 'IMPORT_ACCOUNT_UNAVAILABLE',
        message: 'Selecione uma conta ativa em BRL.',
      });
    const started = Date.now();
    try {
      if (dto.format === 'OFX') {
        const rows = await parseOfxIsolated(file.buffer);
        return await this.prisma.$transaction(async (tx) => {
          const session = await tx.importSession.create({
            data: {
              userId,
              accountId: dto.accountId,
              format: 'OFX',
              status: 'READY_FOR_REVIEW',
              fileHash: sha256(file.buffer),
              parserVersion: IMPORT_PARSER_VERSION,
              displayFileName: filename,
              rowCount: rows.length,
              expiresAt: expiresAt(),
            },
          });
          await tx.importRow.createMany({
            data: this.rowData(userId, session.id, dto.accountId, 'OFX', rows, true),
          });
          await this.classify(tx, session.id, userId, dto.accountId);
          return this.getWith(tx, userId, session.id, 100, 0, 'all');
        });
      }
      const delimiter = dto.delimiter ?? ',';
      const cells = parseCsvCells(file.buffer, delimiter);
      if (Date.now() - started > 30_000) throw new Error('PARSE_TIMEOUT');
      const session = await this.prisma.importSession.create({
        data: {
          userId,
          accountId: dto.accountId,
          format: 'CSV',
          status: 'MAPPING_REQUIRED',
          fileHash: sha256(file.buffer),
          parserVersion: IMPORT_PARSER_VERSION,
          displayFileName: filename,
          mapping: { delimiter },
          sourceData: cells,
          rowCount: Math.max(0, cells.length - 1),
          expiresAt: expiresAt(),
        },
      });
      return this.get(userId, session.id, 100, 0, 'all');
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) throw error;
      throw new UnprocessableEntityException({
        code: 'IMPORT_PARSE_ERROR',
        message: 'Não foi possível interpretar o arquivo.',
      });
    }
  }

  get(userId: string, id: string, limit: number, offset: number, filter: string) {
    return this.getWith(this.prisma, userId, id, limit, offset, filter);
  }

  async listOpen(userId: string, status: 'open') {
    if (status !== 'open') return [];
    const sessions = await this.prisma.importSession.findMany({
      where: { userId, status: { in: editable }, expiresAt: { gt: new Date() } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        format: true,
        status: true,
        accountId: true,
        displayFileName: true,
        draftVersion: true,
        updatedAt: true,
        expiresAt: true,
      },
    });
    return sessions.map((session) => ({
      ...session,
      updatedAt: session.updatedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));
  }

  async mapping(userId: string, id: string, draftVersion: number, input: unknown) {
    const mapping = input as CsvMapping;
    try {
      validateMapping(mapping);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_CSV_MAPPING',
        message: 'Revise o mapeamento CSV.',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const session = await this.owned(tx, userId, id);
      this.assertEditable(session.status);
      this.version(session.draftVersion, draftVersion);
      if (session.format !== 'CSV' || !Array.isArray(session.sourceData))
        throw new BadRequestException({
          code: 'INVALID_CSV_MAPPING',
          message: 'Esta sessão não aceita mapping CSV.',
        });
      let rows;
      try {
        rows = mapCsv(session.sourceData as string[][], mapping);
      } catch {
        throw new UnprocessableEntityException({
          code: 'IMPORT_PARSE_ERROR',
          message: 'O mapping não produz linhas válidas.',
        });
      }
      await tx.importRow.deleteMany({ where: { sessionId: id, userId } });
      await tx.importRow.createMany({
        data: this.rowData(
          userId,
          id,
          session.accountId,
          'CSV',
          rows,
          mapping.externalIdReliable === true,
        ),
      });
      await tx.importSession.update({
        where: { id },
        data: {
          mapping: mapping as unknown as Prisma.InputJsonValue,
          status: 'READY_FOR_REVIEW',
          rowCount: rows.length,
          draftVersion: { increment: 1 },
          previewTokenHash: null,
          previewPayloadHash: null,
          expiresAt: expiresAt(),
        },
      });
      await this.classify(tx, id, userId, session.accountId);
      return this.getWith(tx, userId, id, 100, 0, 'all');
    });
  }

  async patchRow(userId: string, sessionId: string, rowId: string, dto: PatchImportRowDto) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.owned(tx, userId, sessionId);
      this.assertEditable(session.status);
      this.version(session.draftVersion, dto.draftVersion);
      const row = await tx.importRow.findFirst({ where: { id: rowId, sessionId, userId } });
      if (!row) throw notFound();
      const description =
        dto.description === undefined ? row.description : normalizeDescription(dto.description);
      const date =
        dto.date === undefined
          ? (row.date?.toISOString().slice(0, 10) ?? null)
          : civilDate(dto.date);
      const amount =
        dto.amount === undefined ? (row.amount?.toFixed(2) ?? null) : canonicalMoney(dto.amount);
      const type = dto.type ?? row.type;
      if (!description || !date || !amount || !type)
        throw new BadRequestException({
          code: 'INVALID_IMPORT_ROW',
          message: 'Revise os campos da linha.',
        });
      if (dto.categoryId) {
        const category = await tx.financialCategory.findFirst({
          where: { id: dto.categoryId, userId },
        });
        if (!category) throw notFound();
        if (category.archivedAt || category.type !== type)
          throw new ConflictException({
            code: 'IMPORT_CATEGORY_UNAVAILABLE',
            message: 'Selecione uma categoria ativa e compatível.',
          });
      }
      const fp = fingerprints({
        userId,
        accountId: session.accountId,
        format: session.format,
        externalId: row.externalId,
        date,
        type,
        amount,
        description,
      });
      const changes = Object.fromEntries(
        Object.entries(dto)
          .filter(([key, value]) => key !== 'draftVersion' && value !== undefined)
          .map(([key, value]) => [key, { at: new Date().toISOString(), value }]),
      );
      await tx.importRow.update({
        where: { id: row.id },
        data: {
          description,
          date: new Date(`${date}T00:00:00.000Z`),
          amount: new Prisma.Decimal(amount),
          type,
          categoryId: dto.categoryId ?? row.categoryId,
          selected: dto.selected ?? row.selected,
          probableOverride: dto.probableOverride ?? row.probableOverride,
          possibleAccepted: dto.possibleAccepted ?? row.possibleAccepted,
          validationStatus: 'VALID',
          editedFields: { ...(row.editedFields as object), ...changes },
          ...fp,
        },
      });
      await tx.importSession.update({
        where: { id: sessionId },
        data: {
          draftVersion: { increment: 1 },
          previewTokenHash: null,
          previewPayloadHash: null,
          expiresAt: expiresAt(),
        },
      });
      await this.classify(tx, sessionId, userId, session.accountId);
      return this.getWith(tx, userId, sessionId, 100, 0, 'all');
    });
  }

  async preview(userId: string, id: string, draftVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.owned(tx, userId, id);
      this.assertEditable(session.status);
      this.version(session.draftVersion, draftVersion, 'IMPORT_DRAFT_STALE');
      if (session.status !== 'READY_FOR_REVIEW')
        throw new UnprocessableEntityException({
          code: 'IMPORT_NOT_READY',
          message: 'Conclua o mapping e a revisão.',
        });
      await this.validateRelations(tx, session);
      await this.classify(tx, id, userId, session.accountId);
      const rows = await tx.importRow.findMany({
        where: { sessionId: id, userId },
        orderBy: { rowNumber: 'asc' },
      });
      const canonical = rows.map((r) => [
        r.id,
        r.date?.toISOString().slice(0, 10),
        r.description,
        r.type,
        r.amount?.toFixed(2),
        r.categoryId,
        r.selected,
        r.probableOverride,
        r.possibleAccepted,
        r.duplicateClassification,
      ]);
      const payloadHash = sha256(JSON.stringify({ id, draftVersion, canonical }));
      const token = randomBytes(24).toString('base64url');
      await tx.importSession.update({
        where: { id },
        data: { previewTokenHash: sha256(token), previewPayloadHash: payloadHash },
      });
      const selected = rows.filter((r) => r.selected);
      const sum = (type: 'INCOME' | 'EXPENSE') =>
        selected
          .filter((r) => r.type === type)
          .reduce((v, r) => v.plus(r.amount ?? 0), new Prisma.Decimal(0))
          .toFixed(2);
      return {
        previewToken: token,
        previewHash: payloadHash.slice(0, 16),
        draftVersion,
        counts: {
          total: rows.length,
          selected: selected.length,
          blocked: rows.filter((r) => r.validationStatus === 'BLOCKED').length,
          strong: rows.filter((r) => r.duplicateClassification === 'STRONG').length,
          probable: rows.filter((r) => r.duplicateClassification === 'PROBABLE').length,
          possible: rows.filter((r) => r.duplicateClassification === 'POSSIBLE').length,
        },
        totals: { income: sum('INCOME'), expense: sum('EXPENSE') },
      };
    });
  }

  async confirm(userId: string, id: string, key: string, dto: ConfirmImportDto) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key UUID é obrigatório.',
      });
    const payloadHash = sha256(
      JSON.stringify({ id, version: dto.draftVersion, token: sha256(dto.previewToken) }),
    );
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ImportSession" WHERE id = ${id}::uuid FOR UPDATE`;
        const previous = await tx.importConfirmation.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
        });
        if (previous) {
          if (previous.payloadHash !== payloadHash)
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'A chave já foi usada com outra confirmação.',
            });
          return { created: false, ...(previous.result as object) };
        }
        const session = await this.owned(tx, userId, id);
        if (session.status === 'CONFIRMED')
          throw new ConflictException({
            code: 'IMPORT_ALREADY_CONFIRMED',
            message: 'A importação já foi confirmada.',
          });
        this.assertEditable(session.status);
        this.version(session.draftVersion, dto.draftVersion, 'IMPORT_DRAFT_STALE');
        if (!session.previewTokenHash || session.previewTokenHash !== sha256(dto.previewToken))
          throw new ConflictException({
            code: 'IMPORT_DRAFT_STALE',
            message: 'Gere um preview atual.',
          });
        await this.validateRelations(tx, session);
        await this.classify(tx, id, userId, session.accountId);
        const rows = await tx.importRow.findMany({
          where: { sessionId: id, userId, selected: true },
          orderBy: { rowNumber: 'asc' },
        });
        if (
          !rows.length ||
          rows.some(
            (r) =>
              !r.date ||
              !r.description ||
              !r.type ||
              !r.amount ||
              !r.categoryId ||
              r.validationStatus === 'BLOCKED' ||
              r.duplicateClassification === 'STRONG' ||
              (r.duplicateClassification === 'PROBABLE' && !r.probableOverride) ||
              (r.duplicateClassification === 'POSSIBLE' && !r.possibleAccepted),
          )
        )
          throw new UnprocessableEntityException({
            code: 'IMPORT_NOT_CONFIRMABLE',
            message: 'Revise todas as linhas selecionadas.',
          });
        const ids: string[] = [];
        for (const row of rows) {
          const transaction = await tx.financialTransaction.create({
            data: {
              userId,
              accountId: session.accountId,
              categoryId: row.categoryId!,
              type: row.type!,
              status: 'PAID',
              description: row.description!,
              notes: null,
              plannedAmount: row.amount!,
              actualAmount: row.amount!,
              dueDate: row.date!,
              paidAt: row.date!,
            },
          });
          ids.push(transaction.id);
          await tx.importRow.update({
            where: { id: row.id },
            data: {
              transactionId: transaction.id,
              confirmedAt: new Date(),
              editedFields: {},
              warningCodes: [],
            },
          });
        }
        const result = {
          status: 'CONFIRMED',
          sessionId: id,
          transactionIds: ids,
          createdCount: ids.length,
        };
        await tx.importConfirmation.create({
          data: { sessionId: id, userId, idempotencyKey: key, payloadHash, result },
        });
        await tx.importSession.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            sourceData: Prisma.DbNull,
            mapping: Prisma.DbNull,
            displayFileName: null,
            previewTokenHash: null,
          },
        });
        return { created: true, ...result };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt < 2 && isSerializableConflict(error)) continue;
        throw error;
      }
    }
    throw new ConflictException({
      code: 'IMPORT_CONFIRMATION_CONFLICT',
      message: 'A confirmacao nao pode ser serializada.',
    });
  }

  async cancel(userId: string, id: string, draftVersion: number) {
    const session = await this.owned(this.prisma, userId, id);
    if (session.status === 'CANCELLED') return;
    if (session.status === 'CONFIRMED')
      throw new ConflictException({
        code: 'IMPORT_ALREADY_CONFIRMED',
        message: 'A importação já foi confirmada.',
      });
    this.assertEditable(session.status);
    this.version(session.draftVersion, draftVersion);
    await this.prisma.importSession.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        sourceData: Prisma.DbNull,
        mapping: Prisma.DbNull,
        displayFileName: null,
        previewTokenHash: null,
      },
    });
  }

  async cleanup(now = new Date()) {
    await this.prisma.importSession.updateMany({
      where: { status: { in: editable }, expiresAt: { lte: now } },
      data: {
        status: 'EXPIRED',
        sourceData: Prisma.DbNull,
        mapping: Prisma.DbNull,
        displayFileName: null,
        previewTokenHash: null,
      },
    });
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const doomed = await this.prisma.importSession.findMany({
      where: { status: { in: ['CANCELLED', 'EXPIRED', 'FAILED'] }, updatedAt: { lte: cutoff } },
      select: { id: true },
    });
    if (doomed.length)
      await this.prisma.$transaction(async (tx) => {
        await tx.importRow.deleteMany({
          where: { sessionId: { in: doomed.map((d) => d.id) }, transactionId: null },
        });
        await tx.importSession.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } });
      });
    return { expired: doomed.length };
  }

  private rowData(
    userId: string,
    sessionId: string,
    accountId: string,
    format: 'OFX' | 'CSV',
    rows: ReturnType<typeof parseOfx>,
    reliable: boolean,
  ) {
    const seen = new Map<string, number>();
    return rows
      .map((row) => {
        const fp =
          row.date && row.type && row.amount && row.description
            ? fingerprints({
                userId,
                accountId,
                format,
                externalId: reliable ? row.externalId : null,
                date: row.date,
                type: row.type,
                amount: row.amount,
                description: row.description,
              })
            : { strongKeyHash: null, exactFingerprint: null, windowFingerprint: null };
        if (fp.strongKeyHash) seen.set(fp.strongKeyHash, (seen.get(fp.strongKeyHash) ?? 0) + 1);
        return {
          userId,
          sessionId,
          rowNumber: row.rowNumber,
          date: row.date ? new Date(`${row.date}T00:00:00.000Z`) : null,
          description: row.description,
          type: row.type,
          amount: row.amount ? new Prisma.Decimal(row.amount) : null,
          externalId: row.externalId,
          selected: !row.blocked,
          validationStatus: row.blocked ? ('BLOCKED' as const) : ('VALID' as const),
          warningCodes: row.warnings,
          editedFields: {},
          ...fp,
        };
      })
      .map((row) =>
        row.strongKeyHash && (seen.get(row.strongKeyHash) ?? 0) > 1
          ? {
              ...row,
              selected: false,
              validationStatus: 'BLOCKED' as const,
              duplicateClassification: 'STRONG' as const,
              warningCodes: [...row.warningCodes, 'DUPLICATE_STRONG_IN_FILE'],
            }
          : row,
      );
  }

  private async classify(
    tx: Prisma.TransactionClient,
    sessionId: string,
    userId: string,
    accountId: string,
  ) {
    const rows = await tx.importRow.findMany({
      where: { sessionId, userId },
      orderBy: { rowNumber: 'asc' },
    });
    for (const row of rows) {
      if (row.validationStatus === 'BLOCKED' && row.duplicateClassification === 'STRONG') continue;
      let classification: 'NONE' | 'STRONG' | 'PROBABLE' | 'POSSIBLE' = 'NONE';
      if (
        row.strongKeyHash &&
        (await tx.importRow.findFirst({
          where: {
            userId,
            strongKeyHash: row.strongKeyHash,
            transactionId: { not: null },
            sessionId: { not: sessionId },
          },
        }))
      )
        classification = 'STRONG';
      else if (row.date && row.type && row.amount && row.description) {
        const exact = await tx.financialTransaction.findFirst({
          where: {
            userId,
            accountId,
            type: row.type,
            dueDate: row.date,
            actualAmount: row.amount,
            description: { equals: row.description, mode: 'insensitive' },
          },
        });
        if (
          exact ||
          rows.some(
            (other) => other.id !== row.id && other.exactFingerprint === row.exactFingerprint,
          )
        )
          classification = 'PROBABLE';
        else {
          const from = new Date(row.date);
          from.setUTCDate(from.getUTCDate() - 2);
          const to = new Date(row.date);
          to.setUTCDate(to.getUTCDate() + 2);
          const possible = await tx.financialTransaction.findFirst({
            where: {
              userId,
              accountId,
              type: row.type,
              dueDate: { gte: from, lte: to },
              actualAmount: row.amount,
              description: { equals: row.description, mode: 'insensitive' },
            },
          });
          if (possible) classification = 'POSSIBLE';
        }
      }
      await tx.importRow.update({
        where: { id: row.id },
        data: {
          duplicateClassification: classification,
          ...(classification === 'STRONG'
            ? { selected: false, validationStatus: 'BLOCKED' }
            : classification === 'PROBABLE' && !row.probableOverride
              ? { selected: false }
              : {}),
        },
      });
    }
  }

  private async getWith(
    tx: Prisma.TransactionClient | PrismaService,
    userId: string,
    id: string,
    limit: number,
    offset: number,
    filter: string,
  ) {
    const session = await this.owned(tx, userId, id);
    const where: Prisma.ImportRowWhereInput = {
      sessionId: id,
      userId,
      ...(filter === 'valid'
        ? { validationStatus: 'VALID' }
        : filter === 'warning'
          ? { warningCodes: { not: Prisma.JsonNull } }
          : filter === 'duplicate'
            ? { duplicateClassification: { not: 'NONE' } }
            : filter === 'selected'
              ? { selected: true }
              : {}),
    };
    const [rows, filteredCount] = await Promise.all([
      tx.importRow.findMany({ where, orderBy: { rowNumber: 'asc' }, take: limit, skip: offset }),
      tx.importRow.count({ where }),
    ]);
    return {
      id: session.id,
      accountId: session.accountId,
      format: session.format,
      status: session.status,
      draftVersion: session.draftVersion,
      displayFileName: session.displayFileName,
      rowCount: session.rowCount,
      expiresAt: session.expiresAt.toISOString(),
      mapping: session.mapping,
      ...(session.format === 'CSV' &&
      editable.includes(session.status) &&
      Array.isArray(session.sourceData)
        ? { csvSample: this.csvSample(session.sourceData as string[][]) }
        : {}),
      rows: rows.map((r) => ({
        id: r.id,
        rowNumber: r.rowNumber,
        date: r.date?.toISOString().slice(0, 10) ?? null,
        description: r.description,
        type: r.type,
        amount: r.amount?.toFixed(2) ?? null,
        categoryId: r.categoryId,
        selected: r.selected,
        validationStatus: r.validationStatus,
        warnings: r.warningCodes,
        duplicateClassification: r.duplicateClassification,
        probableOverride: r.probableOverride,
        possibleAccepted: r.possibleAccepted,
      })),
      page: { limit, offset, filteredCount },
    };
  }

  private csvSample(source: string[][]) {
    const width = source.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    return {
      columns: Array.from({ length: width }, (_, index) => ({
        index,
        header: this.sanitizeSampleCell(source[0]?.[index] ?? ''),
        samples: source
          .slice(1)
          .map((row) => this.sanitizeSampleCell(row[index] ?? ''))
          .filter(Boolean)
          .slice(0, SAMPLE_LIMIT),
      })),
      rowCount: Math.max(0, source.length - 1),
    };
  }

  private sanitizeSampleCell(value: string) {
    const plain = value
      .normalize('NFKC')
      .split('')
      .map((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || (code >= 127 && code <= 159) ? ' ' : character;
      })
      .join('')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const inert = /^[=+\-@]/.test(plain) ? `’${plain}` : plain;
    return inert.slice(0, SAMPLE_CELL_LIMIT);
  }

  private async owned(tx: Prisma.TransactionClient | PrismaService, userId: string, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
    const session = await tx.importSession.findFirst({ where: { id, userId } });
    if (!session || (editable.includes(session.status) && session.expiresAt <= new Date()))
      throw notFound();
    return session;
  }
  private assertEditable(status: ImportStatus) {
    if (!editable.includes(status))
      throw new ConflictException({
        code: 'IMPORT_READ_ONLY',
        message: 'A sessão está encerrada.',
      });
  }
  private version(actual: number, expected: number, code = 'IMPORT_VERSION_CONFLICT') {
    if (actual !== expected)
      throw new ConflictException({
        code,
        message: 'O draft foi alterado.',
        details: [{ field: 'draftVersion', message: String(actual) }],
      });
  }
  private async validateRelations(
    tx: Prisma.TransactionClient,
    session: { id: string; userId: string; accountId: string },
  ) {
    const account = await tx.financialAccount.findFirst({
      where: { id: session.accountId, userId: session.userId, archivedAt: null, currency: 'BRL' },
    });
    if (!account)
      throw new ConflictException({
        code: 'IMPORT_ACCOUNT_UNAVAILABLE',
        message: 'A conta não está disponível.',
      });
    const selected = await tx.importRow.findMany({
      where: {
        sessionId: session.id,
        userId: session.userId,
        selected: true,
        categoryId: { not: null },
      },
    });
    for (const row of selected) {
      const category = await tx.financialCategory.findFirst({
        where: { id: row.categoryId!, userId: session.userId, archivedAt: null, type: row.type! },
      });
      if (!category)
        throw new ConflictException({
          code: 'IMPORT_CATEGORY_UNAVAILABLE',
          message: 'Uma categoria não está disponível.',
        });
    }
  }
  private assertMedia(format: 'OFX' | 'CSV', name: string, mime: string, bytes: Buffer) {
    const ext = name.toLowerCase().split('.').pop();
    const prefix = bytes
      .subarray(0, 512)
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trimStart();
    const allowed =
      format === 'OFX'
        ? ['application/x-ofx', 'application/xml', 'text/xml', 'text/plain']
        : ['text/csv', 'text/plain'];
    const content =
      format === 'OFX'
        ? /^(OFXHEADER:|<\?xml|<OFX)/i.test(prefix)
        : !/^(OFXHEADER:|<\?xml|<OFX)/i.test(prefix);
    if (ext !== format.toLowerCase() || !allowed.includes(mime) || !content)
      throw new BadRequestException({
        code: 'INVALID_IMPORT_FILE',
        message: 'Extensão, mídia e conteúdo não são coerentes.',
      });
  }
}
