import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePrintingConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  configVersion?: number;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  remark?: string;
}
