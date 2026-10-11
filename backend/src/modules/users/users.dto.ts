import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '../../generated/prisma/enums';

export class CreateUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @IsString()
  @Length(1, 120)
  name: string;

  @IsEnum(Role)
  role: Role;

  /** Send the Supabase invitation email now (needs SUPABASE_SERVICE_ROLE_KEY on the server). */
  @IsOptional()
  @IsBoolean()
  sendInvite?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
