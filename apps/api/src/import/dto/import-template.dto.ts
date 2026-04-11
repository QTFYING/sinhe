import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderTemplateFieldTypeEnum } from '@shou/types/enums';

export class ImportTemplateSourceColumnDto {
  @ApiProperty({ description: '源列 key', example: 'customer_name' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ description: '源列表头标题', example: '客户名称' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: '列索引，从 0 开始', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index!: number;

  @ApiPropertyOptional({ description: '样例值', example: '深圳华强贸易' })
  @IsOptional()
  @IsString()
  sampleValue?: string;
}

export class ImportTemplateFieldDto {
  @ApiProperty({ description: '目标字段 key', example: 'customer' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ description: '字段名称', example: '客户名称' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ description: '字段类型', enum: Object.values(OrderTemplateFieldTypeEnum), example: OrderTemplateFieldTypeEnum.TEXT })
  @IsIn(Object.values(OrderTemplateFieldTypeEnum))
  fieldType!: (typeof OrderTemplateFieldTypeEnum)[keyof typeof OrderTemplateFieldTypeEnum];

  @ApiProperty({ description: '是否必填', example: true })
  @IsBoolean()
  required!: boolean;

  @ApiProperty({ description: '是否可见', example: true })
  @IsBoolean()
  visible!: boolean;

  @ApiProperty({ description: '排序号', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;

  @ApiPropertyOptional({ description: '是否内置字段', example: true })
  @IsOptional()
  @IsBoolean()
  builtin?: boolean;
}

export class ImportTemplateMappingDto {
  @ApiProperty({ description: '源列名', example: '客户名称' })
  @IsString()
  @IsNotEmpty()
  sourceColumn!: string;

  @ApiProperty({ description: '目标字段 key', example: 'customer' })
  @IsString()
  @IsNotEmpty()
  targetField!: string;

  @ApiPropertyOptional({ description: '样例值', example: '深圳华强贸易' })
  @IsOptional()
  @IsString()
  sampleValue?: string;
}

export class CreateImportTemplateDto {
  @ApiProperty({ description: '模板名称', example: '饮品订单模板' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: '是否默认模板', example: true })
  @IsBoolean()
  isDefault!: boolean;

  @ApiProperty({ description: '源列定义', type: [ImportTemplateSourceColumnDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateSourceColumnDto)
  sourceColumns!: ImportTemplateSourceColumnDto[];

  @ApiProperty({ description: '目标字段定义', type: [ImportTemplateFieldDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateFieldDto)
  fields!: ImportTemplateFieldDto[];

  @ApiProperty({ description: '映射关系', type: [ImportTemplateMappingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateMappingDto)
  mappings!: ImportTemplateMappingDto[];
}

export class UpdateImportTemplateDto {
  @ApiPropertyOptional({ description: '模板名称', example: '饮品订单模板' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: '是否默认模板', example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '源列定义', type: [ImportTemplateSourceColumnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateSourceColumnDto)
  sourceColumns?: ImportTemplateSourceColumnDto[];

  @ApiPropertyOptional({ description: '目标字段定义', type: [ImportTemplateFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateFieldDto)
  fields?: ImportTemplateFieldDto[];

  @ApiPropertyOptional({ description: '映射关系', type: [ImportTemplateMappingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateMappingDto)
  mappings?: ImportTemplateMappingDto[];
}
