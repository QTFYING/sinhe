import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @IsInt()
  @Min(1)
  maxCreditDays!: number;
}
