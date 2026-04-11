import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListUsersQueryDto {
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

  @ApiPropertyOptional({ description: '关键字', example: '管理员A' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '租户关键字', example: '平台' })
  @IsOptional()
  @IsString()
  tenant?: string;

  @ApiPropertyOptional({ description: '角色关键字', example: 'OS_SUPER_ADMIN' })
  @IsOptional()
  @IsString()
  role?: string;
}
