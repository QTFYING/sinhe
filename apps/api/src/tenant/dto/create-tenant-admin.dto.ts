import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class CreateTenantAdminDto {
  @IsString()
  name!: string;

  @IsString()
  packageName!: string;

  @IsString()
  admin!: string;

  @IsString()
  region!: string;

  @IsString()
  channel!: string;

  @IsInt()
  @Min(1)
  dueInDays!: number;
}
