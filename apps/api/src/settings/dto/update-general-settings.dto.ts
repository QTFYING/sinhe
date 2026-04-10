import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  licenseNo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qrCodeExpiry?: number;

  @IsOptional()
  @IsBoolean()
  notifySeller?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOwner?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyFinance?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  creditRemindDays?: number;

  @IsOptional()
  @IsBoolean()
  dailyReportPush?: boolean;
}
