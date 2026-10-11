import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';
import { createValidationPipe } from './common/validation/validation.pipe';
import { allowedOrigins, env } from './config/env';

/**
 * Everything applied to the HTTP app: security headers, body limits, CORS, validation, error format.
 * Shared by main.ts and the end-to-end tests so tests exercise exactly what runs in production.
 */
export function configureApp(app: NestExpressApplication) {
  const config = env();
  if (config.TRUST_PROXY > 0) app.set('trust proxy', config.TRUST_PROXY);
  app.disable('x-powered-by');

  // JSON-only API: strict security headers, no framing, no caching of responses with business data.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use((_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Small bodies only; spreadsheet uploads go through multer with their own 5 MB limit.
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { limit: '64kb', extended: false });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: allowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    exposedHeaders: ['x-request-id', 'content-disposition'],
    maxAge: 600,
  });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  return app;
}
