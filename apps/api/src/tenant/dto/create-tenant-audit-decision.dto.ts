import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReviewActionEnum } from '@shou/types/enums';

export class CreateTenantAuditDecisionDto {
  @IsEnum(ReviewActionEnum)
  action!: (typeof ReviewActionEnum)[keyof typeof ReviewActionEnum];

  @IsOptional()
  @IsString()
  reviewNote?: string;

  @IsOptional()
  @IsString()
  rejectReason?: string;
}
