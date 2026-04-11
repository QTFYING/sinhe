import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserPasswordResetDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
