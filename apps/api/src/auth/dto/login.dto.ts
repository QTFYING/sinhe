import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: '账号名称 (最高管理员或租户员工)', example: 'admin' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ description: '登录密码', example: '123456' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ description: '商户隔离ID (OS超级系统管理员留空不传此字段)', example: 'd290f1ee-6c54-4b01-90e6-d701748f0851' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
