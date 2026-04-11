import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class CreateTenantAuditBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  action!: 'approve';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
