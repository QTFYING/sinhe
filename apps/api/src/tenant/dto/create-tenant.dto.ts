import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ description: '租户名称', example: '华南一区商户A' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: '联系电话', example: '13800138000' })
  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @ApiProperty({ description: '最大账期天数', example: 30 })
  @IsInt()
  @Min(1)
  maxCreditDays!: number;
}
