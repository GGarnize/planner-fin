import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : {};
    const data = typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const code =
      typeof data.code === 'string'
        ? data.code
        : status === 400
          ? 'VALIDATION_ERROR'
          : 'INTERNAL_ERROR';
    const message =
      typeof data.message === 'string'
        ? data.message
        : status === 400
          ? 'Dados inválidos.'
          : 'Erro interno.';
    if (status === 429 && typeof data.retryAfter === 'number')
      response.setHeader('Retry-After', data.retryAfter);
    response.status(status).json({
      error: { code, message, ...(Array.isArray(data.details) ? { details: data.details } : {}) },
    });
  }
}
