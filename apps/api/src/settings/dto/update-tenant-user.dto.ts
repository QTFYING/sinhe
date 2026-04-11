import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TenantRoleEnum, UserSimpleStatusEnum } from '@shou/types/enums';

export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsEnum(TenantRoleEnum)
  role?: (typeof TenantRoleEnum)[keyof typeof TenantRoleEnum];

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserSimpleStatusEnum)
  status?: (typeof UserSimpleStatusEnum)[keyof typeof UserSimpleStatusEnum];
}
