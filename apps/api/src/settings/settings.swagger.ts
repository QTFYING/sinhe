import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantRoleEnum, UserSimpleStatusEnum } from '@shou/types/enums';

export class PermissionNodeSwagger {
  @ApiProperty({ description: '权限节点 ID', example: 'orders.view' })
  id!: string;

  @ApiProperty({ description: '权限节点名称', example: '查看订单列表' })
  label!: string;

  @ApiPropertyOptional({ description: '子节点', type: () => PermissionNodeSwagger, isArray: true })
  children?: PermissionNodeSwagger[];
}

export class TenantRoleAccountSwagger {
  @ApiProperty({ description: '角色 ID' })
  id!: string;

  @ApiProperty({ description: '角色名称', example: '财务' })
  name!: string;

  @ApiPropertyOptional({ description: '角色描述', example: '负责核销与对账' })
  description?: string;

  @ApiProperty({ description: '权限标识列表', type: [String], example: ['payments.view', 'orders.credit'] })
  permissions!: string[];

  @ApiProperty({ description: '是否系统内置角色', example: true })
  isSystem!: boolean;

  @ApiProperty({ description: '角色绑定用户数', example: 2 })
  userCount!: number;
}

export class TenantSettingsUserSwagger {
  @ApiProperty({ description: '用户 ID' })
  id!: string;

  @ApiProperty({ description: '姓名', example: '李四' })
  name!: string;

  @ApiProperty({ description: '登录账号', example: '13800138000' })
  account!: string;

  @ApiProperty({ description: '角色', enum: Object.values(TenantRoleEnum), example: TenantRoleEnum.FINANCE })
  role!: string;

  @ApiProperty({ description: '手机号', example: '13800138000' })
  phone!: string;

  @ApiProperty({ description: '状态', enum: Object.values(UserSimpleStatusEnum), example: UserSimpleStatusEnum.ACTIVE })
  status!: string;

  @ApiProperty({ description: '最后登录时间', example: '2026-04-11T09:00:00.000Z' })
  lastLogin!: string;
}

export class TenantGeneralSettingsSwagger {
  @ApiProperty({ description: '企业名称', example: '深圳华强贸易有限公司' })
  companyName!: string;

  @ApiProperty({ description: '联系人', example: '张三' })
  contactPerson!: string;

  @ApiProperty({ description: '联系电话', example: '13800138000' })
  contactPhone!: string;

  @ApiProperty({ description: '企业地址', example: '深圳市南山区科技园' })
  address!: string;

  @ApiProperty({ description: '营业执照号', example: '91440300MA5FXXXXXX' })
  licenseNo!: string;

  @ApiProperty({ description: '收款码有效期（天）', example: 30 })
  qrCodeExpiry!: number;

  @ApiProperty({ description: '是否通知业务员', example: true })
  notifySeller!: boolean;

  @ApiProperty({ description: '是否通知老板', example: true })
  notifyOwner!: boolean;

  @ApiProperty({ description: '是否通知财务', example: true })
  notifyFinance!: boolean;

  @ApiProperty({ description: '账期提醒提前天数', example: 3 })
  creditRemindDays!: number;

  @ApiProperty({ description: '是否推送每日收款日报', example: true })
  dailyReportPush!: boolean;
}

export class PrintingConfigListItemSwagger {
  @ApiProperty({ description: '导入映射模板 ID' })
  importTemplateId!: string;

  @ApiProperty({ description: '导入映射模板名称', example: '饮品导入模板' })
  importTemplateName!: string;

  @ApiProperty({ description: '是否存在自定义打印配置', example: true })
  hasCustomConfig!: boolean;

  @ApiPropertyOptional({ description: '配置版本号', example: 3 })
  configVersion?: number;

  @ApiPropertyOptional({ description: '最近更新时间', example: '2026-04-11T09:00:00.000Z' })
  updatedAt?: string;

  @ApiPropertyOptional({ description: '最近更新人', example: 'TENANT_OWNER' })
  updatedBy?: string;

  @ApiPropertyOptional({ description: '备注', example: '适配饮品送货单' })
  remark?: string;
}

export class GetPrintingConfigListResponseSwagger {
  @ApiProperty({ description: '打印配置摘要列表', type: [PrintingConfigListItemSwagger] })
  items!: PrintingConfigListItemSwagger[];
}

export class GetPrintingConfigDetailResponseSwagger {
  @ApiProperty({ description: '导入映射模板 ID' })
  importTemplateId!: string;

  @ApiPropertyOptional({ description: '导入映射模板名称', example: '饮品导入模板' })
  importTemplateName?: string;

  @ApiProperty({ description: '是否存在自定义配置', example: true })
  hasCustomConfig!: boolean;

  @ApiPropertyOptional({ description: '配置版本号', example: 3 })
  configVersion?: number;

  @ApiPropertyOptional({
    description: '打印配置 JSON 黑盒快照',
    type: 'object',
    additionalProperties: true,
    example: { page: { width: 210, height: 297 }, fields: [{ key: 'customer', x: 20, y: 30 }] },
  })
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '最近更新时间', example: '2026-04-11T09:00:00.000Z' })
  updatedAt?: string;

  @ApiPropertyOptional({ description: '最近更新人', example: 'TENANT_OWNER' })
  updatedBy?: string;

  @ApiPropertyOptional({ description: '备注', example: '适配饮品送货单' })
  remark?: string;
}

export class UpdatePrintingConfigResponseSwagger {
  @ApiProperty({ description: '导入映射模板 ID' })
  importTemplateId!: string;

  @ApiProperty({ description: '是否存在自定义配置', example: true })
  hasCustomConfig!: boolean;

  @ApiProperty({ description: '最新配置版本号', example: 4 })
  configVersion!: number;

  @ApiProperty({ description: '更新时间', example: '2026-04-11T09:00:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ description: '更新人', example: 'TENANT_OWNER' })
  updatedBy?: string;

  @ApiPropertyOptional({ description: '备注', example: '适配饮品送货单' })
  remark?: string;
}

export class AuditLogRecordSwagger {
  @ApiProperty({ description: '日志 ID' })
  id!: string;

  @ApiProperty({ description: '操作内容', example: '更新通用配置' })
  action!: string;

  @ApiProperty({ description: '操作人', example: '张三' })
  operator!: string;

  @ApiProperty({ description: '操作 IP', example: '127.0.0.1' })
  ip!: string;

  @ApiProperty({ description: '操作时间', example: '2026-04-11T09:00:00.000Z' })
  createdAt!: string;
}

export class TenantAuditLogListResponseSwagger {
  @ApiProperty({ description: '日志列表', type: [AuditLogRecordSwagger] })
  list!: AuditLogRecordSwagger[];

  @ApiProperty({ description: '总数', example: 120 })
  total!: number;
}
