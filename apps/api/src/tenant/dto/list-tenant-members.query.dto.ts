import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TenantSideEnum } from '@shou/types/enums';

export class ListTenantMembersQueryDto {
  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional({ description: '所属侧筛选', enum: Object.values(TenantSideEnum), example: TenantSideEnum.TENANT })
  @IsOptional()
  @IsEnum(TenantSideEnum)
  tenantType?: (typeof TenantSideEnum)[keyof typeof TenantSideEnum];
}
