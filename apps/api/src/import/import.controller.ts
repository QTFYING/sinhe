import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import type {
  CreateOrderImportTemplateRequest,
  OrderImportJobResponse,
  OrderImportPreviewRequest,
  OrderImportPreviewResponse,
  OrderImportSubmitRequest,
  OrderImportSubmitResponse,
  OrderImportTemplate,
  UpdateOrderImportTemplateRequest,
} from '@shou/types/contracts';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ImportPreviewDto } from './dto/import-preview.dto';
import { CreateImportTemplateDto, UpdateImportTemplateDto } from './dto/import-template.dto';
import { SubmitOrderImportDto } from './dto/submit-order-import.dto';
import { ImportService } from './import.service';

@ApiTags('Import')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @ApiOperation({ summary: '获取导入模板列表' })
  @Get('import/templates')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async getImportTemplates(@CurrentUser() currentUser: JwtPayload): Promise<OrderImportTemplate[]> {
    return this.importService.getImportTemplates(currentUser);
  }

  @ApiOperation({ summary: '创建导入模板' })
  @Post('import/templates')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async createImportTemplate(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateImportTemplateDto,
  ): Promise<OrderImportTemplate> {
    return this.importService.createImportTemplate(
      currentUser,
      request as CreateOrderImportTemplateRequest,
    );
  }

  @ApiOperation({ summary: '更新导入模板' })
  @Put('import/templates/:id')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async updateImportTemplate(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: UpdateImportTemplateDto,
  ): Promise<OrderImportTemplate> {
    return this.importService.updateImportTemplate(
      currentUser,
      id,
      request as UpdateOrderImportTemplateRequest,
    );
  }

  @ApiOperation({ summary: '导入预检' })
  @Post('import/preview')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async previewImport(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: ImportPreviewDto,
  ): Promise<OrderImportPreviewResponse> {
    return this.importService.previewImport(currentUser, request as OrderImportPreviewRequest);
  }

  @ApiOperation({ summary: '正式导入订单' })
  @Post('orders/import')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async submitOrderImport(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: SubmitOrderImportDto,
  ): Promise<OrderImportSubmitResponse> {
    return this.importService.submitOrderImport(currentUser, request as OrderImportSubmitRequest);
  }

  @ApiOperation({ summary: '查询导入任务进度' })
  @Get('orders/import/jobs/:jobId')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async getImportJob(
    @CurrentUser() currentUser: JwtPayload,
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<OrderImportJobResponse> {
    return this.importService.getImportJob(currentUser, jobId);
  }
}
