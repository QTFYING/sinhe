import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateOrderReceiptDto {
  @ApiPropertyOptional({ description: '本次回款金额；不传则默认补齐剩余未收金额', example: 98.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ description: '备注', example: '客户线下回款' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
