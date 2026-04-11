import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAuditLogsQueryDto {
  @ApiProperty({ description: '页码', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize!: number;

  @ApiPropertyOptional({ description: '开始日期', example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期', example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '操作人关键字', example: '张三' })
  @IsOptional()
  @IsString()
  operator?: string;
}
