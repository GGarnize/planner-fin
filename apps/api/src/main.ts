import 'reflect-metadata';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { loadApiConfig } from './config/env';
import { isCorsOriginAllowed } from './cors';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const config = loadApiConfig();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => {
      return callback(null, isCorsOriginAllowed(origin, config.corsOrigins));
    },
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
          details: errors.flatMap((error) =>
            Object.values(error.constraints ?? {}).map((message) => ({
              field: error.property,
              message,
            })),
          ),
        }),
    }),
  );
  app.enableShutdownHooks();
  if (config.host) await app.listen(config.port, config.host);
  else await app.listen(config.port);
  logger.log(
    `API PlannerFin iniciada em ${config.host ? `${config.host}:` : 'porta '}${config.port}.`,
  );
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(error instanceof Error ? error.message : 'Erro técnico ao iniciar a API.');
  process.exit(1);
});
