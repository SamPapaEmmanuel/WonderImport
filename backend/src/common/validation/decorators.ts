import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, ValidateBy } from 'class-validator';

/**
 * A decimal sent as a string (or number) with bounded integer and fraction digits.
 * Values stay strings end to end so no binary floating point touches money.
 */
export function IsDecimalString(opts: { intDigits: number; fracDigits: number; positive?: boolean }) {
  const pattern = new RegExp(`^\\d{1,${opts.intDigits}}(\\.\\d{1,${opts.fracDigits}})?$`);
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : value)),
    IsString({ message: ({ property }) => `${property} must be a number` }),
    Matches(pattern, {
      message: ({ property }) => `${property} must be a number with up to ${opts.fracDigits} decimal places`,
    }),
    ...(opts.positive === false
      ? []
      : [
          ValidateBy({
            name: 'positiveDecimal',
            validator: {
              validate: (v: unknown) => typeof v === 'string' && Number(v) > 0,
              defaultMessage: (args) => `${args?.property} must be greater than 0`,
            },
          }),
        ]),
  );
}

/** Calendar date as YYYY-MM-DD. */
export function IsDateOnly() {
  return applyDecorators(
    IsString(),
    Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: ({ property }) => `${property} must be a date in YYYY-MM-DD format` }),
  );
}

/** Accepts `?k=a&k=b` and `?k=a,b` as ['a', 'b']. */
export const ToArray = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const list = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
    const clean = list.map((v) => v.trim()).filter(Boolean);
    return clean.length ? clean : undefined;
  });

/** Trims strings and turns empty strings into null (for optional text fields that can be cleared). */
export const TrimToNull = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? null : t;
  });

/** Parses "true"/"false" query values. */
export const ToBoolean = () =>
  Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value));

export const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const toDateOnlyString = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
