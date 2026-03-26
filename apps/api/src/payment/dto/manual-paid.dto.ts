import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class ManualPaidDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: '金额格式不正确' })
  actualAmount!: string;

  @IsString()
  @IsNotEmpty()
  markReason!: string;

  @IsOptional()
  @IsString()
  paidTime?: string;
}
