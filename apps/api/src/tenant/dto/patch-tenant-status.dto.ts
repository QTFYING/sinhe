import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FreezeActionEnum } from '@shou/types/enums';

export class PatchTenantStatusDto {
  @IsEnum(FreezeActionEnum)
  action!: (typeof FreezeActionEnum)[keyof typeof FreezeActionEnum];

  @IsOptional()
  @IsString()
  reason?: string;
}
