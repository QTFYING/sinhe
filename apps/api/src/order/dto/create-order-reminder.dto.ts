import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateOrderReminderDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];
}
