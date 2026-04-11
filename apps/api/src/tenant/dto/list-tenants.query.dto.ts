import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SortOrderEnum, TenantSortFieldEnum, TenantStatusEnum } from '@shou/types/enums';

export class ListTenantsQueryDto {
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

  @ApiPropertyOptional({ description: '关键字', example: '华南一区' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '租户状态', enum: Object.values(TenantStatusEnum), example: TenantStatusEnum.ACTIVE })
  @IsOptional()
  @IsEnum(TenantStatusEnum)
  status?: (typeof TenantStatusEnum)[keyof typeof TenantStatusEnum];

  @ApiPropertyOptional({ description: '排序字段', enum: Object.values(TenantSortFieldEnum), example: TenantSortFieldEnum.NAME })
  @IsOptional()
  @IsEnum(TenantSortFieldEnum)
  sortBy?: (typeof TenantSortFieldEnum)[keyof typeof TenantSortFieldEnum];

  @ApiPropertyOptional({ description: '排序方向', enum: Object.values(SortOrderEnum), example: SortOrderEnum.DESC })
  @IsOptional()
  @IsEnum(SortOrderEnum)
  sortOrder?: (typeof SortOrderEnum)[keyof typeof SortOrderEnum];
}
