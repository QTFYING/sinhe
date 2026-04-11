import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SortOrderEnum, TenantSortFieldEnum, TenantStatusEnum } from '@shou/types/enums';

export class ListTenantsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize!: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(TenantStatusEnum)
  status?: (typeof TenantStatusEnum)[keyof typeof TenantStatusEnum];

  @IsOptional()
  @IsEnum(TenantSortFieldEnum)
  sortBy?: (typeof TenantSortFieldEnum)[keyof typeof TenantSortFieldEnum];

  @IsOptional()
  @IsEnum(SortOrderEnum)
  sortOrder?: (typeof SortOrderEnum)[keyof typeof SortOrderEnum];
}
