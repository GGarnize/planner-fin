import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type NotificationDevice } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type {
  BindNotificationDeviceRequest,
  IngestCapturedNotificationsResponse,
  NotificationDeviceResponse,
  UpdateNotificationDevicePreferencesRequest,
} from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { IngestCapturedNotificationsDto } from './dto';

const MAX_TEXT_BYTES = 256 * 1024;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isSerializableConflict = (error: unknown) =>
  (error as { code?: string }).code === 'P2034' ||
  (error instanceof Error && /write conflict|transaction.*closed|serializ/i.test(error.message));
const notFound = () =>
  new NotFoundException({ code: 'NOTIFICATION_DEVICE_NOT_FOUND', message: 'Dispositivo nao encontrado.' });

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async bind(
    userId: string,
    dto: BindNotificationDeviceRequest,
  ): Promise<NotificationDeviceResponse> {
    const monitoredPackages = sanitizePackages(dto.monitoredPackages ?? []);
    const existing = await this.prisma.notificationDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId: dto.deviceId } },
    });
    const data = {
      name: dto.name?.trim() || null,
      captureEnabled: dto.captureEnabled ?? existing?.captureEnabled ?? false,
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
}

function sanitizePackages(packages: string[]): string[] {
  return [...new Set(packages.map((p) => p.trim()).filter(Boolean))].slice(0, 50);
}

function toPackageList(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
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
