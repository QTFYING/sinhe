import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class OrderLineItemDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  skuId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  skuName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  skuSpec?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  lineAmount!: number;
}
