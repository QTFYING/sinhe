import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { OrderLineItemDto } from '../../order/dto/order-line-item.dto';

export class ImportPreviewOrderDto {
  @ApiProperty({ description: '源订单号', example: 'SO-20260415-001' })
  @IsString()
  @IsNotEmpty()
  sourceOrderNo!: string;

  @ApiProperty({ description: '辅助分组/防重键', example: 'SO-20260415-001', required: false })
  @IsOptional()
  @IsString()
  groupKey?: string;

  @ApiProperty({ description: '客户名称', example: '深圳华强贸易' })
  @IsString()
  @IsNotEmpty()
  customer!: string;

  @ApiProperty({ description: '主商品名称', example: '农夫山泉 550ml' })
  @IsString()
  @IsNotEmpty()
  skuName!: string;

  @ApiProperty({ description: '主展示行金额', example: 24 })
  lineAmount!: number | string;

  @ApiProperty({ description: '订单总金额', example: 48 })
  totalAmount!: number | string;

  @ApiProperty({ description: '下单时间', example: '2026-04-15 09:30:00' })
  @IsString()
  @IsNotEmpty()
  orderTime!: string;

  @ApiProperty({
    description: '模板自定义字段值',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { customerKey1: 'MD001', customerKey2: '张三' },
  })
  @IsObject()
  customerValues!: Record<string, string>;

  @ApiProperty({ description: '订单明细', type: [OrderLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemDto)
  lineItems!: OrderLineItemDto[];
}

export class ImportPreviewDto {
  @ApiProperty({ description: '导入模板 ID', format: 'uuid' })
  @IsUUID()
  templateId!: string;

  @ApiProperty({ description: '前端根据映射模板回填后的标准订单数组', type: [ImportPreviewOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportPreviewOrderDto)
  orders!: ImportPreviewOrderDto[];
}
