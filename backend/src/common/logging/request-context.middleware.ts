import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Gives every request an ID (reused from `x-request-id` when present) and logs method, path, status and duration. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request & { id?: string }, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    req.id = incoming && incoming.length <= 64 ? incoming : randomUUID();
    res.setHeader('x-request-id', req.id);

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms [${req.id}]`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
