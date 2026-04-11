import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitOfflinePaymentDto {
  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
