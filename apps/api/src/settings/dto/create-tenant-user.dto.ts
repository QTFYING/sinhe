import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TenantRoleEnum } from '@shou/types/enums';

export class CreateTenantUserDto {
  @IsString()
  name!: string;

  @IsString()
  phone!: string;

  @IsEnum(TenantRoleEnum)
  role!: (typeof TenantRoleEnum)[keyof typeof TenantRoleEnum];

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
