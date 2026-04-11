import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNumber, IsString, Min } from 'class-validator';
import { TenantRenewPaymentMethodEnum } from '@shou/types/enums';

export class CreateTenantRenewalDto {
  @ApiProperty({ description: '套餐名称', example: '标准版' })
  @IsString()
  packageName!: string;

  @ApiProperty({ description: '续费天数', example: 90, enum: [30, 90, 180, 365] })
  @Type(() => Number)
  @IsIn([30, 90, 180, 365])
  days!: 30 | 90 | 180 | 365;

  @ApiProperty({ description: '续费金额（元）', example: 999 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ description: '续费支付方式', enum: Object.values(TenantRenewPaymentMethodEnum), example: TenantRenewPaymentMethodEnum.BANK_TRANSFER })
  @IsEnum(TenantRenewPaymentMethodEnum)
  paymentMethod!: (typeof TenantRenewPaymentMethodEnum)[keyof typeof TenantRenewPaymentMethodEnum];
}
