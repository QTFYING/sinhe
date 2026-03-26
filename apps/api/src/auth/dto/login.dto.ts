import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
