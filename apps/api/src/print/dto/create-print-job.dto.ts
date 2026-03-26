import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class CreatePrintJobDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  orderIds!: string[];
}
