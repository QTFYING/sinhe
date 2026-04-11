import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { OrderPayTypeEnum, OrderStatusEnum } from '@shou/types/enums';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  summary?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paid?: number;

  @IsOptional()
  @IsEnum(OrderStatusEnum)
  status?: (typeof OrderStatusEnum)[keyof typeof OrderStatusEnum];

  @IsOptional()
  @IsEnum(OrderPayTypeEnum)
  payType?: (typeof OrderPayTypeEnum)[keyof typeof OrderPayTypeEnum];

  @IsOptional()
  @IsDateString()
  date?: string;
}
