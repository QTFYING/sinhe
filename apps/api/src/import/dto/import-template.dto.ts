import { Type } from 'class-transformer';
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
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  index!: number;

  @IsOptional()
  @IsString()
  sampleValue?: string;
}

export class ImportTemplateFieldDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsIn(Object.values(OrderTemplateFieldTypeEnum))
  fieldType!: (typeof OrderTemplateFieldTypeEnum)[keyof typeof OrderTemplateFieldTypeEnum];

  @IsBoolean()
  required!: boolean;

  @IsBoolean()
  visible!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;

  @IsOptional()
  @IsBoolean()
  builtin?: boolean;
}

export class ImportTemplateMappingDto {
  @IsString()
  @IsNotEmpty()
  sourceColumn!: string;

  @IsString()
  @IsNotEmpty()
  targetField!: string;

  @IsOptional()
  @IsString()
  sampleValue?: string;
}

export class CreateImportTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  isDefault!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateSourceColumnDto)
  sourceColumns!: ImportTemplateSourceColumnDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateFieldDto)
  fields!: ImportTemplateFieldDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateMappingDto)
  mappings!: ImportTemplateMappingDto[];
}

export class UpdateImportTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateSourceColumnDto)
  sourceColumns?: ImportTemplateSourceColumnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateFieldDto)
  fields?: ImportTemplateFieldDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTemplateMappingDto)
  mappings?: ImportTemplateMappingDto[];
}
