import { IsString, Matches } from 'class-validator';

export class UpdatePricingDto {
  /** GHS per 1 CNY, up to 6 decimal places, greater than zero. */
  @IsString()
  @Matches(/^(?!0+(\.0+)?$)\d{1,6}(\.\d{1,6})?$/, { message: 'defaultExchangeRate must be a positive number with up to 6 decimal places' })
  defaultExchangeRate: string;
}
