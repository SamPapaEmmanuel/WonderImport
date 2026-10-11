import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, ValidateIf } from 'class-validator';
import { PaginationQuery } from '../../../common/pagination/pagination';
import { ARCHIVED_FILTERS, type ArchivedFilter } from '../../../common/query/archived-filter';
import { TrimToNull } from '../../../common/validation/decorators';

export class CreateClientDto {
  @IsString()
  @Length(1, 120)
  name: string;

  /** Optional; generated as CL-### when omitted. */
  @IsOptional()
  @TrimToNull()
  @Matches(/^[A-Z0-9-]{2,20}$/, { message: 'code must be 2–20 capital letters, digits or hyphens' })
  code?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'phone must be a phone number' })
  phone?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @Matches(/^\+?[0-9 ()-]{6,20}$/, { message: 'phone must be a phone number' })
  phone?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(2000)
  notes?: string | null;
}

export class ListClientsQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(ARCHIVED_FILTERS)
  archived: ArchivedFilter = 'exclude';

  @IsOptional()
  @IsIn(['name', 'code', 'goods', 'revenue', 'profit', 'margin', 'createdAt'].flatMap((f) => [`${f}:asc`, `${f}:desc`]))
  sort: string = 'name:asc';
}

export class ArchiveDto {
  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
