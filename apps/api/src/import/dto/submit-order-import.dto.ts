import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { OrderImportConflictPolicyEnum } from '@shou/types/enums';

export class SubmitOrderImportDto {
  @ApiPropertyOptional({ description: '预检批次 ID；传入后优先复用预检结果' })
  @IsOptional()
  @IsString()
  previewId?: string;

  @ApiPropertyOptional({ description: '导入模板 ID；未传 previewId 时用于正式导入' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    description: '重复订单冲突策略',
    enum: Object.values(OrderImportConflictPolicyEnum),
    example: OrderImportConflictPolicyEnum.SKIP,
  })
  @IsOptional()
  @IsIn(Object.values(OrderImportConflictPolicyEnum))
  conflictPolicy?: (typeof OrderImportConflictPolicyEnum)[keyof typeof OrderImportConflictPolicyEnum];

  @ApiPropertyOptional({
    description: '未传 previewId 时，可直接提交前端解析后的原始行数据',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  rows?: Array<Record<string, unknown>>;
}
