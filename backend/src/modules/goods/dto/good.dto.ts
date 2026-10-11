import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { ShipmentStatus } from '../../../generated/prisma/enums';
import { IsDateOnly, IsDecimalString, TrimToNull } from '../../../common/validation/decorators';

const TRACKING = /^[A-Za-z0-9][A-Za-z0-9 _./-]{0,63}$/;

/** Fields shared by create and update. */
class GoodFields {
  @IsOptional()
  @TrimToNull()
  @Matches(TRACKING, { message: 'trackingNumber may contain letters, digits, spaces, dots, slashes and hyphens (max 64)' })
  trackingNumber?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantitySold must be a whole number' })
  @Min(0)
  quantitySold?: number;

  /** Manual selling price per unit (GHS). null clears an existing override. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDecimalString({ intDigits: 12, fracDigits: 2 })
  sellingPrice?: string | null;

  @IsOptional()
  @TrimToNull()
  @MaxLength(500)
  overrideReason?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDecimalString({ intDigits: 12, fracDigits: 2 })
  retailPrice?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateOnly()
  orderedAt?: string | null;

  @IsOptional()
  @TrimToNull()
  @MaxLength(2000)
  notes?: string | null;
}

export class CreateGoodDto extends GoodFields {
  @IsString()
  @Length(1, 200)
  itemName: string;

  @Type(() => Number)
  @IsInt({ message: 'quantity must be a whole number' })
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  /** CNY per unit */
  @IsDecimalString({ intDigits: 10, fracDigits: 4 })
  unitCost: string;

  /** GHS per 1 CNY; defaults to the company setting */
  @IsOptional()
  @IsDecimalString({ intDigits: 6, fracDigits: 6 })
  exchangeRate?: string;

  @IsUUID('all', { message: 'Choose a client' })
  clientId: string;

  @IsUUID('all', { message: 'Choose a supplier' })
  supplierId: string;

  @IsUUID('all', { message: 'Choose a category' })
  categoryId: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsBoolean()
  chinaCheckedIn?: boolean;
}

export class UpdateGoodDto extends GoodFields {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  itemName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity must be a whole number' })
  @Min(1)
  @Max(1_000_000)
  quantity?: number;

  @IsOptional()
  @IsDecimalString({ intDigits: 10, fracDigits: 4 })
  unitCost?: string;

  @IsOptional()
  @IsDecimalString({ intDigits: 6, fracDigits: 6 })
  exchangeRate?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Choose a client' })
  clientId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Choose a supplier' })
  supplierId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'Choose a category' })
  categoryId?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateOnly()
  supplierReceivedAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateOnly()
  warehouseReceivedAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateOnly()
  departedAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateOnly()
  arrivedAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateOnly()
  deliveredAt?: string | null;
}

export class ChangeStatusDto {
  @IsEnum(ShipmentStatus)
  status: ShipmentStatus;

  /** The status the screen showed. If the good has moved since, the request is rejected instead of double-advancing. */
  @IsOptional()
  @IsEnum(ShipmentStatus)
  expectedStatus?: ShipmentStatus;

  /** Admin correction of an earlier stage (requires note). */
  @IsOptional()
  @IsBoolean()
  correction?: boolean;

  @IsOptional()
  @TrimToNull()
  @MaxLength(500)
  note?: string | null;
}

export class ChinaCheckInDto {
  @IsBoolean()
  checkedIn: boolean;

  @IsOptional()
  @TrimToNull()
  @MaxLength(500)
  note?: string | null;
}

export class ArchiveGoodDto {
  @IsOptional()
  @TrimToNull()
  @MaxLength(500)
  reason?: string | null;
}
