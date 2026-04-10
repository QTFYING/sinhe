import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class ImportPreviewDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsArray()
  @IsObject({ each: true })
  rows!: Array<Record<string, unknown>>;
}
