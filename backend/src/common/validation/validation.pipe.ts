import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException } from '../errors/app-exception';
import { FieldError } from '../errors/error-codes';

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.entries(e.constraints ?? {}).map(([code, message]) => ({ field, code, message }));
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/** Strict request validation: unknown fields are rejected, values are transformed to DTO types. */
export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) => AppException.validation(flatten(errors)),
  });
}
