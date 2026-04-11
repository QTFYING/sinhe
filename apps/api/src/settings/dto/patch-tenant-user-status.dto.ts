import { IsEnum } from 'class-validator';
import { UserSimpleStatusEnum } from '@shou/types/enums';

export class PatchTenantUserStatusDto {
  @IsEnum(UserSimpleStatusEnum)
  status!: (typeof UserSimpleStatusEnum)[keyof typeof UserSimpleStatusEnum];
}
