import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ARCHIVED_FILTERS, type ArchivedFilter } from '../../common/query/archived-filter';
import { TrimToNull } from '../../common/validation/decorators';

export class SupplierDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsOptional()
  @TrimToNull()
  @MaxLength(120)
  contactPerson?: string | null;

  @IsOptional()
  @TrimToNull()
  @Matches(/^\+?[0-9 ()-]{6,24}$/, { message: 'phone must be a phone number' })
  phone?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 60)
  country?: string;

  @IsOptional()
  @TrimToNull()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @TrimToNull()
  @MaxLength(120)
  contactPerson?: string | null;

  @IsOptional()
  @TrimToNull()
  @Matches(/^\+?[0-9 ()-]{6,24}$/, { message: 'phone must be a phone number' })
  phone?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 60)
  country?: string;

  @IsOptional()
  @TrimToNull()
  @MaxLength(2000)
  notes?: string | null;
}

export class MasterListQuery {
  @IsOptional()
  @IsIn(ARCHIVED_FILTERS)
  archived: ArchivedFilter = 'exclude';
}
