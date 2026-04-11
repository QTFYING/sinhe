import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsString, Min } from 'class-validator';
import { TenantRenewPaymentMethodEnum } from '@shou/types/enums';

export class CreateTenantRenewalDto {
  @IsString()
  packageName!: string;

  @Type(() => Number)
  @IsIn([30, 90, 180, 365])
  days!: 30 | 90 | 180 | 365;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsEnum(TenantRenewPaymentMethodEnum)
  paymentMethod!: (typeof TenantRenewPaymentMethodEnum)[keyof typeof TenantRenewPaymentMethodEnum];
}
