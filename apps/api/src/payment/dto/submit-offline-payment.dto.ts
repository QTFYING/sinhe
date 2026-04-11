import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { OfflinePaymentMethodEnum } from '@shou/types/enums';

export class SubmitOfflinePaymentDto {
  @ApiProperty({ description: '线下支付方式', enum: Object.values(OfflinePaymentMethodEnum), example: OfflinePaymentMethodEnum.OTHER_PAID })
  @IsString()
  paymentMethod!: string;

  @ApiPropertyOptional({ description: '备注', example: '客户已通过其他方式付款' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
