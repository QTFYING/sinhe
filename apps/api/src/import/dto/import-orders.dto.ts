import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsNumber()
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  unitPrice!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;
}

export class OrderDto {
  @IsString()
  @IsNotEmpty()
  erpOrderNo!: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  deliveryPersonName?: string;

  @IsString()
  @IsNotEmpty()
  totalAmount!: string;

  @IsOptional()
  customFields?: any;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class ImportOrdersDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderDto)
  orders!: OrderDto[];
}
