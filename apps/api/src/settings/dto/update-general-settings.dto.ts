import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateGeneralSettingsDto {
  @ApiPropertyOptional({ description: '企业名称', example: '深圳华强贸易有限公司' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: '联系人', example: '张三' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: '联系电话', example: '13800138000' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: '企业地址', example: '深圳市南山区科技园' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '营业执照号', example: '91440300MA5FXXXXXX' })
  @IsOptional()
  @IsString()
  licenseNo?: string;

  @ApiPropertyOptional({ description: '收款码有效期（天）', example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qrCodeExpiry?: number;

  @ApiPropertyOptional({ description: '是否通知业务员', example: true })
  @IsOptional()
  @IsBoolean()
  notifySeller?: boolean;

  @ApiPropertyOptional({ description: '是否通知老板', example: true })
  @IsOptional()
  @IsBoolean()
  notifyOwner?: boolean;

  @ApiPropertyOptional({ description: '是否通知财务', example: true })
  @IsOptional()
  @IsBoolean()
  notifyFinance?: boolean;

  @ApiPropertyOptional({ description: '账期提醒提前天数', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  creditRemindDays?: number;

  @ApiPropertyOptional({ description: '是否推送每日收款日报', example: true })
  @IsOptional()
  @IsBoolean()
  dailyReportPush?: boolean;
}
