import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type CapturedNotification, type NotificationDevice } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type {
  BindNotificationDeviceRequest,
  CapturedNotificationListQuery,
  IngestCapturedNotificationsResponse,
  ListCapturedNotificationsResponse,
  NotificationDeviceResponse,
  PublicCapturedNotification,
  UpdateNotificationDevicePreferencesRequest,
} from '@planner-fin/shared';
import { civilDate } from '../transactions/transactions.helpers';
import { PrismaService } from '../prisma/prisma.service';
import type { ConfirmCapturedNotificationDto, IngestCapturedNotificationsDto } from './dto';
import { classifyNotification } from './parsers/notification-classifier';

const MAX_TEXT_BYTES = 256 * 1024;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const CAPTURED_STATUSES = [
  'UNCLASSIFIED',
  'FINANCIAL_CANDIDATE',
  'NON_FINANCIAL',
  'AMBIGUOUS',
  'IGNORED',
  'DISMISSED',
  'CONFIRMED',
] as const;
/** "Para revisar" — o que ainda não teve uma decisão humana. */
const PENDING_STATUSES = ['UNCLASSIFIED', 'FINANCIAL_CANDIDATE', 'AMBIGUOUS'] as const;
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isSerializableConflict = (error: unknown) =>
  (error as { code?: string }).code === 'P2034' ||
  (error instanceof Error && /write conflict|transaction.*closed|serializ/i.test(error.message));
const notFound = () =>
  new NotFoundException({ code: 'NOTIFICATION_DEVICE_NOT_FOUND', message: 'Dispositivo nao encontrado.' });
