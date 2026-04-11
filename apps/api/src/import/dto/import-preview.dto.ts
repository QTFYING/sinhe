import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class ImportPreviewDto {
  @ApiPropertyOptional({ description: '显式指定的导入模板 ID；不传则由服务端尝试自动匹配' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({
    description: '前端解析后的原始行数据',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    example: [{ 客户名称: '深圳华强贸易', 订单号: 'ERP20260410001', 金额: 198.5 }],
  })
  @IsArray()
  @IsObject({ each: true })
  rows!: Array<Record<string, unknown>>;
}
