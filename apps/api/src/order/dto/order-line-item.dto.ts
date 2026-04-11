import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({ description: '行项目 ID' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ description: '商品主数据 ID', example: 'SKU-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  skuId?: string | null;

  @ApiProperty({ description: '商品名称', example: '农夫山泉 550ml' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  skuName!: string;

  @ApiPropertyOptional({ description: '商品规格', example: '24瓶/箱' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  skuSpec?: string;

  @ApiProperty({ description: '单位', example: '箱' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit!: string;

  @ApiProperty({ description: '数量', example: 2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiProperty({ description: '单价（元）', example: 48.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @ApiProperty({ description: '行金额（元）', example: 97 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  lineAmount!: number;
}
