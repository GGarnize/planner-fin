import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadApiConfig } from './config/env';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const config = loadApiConfig();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.corsOrigin });
  app.enableShutdownHooks();
  await app.listen(config.port);
  logger.log(`API PlannerFin iniciada na porta ${config.port}.`);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(error instanceof Error ? error.message : 'Erro técnico ao iniciar a API.');
  process.exit(1);
});
