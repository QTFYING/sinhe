import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TenantSideEnum } from '@shou/types/enums';

export class ListTenantMembersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsEnum(TenantSideEnum)
  tenantType?: (typeof TenantSideEnum)[keyof typeof TenantSideEnum];
}
