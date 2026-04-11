import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VoidOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  voidReason!: string;
}
