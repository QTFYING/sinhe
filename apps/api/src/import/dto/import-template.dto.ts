import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ImportTemplateFieldDto {
  @ApiProperty({ description: '字段名称', example: '客户名称' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ description: '字段 key', example: 'customer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  key!: string;

  @ApiProperty({ description: 'ERP 表头映射值', example: '客户名称' })
  @IsString()
  mapStr!: string;

  @ApiProperty({ description: '是否系统必填', example: true })
  @IsBoolean()
  isRequired!: boolean;
}

export class ImportTemplateCustomerFieldDto {
  @ApiProperty({ description: '字段名称', example: '客户编码' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ description: 'ERP 表头映射值', example: '客商编码' })
  @IsString()
  mapStr!: string;
}

export class CreateImportTemplateDto {
  @ApiProperty({ description: '模板名称', example: '饮品订单模板' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: '是否默认模板', example: true })
  @IsBoolean()
  isDefault!: boolean;

  @ApiProperty({ description: '系统默认字段映射', type: [ImportTemplateFieldDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateFieldDto)
  defaultFields!: ImportTemplateFieldDto[];

  @ApiProperty({ description: '自定义字段映射', type: [ImportTemplateCustomerFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateCustomerFieldDto)
  customerFields!: ImportTemplateCustomerFieldDto[];
}

export class UpdateImportTemplateDto {
  @ApiPropertyOptional({ description: '模板名称', example: '饮品订单模板' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '是否默认模板', example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '系统默认字段映射', type: [ImportTemplateFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateFieldDto)
  defaultFields?: ImportTemplateFieldDto[];

  @ApiPropertyOptional({ description: '自定义字段映射', type: [ImportTemplateCustomerFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateCustomerFieldDto)
  customerFields?: ImportTemplateCustomerFieldDto[];
}
