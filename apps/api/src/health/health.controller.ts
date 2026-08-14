import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HEALTH_RESPONSE, type HealthResponse } from '@planner-fin/shared';
import { PrismaService } from '../prisma/prisma.service';

const READINESS_TIMEOUT_MS = 2000;

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  getHealth(): HealthResponse {
    return HEALTH_RESPONSE;
  }

  @Get('ready')
  async getReadiness(): Promise<HealthResponse> {
    try {
      await this.checkDatabase();
      return HEALTH_RESPONSE;
    } catch {
      this.logger.error('Readiness falhou: banco de dados indisponível.');
      throw new ServiceUnavailableException({
        code: 'DB_UNAVAILABLE',
        message: 'Serviço indisponível.',
      });
    }
  }

  private async checkDatabase(): Promise<void> {
    await Promise.race([
      this.prisma.$queryRaw`SELECT 1`,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('readiness timeout')), READINESS_TIMEOUT_MS),
      ),
    ]);
  }
}
