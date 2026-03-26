import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class AdjustPriceDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: '金额格式不正确，必须是数字字符串 (如 "1580.00")' })
  newDiscountAmount!: string;

  @IsString()
  @IsNotEmpty()
  remark!: string;
}
