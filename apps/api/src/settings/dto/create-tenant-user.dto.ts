import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TenantRoleEnum } from '@shou/types/enums';

export class CreateTenantUserDto {
  @ApiProperty({ description: '姓名', example: '李四' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '手机号/登录账号', example: '13800138000' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '角色', enum: Object.values(TenantRoleEnum), example: TenantRoleEnum.OPERATOR })
  @IsEnum(TenantRoleEnum)
  role!: (typeof TenantRoleEnum)[keyof typeof TenantRoleEnum];

  @ApiPropertyOptional({ description: '初始密码，默认 123456', example: '123456' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
