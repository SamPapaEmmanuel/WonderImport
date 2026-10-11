import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { ShipmentStatus } from '../../generated/prisma/enums';
import { IsDecimalString, TrimToNull } from '../../common/validation/decorators';
import { MAX_ROWS } from './import-parse';

/** Multipart form fields sent with the file. Each default is used only where the file's cell is empty. */
export class UploadImportDto {
  @IsOptional()
  @TrimToNull()
  @IsUUID('all', { message: 'Choose a valid default client' })
  defaultClientId?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsUUID('all', { message: 'Choose a valid default supplier' })
  defaultSupplierId?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsUUID('all', { message: 'Choose a valid default category' })
  defaultCategoryId?: string | null;

  @IsOptional()
  @TrimToNull()
  @IsEnum(ShipmentStatus)
  defaultStatus?: ShipmentStatus | null;

  @IsOptional()
  @TrimToNull()
  @IsDecimalString({ intDigits: 6, fracDigits: 6 })
  defaultExchangeRate?: string | null;
}

export class CommitImportDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Select at least one row to import' })
  @ArrayMaxSize(MAX_ROWS)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  rowNumbers: number[];
}

export class TemplateQuery {
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format: 'xlsx' | 'csv' = 'xlsx';
}

export class RollbackImportDto {
  @IsString()
  @Length(3, 500, { message: 'Give a reason of at least 3 characters' })
  reason: string;
}