const notFoundNotification = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Notificação não encontrada.' });
const invalidQuery = (field: string) =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Revise os parâmetros informados.',
    details: [{ field, message: 'Parâmetro inválido.' }],
  });

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async bind(
    userId: string,
    dto: BindNotificationDeviceRequest,
  ): Promise<NotificationDeviceResponse> {
    const existing = await this.prisma.notificationDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId: dto.deviceId } },
    });
    const shouldReplacePreferences = !existing || dto.replacePreferences === true;
    const monitoredPackages = shouldReplacePreferences
      ? sanitizePackages(dto.monitoredPackages ?? [])
      : toPackageList(existing.monitoredPackages);
    const data = {
      name: dto.name?.trim() || null,
      captureEnabled: shouldReplacePreferences
        ? (dto.captureEnabled ?? false)
        : (existing.captureEnabled ?? false),
      monitoredPackages,
      status: 'ACTIVE' as const,
      revokedAt: null,
      lastSeenAt: new Date(),
    };
    const device = existing
      ? await this.prisma.notificationDevice.update({
          where: { id: existing.id },
          data: {
            ...data,
            ...(existing.status === 'ACTIVE' ? {} : { ownerBindingId: randomUUID() }),
          },
        })
      : await this.prisma.notificationDevice.create({
          data: {
            userId,
            deviceId: dto.deviceId,
            ownerBindingId: randomUUID(),
            ...data,
          },
        });
    return toPublicDevice(device);
  }

  async list(userId: string): Promise<NotificationDeviceResponse[]> {
    const devices = await this.prisma.notificationDevice.findMany({
      where: { userId },
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
    });
    return devices.map(toPublicDevice);
  }

  async updatePreferences(
    userId: string,
    id: string,
    dto: UpdateNotificationDevicePreferencesRequest,
  ): Promise<NotificationDeviceResponse> {
    if (!isUuid(id)) throw notFound();
    const device = await this.prisma.notificationDevice.findFirst({ where: { id, userId } });
    if (!device) throw notFound();
    if (device.status !== 'ACTIVE')
      throw new ConflictException({
        code: 'NOTIFICATION_DEVICE_REVOKED',
        message: 'Dispositivo desvinculado.',
      });
    const updated = await this.prisma.notificationDevice.update({
      where: { id },
      data: {
        ...(dto.captureEnabled !== undefined ? { captureEnabled: dto.captureEnabled } : {}),
        ...(dto.monitoredPackages !== undefined
          ? { monitoredPackages: sanitizePackages(dto.monitoredPackages) }
          : {}),
        lastSeenAt: new Date(),
      },
    });
    return toPublicDevice(updated);
  }

  async revoke(userId: string, id: string): Promise<void> {
    if (!isUuid(id)) throw notFound();
    const device = await this.prisma.notificationDevice.findFirst({ where: { id, userId } });
    if (!device) throw notFound();
    if (device.status === 'REVOKED') return;
    await this.prisma.notificationDevice.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        captureEnabled: false,
        monitoredPackages: [],
      },
    });
  }

  async ingest(
    userId: string,
    idempotencyKey: string,
    dto: IngestCapturedNotificationsDto,
  ): Promise<IngestCapturedNotificationsResponse> {
    if (!isUuid(idempotencyKey))
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key UUID e obrigatorio.',
      });
    if (!dto.items.length)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Lote vazio.',
      });
    if (Buffer.byteLength(JSON.stringify(dto), 'utf8') > MAX_TEXT_BYTES)
      throw new BadRequestException({
        code: 'NOTIFICATION_BATCH_TOO_LARGE',
        message: 'O lote excede o limite permitido.',
      });
    const payloadHash = sha256(JSON.stringify(dto));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const device = await tx.notificationDevice.findFirst({
              where: {
                userId,
                deviceId: dto.deviceId,
                ownerBindingId: dto.ownerBindingId,
              },
            });
            if (!device) throw notFound();
            if (device.status !== 'ACTIVE' || device.revokedAt)
              throw new ForbiddenException({
                code: 'NOTIFICATION_DEVICE_REVOKED',
                message: 'Dispositivo desvinculado.',
              });
            const previous = await tx.notificationIngestConfirmation.findUnique({
              where: { userId_idempotencyKey: { userId, idempotencyKey } },
            });
            if (previous) {
              if (previous.payloadHash !== payloadHash)
                throw new ConflictException({
                  code: 'IDEMPOTENCY_KEY_REUSED',
                  message: 'A chave ja foi usada com outro lote.',
                });
              return previous.result as unknown as IngestCapturedNotificationsResponse;
            }
            const monitored = new Set(toPackageList(device.monitoredPackages));
            if (!device.captureEnabled || dto.items.some((item) => !monitored.has(item.packageName)))
              throw new UnprocessableEntityException({
                code: 'NOTIFICATION_PACKAGE_NOT_MONITORED',
                message: 'Pacote nao monitorado para este dispositivo.',
              });
            const acceptedLocalIds: string[] = [];
            const duplicateLocalIds: string[] = [];
            const expiresAt = new Date(Date.now() + RETENTION_MS);
            for (const item of dto.items) {
              const postedAt = new Date(item.postedAt);
              const capturedAt = new Date(item.capturedAt);
              const fingerprintHash = sha256(
                JSON.stringify({
                  userId,
                  deviceId: dto.deviceId,
                  packageName: item.packageName,
                  notificationKeyHash: item.notificationKeyHash,
                  postedAt: postedAt.toISOString(),
                  fingerprintVersion: item.fingerprintVersion,
                }),
              );
              const classification = classifyNotification({
                packageName: item.packageName,
                title: nullable(item.title),
                text: nullable(item.text),
                subText: nullable(item.subText),
                bigText: nullable(item.bigText),
              });
              const created = await tx.capturedNotification.createMany({
                data: [
                  {
                    userId,
                    deviceRecordId: device.id,
                    deviceId: dto.deviceId,
                    ownerBindingId: dto.ownerBindingId,
                    packageName: item.packageName,
                    notificationKeyHash: item.notificationKeyHash,
                    fingerprintHash,
                    fingerprintVersion: item.fingerprintVersion,
                    postedAt,
                    capturedAt,
                    title: nullable(item.title),
                    text: nullable(item.text),
                    subText: nullable(item.subText),
                    bigText: nullable(item.bigText),
                    status: classification.status,
                    classifierVersion: classification.classifierVersion,
                    parsedType: classification.parsedType ?? null,
                    parsedAmount:
                      classification.parsedAmount !== undefined
                        ? new Prisma.Decimal(classification.parsedAmount)
                        : null,
                    parsedDescription: classification.parsedDescription ?? null,
                    classificationReasons: classification.reasons,
                    classifiedAt: new Date(),
                    expiresAt,
                  },
                ],
                skipDuplicates: true,
              });
              if (created.count === 1) {
                acceptedLocalIds.push(item.localId);
              } else {
                duplicateLocalIds.push(item.localId);
              }
            }
            const result = {
              acceptedLocalIds,
              duplicateLocalIds,
              createdCount: acceptedLocalIds.length,
              duplicateCount: duplicateLocalIds.length,
            };
            await tx.notificationIngestConfirmation.create({
              data: {
                userId,
                deviceRecordId: device.id,
                idempotencyKey,
                payloadHash,
                result: result as unknown as Prisma.InputJsonValue,
              },
            });
            await tx.notificationDevice.update({
              where: { id: device.id },
              data: { lastSeenAt: new Date() },
            });
            await tx.capturedNotification.deleteMany({
              where: { userId, expiresAt: { lte: new Date() } },
            });
            return result;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt < 2 && isSerializableConflict(error)) continue;
        throw error;
      }
    }
    throw new ConflictException({
      code: 'NOTIFICATION_INGEST_CONFLICT',
      message: 'A ingestao nao pode ser serializada.',
    });
  }

  async purgeExpired(userId: string, now = new Date()) {
    const result = await this.prisma.capturedNotification.deleteMany({
      where: { userId, expiresAt: { lte: now } },
    });
    return { purgedCount: result.count };
  }

  /** "Desativar e apagar histórico" — never touches rows already linked to a confirmed transaction. */
  async purgeAllHistory(userId: string) {
    const result = await this.prisma.capturedNotification.deleteMany({
      where: { userId, status: { not: 'CONFIRMED' } },
    });
    return { purgedCount: result.count };
  }

  async listCaptured(
    userId: string,
    query: CapturedNotificationListQuery,
  ): Promise<ListCapturedNotificationsResponse> {
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    if (!/^\d+$/.test(query.limit ?? '20') || limit < 1 || limit > 100) throw invalidQuery('limit');
    const offset = query.offset === undefined ? 0 : Number(query.offset);
    if (!/^\d+$/.test(query.offset ?? '0') || offset < 0) throw invalidQuery('offset');
    if (query.status && !CAPTURED_STATUSES.includes(query.status)) throw invalidQuery('status');
    const where: Prisma.CapturedNotificationWhereInput = {
      userId,
      status: query.status ? query.status : { in: [...PENDING_STATUSES] },
    };
    const [rows, filteredCount] = await Promise.all([
      this.prisma.capturedNotification.findMany({
        where,
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.capturedNotification.count({ where }),
    ]);
    return { data: rows.map(toPublicCapturedNotification), page: { limit, offset, filteredCount } };
  }

  async getCaptured(userId: string, id: string): Promise<PublicCapturedNotification> {
    return toPublicCapturedNotification(await this.findOwnCaptured(userId, id));
  }

  async dismiss(userId: string, id: string): Promise<PublicCapturedNotification> {
    if (!isUuid(id)) throw notFoundNotification();
    await this.prisma.capturedNotification.updateMany({
      where: { id, userId, status: { notIn: ['CONFIRMED', 'DISMISSED'] } },
      data: { status: 'DISMISSED', dismissedAt: new Date() },
    });
    const row = await this.findOwnCaptured(userId, id);
    if (row.status === 'CONFIRMED')
      throw new ConflictException({
        code: 'NOTIFICATION_ALREADY_CONFIRMED',
        message: 'Notificação já confirmada em um lançamento.',
      });
    return toPublicCapturedNotification(row);
  }

  async markNonFinancial(userId: string, id: string): Promise<PublicCapturedNotification> {
    if (!isUuid(id)) throw notFoundNotification();
    await this.prisma.capturedNotification.updateMany({
      where: { id, userId, status: { notIn: ['CONFIRMED', 'NON_FINANCIAL'] } },
      data: { status: 'NON_FINANCIAL' },
    });
    const row = await this.findOwnCaptured(userId, id);
    if (row.status === 'CONFIRMED')
      throw new ConflictException({
        code: 'NOTIFICATION_ALREADY_CONFIRMED',
        message: 'Notificação já confirmada em um lançamento.',
      });
    return toPublicCapturedNotification(row);
  }

  async confirm(
    userId: string,
    id: string,
    dto: ConfirmCapturedNotificationDto,
  ): Promise<PublicCapturedNotification> {
    if (!isUuid(id)) throw notFoundNotification();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.capturedNotification.findFirst({ where: { id, userId } });
            if (!existing) throw notFoundNotification();
            if (existing.status === 'CONFIRMED') return toPublicCapturedNotification(existing);
            if (existing.status === 'DISMISSED')
              throw new ConflictException({
                code: 'NOTIFICATION_ALREADY_DISMISSED',
                message: 'Notificação já foi descartada.',
              });
            const [account, category] = await Promise.all([
              tx.financialAccount.findFirst({ where: { id: dto.accountId, userId } }),
              tx.financialCategory.findFirst({ where: { id: dto.categoryId, userId } }),
            ]);
            if (!account || !category) throw notFoundNotification();
            if (account.archivedAt || category.archivedAt)
              throw new ConflictException({
                code: 'RELATED_RESOURCE_ARCHIVED',
                message: 'Selecione uma conta e categoria ativas.',
              });
            if (category.type !== dto.type)
              throw new ConflictException({
                code: 'CATEGORY_TYPE_MISMATCH',
                message: 'A categoria não corresponde à natureza do lançamento.',
              });
            const amount = new Prisma.Decimal(dto.amount);
            const transaction = await tx.financialTransaction.create({
              data: {
                userId,
                accountId: dto.accountId,
                categoryId: dto.categoryId,
                type: dto.type,
                status: 'PAID',
                description: dto.description,
                plannedAmount: amount,
                actualAmount: amount,
                dueDate: civilDate(dto.date),
                paidAt: civilDate(dto.date),
              },
            });
            const changed = await tx.capturedNotification.updateMany({
              where: { id, userId, status: { notIn: ['CONFIRMED', 'DISMISSED'] } },
              data: {
                status: 'CONFIRMED',
                confirmedTransactionId: transaction.id,
                confirmedAt: new Date(),
                accountId: dto.accountId,
                categoryId: dto.categoryId,
              },
            });
            if (!changed.count)
              throw new ConflictException({
                code: 'NOTIFICATION_ALREADY_CONFIRMED',
                message: 'Notificação já confirmada em um lançamento.',
              });
            const updated = await tx.capturedNotification.findFirst({ where: { id, userId } });
            return toPublicCapturedNotification(updated!);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (attempt < 2 && isSerializableConflict(error)) continue;
        throw error;
      }
    }
    throw new ConflictException({
      code: 'NOTIFICATION_CONFIRM_CONFLICT',
      message: 'A confirmação não pôde ser serializada.',
    });
  }

  private async findOwnCaptured(userId: string, id: string): Promise<CapturedNotification> {
    if (!isUuid(id)) throw notFoundNotification();
    const row = await this.prisma.capturedNotification.findFirst({ where: { id, userId } });
    if (!row) throw notFoundNotification();
    return row;
  }
}

