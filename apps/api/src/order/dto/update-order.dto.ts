import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderPayTypeEnum, OrderStatusEnum } from '@shou/types/enums';
import { OrderLineItemDto } from './order-line-item.dto';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  summary?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

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

  @IsOptional()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemDto)
  lineItems?: OrderLineItemDto[];

  @IsOptional()
  @IsObject()
  customFieldValues?: Record<string, string>;
}
