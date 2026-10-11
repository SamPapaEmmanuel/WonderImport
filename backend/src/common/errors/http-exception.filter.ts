import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { AppException } from './app-exception';
import { ErrorBody, ErrorCode } from './error-codes';

const CODE_FOR_STATUS: Partial<Record<number, ErrorCode>> = {
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.VALIDATION_FAILED, // upload too large
  429: ErrorCode.RATE_LIMITED,
  422: ErrorCode.VALIDATION_FAILED,
};

/** Converts every thrown error into `{ error: { code, message, fields?, requestId } }`. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req as Request & { id?: string }).id;

    const { status, body } = this.toBody(exception);
    body.error.requestId = requestId;

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.originalUrl} [${requestId}]`, exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(status).json(body);
  }

  private toBody(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: { error: { code: exception.code, message: exception.message, fields: exception.fields, details: exception.details } },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = (exception.meta?.target as string[] | string | undefined) ?? 'value';
        const field = Array.isArray(target) ? target.join(', ') : target;
        return {
          status: HttpStatus.CONFLICT,
          body: { error: { code: ErrorCode.CONFLICT, message: `A record with this ${field} already exists`, fields: [{ field, code: 'unique', message: 'Already in use' }] } },
        };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, body: { error: { code: ErrorCode.NOT_FOUND, message: 'Record was not found' } } };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      let message = typeof response === 'string' ? response : ((response as { message?: string | string[] }).message ?? exception.message);
      if (status === 429) message = 'Too many requests. Wait a minute and try again.';
      return {
        status,
        body: { error: { code: CODE_FOR_STATUS[status] ?? ErrorCode.INTERNAL_ERROR, message: Array.isArray(message) ? message.join('; ') : message } },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: ErrorCode.INTERNAL_ERROR, message: 'Something went wrong on the server. Try again, and share the request ID if it keeps happening.' } },
    };
  }
}