function sanitizePackages(packages: string[]): string[] {
  return [...new Set(packages.map((p) => p.trim()).filter(Boolean))].slice(0, 50);
}

function toPackageList(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toPublicCapturedNotification(row: CapturedNotification): PublicCapturedNotification {
  return {
    id: row.id,
    deviceId: row.deviceId,
    packageName: row.packageName,
    status: row.status,
    postedAt: row.postedAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    title: row.title,
    text: row.text,
    subText: row.subText,
    bigText: row.bigText,
    parsedType: row.parsedType,
    parsedAmount: row.parsedAmount?.toFixed(2) ?? null,
    parsedDescription: row.parsedDescription,
    classificationReasons: toPackageList(row.classificationReasons),
    classifiedAt: row.classifiedAt?.toISOString() ?? null,
    accountId: row.accountId,
    categoryId: row.categoryId,
    confirmedTransactionId: row.confirmedTransactionId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicDevice(device: NotificationDevice): NotificationDeviceResponse {
  return {
    id: device.id,
    deviceId: device.deviceId,
    ownerBindingId: device.ownerBindingId,
    name: device.name,
    status: device.status,
    captureEnabled: device.captureEnabled,
    monitoredPackages: toPackageList(device.monitoredPackages),
    lastSeenAt: device.lastSeenAt.toISOString(),
    revokedAt: device.revokedAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
}

function nullable(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : null;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
