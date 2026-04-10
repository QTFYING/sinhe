import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { OrderImportConflictPolicyEnum } from '@shou/types/enums';

export class SubmitOrderImportDto {
  @IsOptional()
  @IsString()
  previewId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsIn(Object.values(OrderImportConflictPolicyEnum))
  conflictPolicy?: (typeof OrderImportConflictPolicyEnum)[keyof typeof OrderImportConflictPolicyEnum];

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  rows?: Array<Record<string, unknown>>;
}
