import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class CreateTenantStatusChangeBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  reason!: string;
}
