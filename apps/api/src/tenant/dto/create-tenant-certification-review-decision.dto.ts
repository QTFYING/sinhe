import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReviewActionEnum } from '@shou/types/enums';

export class CreateTenantCertificationReviewDecisionDto {
  @IsEnum(ReviewActionEnum)
  action!: (typeof ReviewActionEnum)[keyof typeof ReviewActionEnum];

  @IsOptional()
  @IsString()
  comment?: string;
}
