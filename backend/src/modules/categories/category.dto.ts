import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { TrimToNull } from '../../common/validation/decorators';

export class CategoryDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @TrimToNull()
  @MaxLength(300)
  description?: string | null;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @TrimToNull()
  @MaxLength(300)
  description?: string | null;
}
