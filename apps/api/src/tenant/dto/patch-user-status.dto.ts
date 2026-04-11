import { IsEnum } from 'class-validator';
import { UserStatusEnum } from '@shou/types/enums';

export class PatchUserStatusDto {
  @IsEnum(UserStatusEnum)
  status!: (typeof UserStatusEnum)[keyof typeof UserStatusEnum];
}
