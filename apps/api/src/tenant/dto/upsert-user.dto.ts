import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TenantSideEnum, UserStatusEnum } from '@shou/types/enums';

export class UpsertUserDto {
  @IsString()
  name!: string;

  @IsString()
  account!: string;

  @IsString()
  phone!: string;

  @IsEnum(TenantSideEnum)
  tenantType!: (typeof TenantSideEnum)[keyof typeof TenantSideEnum];

  @IsString()
  tenant!: string;

  @IsString()
  role!: string;

  @IsString()
  scope!: string;

  @IsOptional()
  @IsEnum(UserStatusEnum)
  status?: (typeof UserStatusEnum)[keyof typeof UserStatusEnum];
}
