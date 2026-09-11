import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { ApiError, type ErrorBody } from './errors';

/** Renders every error in the `{ statusCode, error, message, details }` shape. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = this.toBody(exception);
    if (body.error === 'INTERNAL_ERROR') this.logger.error(exception);
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof ApiError) {
      return {
        statusCode: exception.getStatus(),
        error: exception.code,
        message: exception.message,
        ...(exception.details === undefined ? {} : { details: exception.details }),
      };
    }
    if (exception instanceof ThrottlerException) {
      return { statusCode: 429, error: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' };
    }
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      if (statusCode === 400) return { statusCode, error: 'VALIDATION_FAILED', message: 'Malformed request body' };
      if (statusCode === 404) return { statusCode, error: 'NOT_FOUND', message: 'Not found' };
      return { statusCode, error: 'REQUEST_FAILED', message: exception.message };
    }
    return { statusCode: 500, error: 'INTERNAL_ERROR', message: 'Something went wrong.' };
  }
}
