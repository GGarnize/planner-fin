import { Global, Module } from '@nestjs/common';
import { API_CONFIG } from '../auth/auth.types';
import { loadApiConfig } from './env';
@Global()
@Module({ providers: [{ provide: API_CONFIG, useFactory: loadApiConfig }], exports: [API_CONFIG] })
export class ConfigModule {}
