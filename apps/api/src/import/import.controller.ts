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
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import type {
  CreateOrderImportTemplateRequest,
  OrderImportJobResponse,
  OrderImportPreviewRequest,
  OrderImportPreviewResponse,
  OrderImportSubmitRequest,
  OrderImportSubmitResponse,
  OrderImportTemplateMutationResponse,
  OrderImportTemplate,
  OrderImportTemplateField,
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
import {
  OrderImportJobResponseSwagger,
  OrderImportPreviewResponseSwagger,
  OrderImportSubmitResponseSwagger,
  OrderImportTemplateFieldSwagger,
  OrderImportTemplateMutationResponseSwagger,
  OrderImportTemplateSwagger,
} from './import.swagger';

@ApiTags('Import')
@ApiBearerAuth()
@ApiExtraModels(
  OrderImportTemplateFieldSwagger,
  OrderImportTemplateSwagger,
  OrderImportTemplateMutationResponseSwagger,
  OrderImportPreviewResponseSwagger,
  OrderImportSubmitResponseSwagger,
  OrderImportJobResponseSwagger,
)
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @ApiOperation({ summary: '获取系统默认映射模板' })
  @ApiOkResponse({ type: [OrderImportTemplateFieldSwagger] })
  @Get('import/default-template')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getDefaultTemplate(): Promise<OrderImportTemplateField[]> {
    return this.importService.getDefaultTemplate();
  }

  @ApiOperation({ summary: '获取导入模板列表' })
  @ApiOkResponse({ type: [OrderImportTemplateSwagger] })
  @Get('import/templates')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async getImportTemplates(@CurrentUser() currentUser: JwtPayload): Promise<OrderImportTemplate[]> {
    return this.importService.getImportTemplates(currentUser);
  }

  @ApiOperation({ summary: '创建导入模板' })
  @ApiOkResponse({ type: OrderImportTemplateMutationResponseSwagger })
  @Post('import/templates')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async createImportTemplate(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateImportTemplateDto,
  ): Promise<OrderImportTemplateMutationResponse> {
    return this.importService.createImportTemplate(
      currentUser,
      request as CreateOrderImportTemplateRequest,
    );
  }

  @ApiOperation({ summary: '更新导入模板' })
  @ApiParam({ name: 'id', description: '导入模板 ID', format: 'uuid' })
  @ApiOkResponse({ type: OrderImportTemplateMutationResponseSwagger })
  @Put('import/templates/:id')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async updateImportTemplate(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: UpdateImportTemplateDto,
  ): Promise<OrderImportTemplateMutationResponse> {
    return this.importService.updateImportTemplate(
      currentUser,
      id,
      request as UpdateOrderImportTemplateRequest,
    );
  }

  @ApiOperation({ summary: '导入预检' })
  @ApiOkResponse({ type: OrderImportPreviewResponseSwagger })
  @Post('import/preview')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async previewImport(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: ImportPreviewDto,
  ): Promise<OrderImportPreviewResponse> {
    return this.importService.previewImport(currentUser, request as OrderImportPreviewRequest);
  }

  @ApiOperation({ summary: '正式导入订单' })
  @ApiOkResponse({ type: OrderImportSubmitResponseSwagger })
  @Post('orders/import')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async submitOrderImport(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: SubmitOrderImportDto,
  ): Promise<OrderImportSubmitResponse> {
    return this.importService.submitOrderImport(currentUser, request as OrderImportSubmitRequest);
  }

  @ApiOperation({ summary: '查询导入任务进度' })
  @ApiParam({ name: 'jobId', description: '导入任务 ID', format: 'uuid' })
  @ApiOkResponse({ type: OrderImportJobResponseSwagger })
  @Get('orders/import/jobs/:jobId')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async getImportJob(
    @CurrentUser() currentUser: JwtPayload,
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<OrderImportJobResponse> {
    return this.importService.getImportJob(currentUser, jobId);
  }
}
