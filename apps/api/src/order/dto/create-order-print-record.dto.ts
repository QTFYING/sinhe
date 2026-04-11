import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateOrderPrintRecordDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
