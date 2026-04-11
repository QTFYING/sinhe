import { IsOptional, IsString } from 'class-validator';

export class CreateTenantCertificationDto {
  @IsString()
  licenseUrl!: string;

  @IsString()
  legalPerson!: string;

  @IsString()
  legalIdCard!: string;

  @IsString()
  contactPhone!: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
