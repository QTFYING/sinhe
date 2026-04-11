import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class CreateTenantAdminDto {
  @ApiProperty({ description: '租户名称', example: '华南一区商户A' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '套餐名称', example: '标准版' })
  @IsString()
  packageName!: string;

  @ApiProperty({ description: '管理员名称', example: '张三' })
  @IsString()
  admin!: string;

  @ApiProperty({ description: '区域', example: '广东深圳' })
  @IsString()
  region!: string;

  @ApiProperty({ description: '渠道标识', example: 'lakala' })
  @IsString()
  channel!: string;

  @ApiProperty({ description: '距到期天数', example: 30 })
  @IsInt()
  @Min(1)
  dueInDays!: number;
}
