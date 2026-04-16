import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditResultEnum as PrismaAuditResultEnum,
  AuditTargetTypeEnum as PrismaAuditTargetTypeEnum,
  Prisma,
  TenantGeneralSettings as TenantGeneralSettingsModel,
  UserRoleEnum,
  UserStatusEnum,
} from '@prisma/client';
import type {
  GetPrintingConfigDetailResponse,
  GetPrintingConfigListResponse,
  PermissionNode,
  PrintingConfigListItem,
  TenantAuditLogListResponse,
  TenantAuditLogQuery,
  TenantRoleAccount,
  TenantSettingsUser,
  TenantGeneralSettings,
  TenantUserStatusUpdateRequest,
  CreateTenantUserRequest,
  UpdateTenantGeneralSettingsRequest,
  UpdatePrintingConfigRequest,
  UpdatePrintingConfigResponse,
  UpdateTenantUserRequest,
} from '@shou/types/contracts';
import { TenantRoleEnum, UserSimpleStatusEnum } from '@shou/types/enums';
import * as bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';

const GENERAL_SETTINGS_CONFIG_GROUP = 'tenant_general_defaults';
const DEFAULT_TENANT_USER_PASSWORD = '123456';

const PERMISSION_TREE: PermissionNode[] = [
  {
    id: 'dashboard',
    label: '首页',
  },
  {
    id: 'orders',
    label: '订单管理',
    children: [
      { id: 'orders.view', label: '查看订单列表' },
      { id: 'orders.import', label: '导入订单' },
      { id: 'orders.print', label: '打印订单' },
    ],
  },
  {
    id: 'printing',
    label: '打印设置',
    children: [
      { id: 'printing.view', label: '查看打印配置' },
      { id: 'printing.manage', label: '维护打印模板' },
    ],
  },
  {
    id: 'finance',
    label: '财务报表',
    children: [
      { id: 'finance.summary', label: '查看收款报表' },
      { id: 'finance.reconciliation', label: '查看对账明细' },
      { id: 'finance.credit', label: '查看账期管理' },
      { id: 'finance.export', label: '导出报表' },
    ],
  },
  {
    id: 'settings',
    label: '系统设置',
    children: [
      { id: 'settings.general', label: '基础设置' },
      { id: 'settings.printing', label: '打印配置' },
      { id: 'settings.roles', label: '角色管理' },
      { id: 'settings.users', label: '用户管理' },
    ],
  },
];

const TENANT_ROLE_DEFINITIONS: Array<{
  role: (typeof TenantRoleEnum)[keyof typeof TenantRoleEnum];
  name: string;
  description: string;
  permissions: string[];
}> = [
  {
    role: TenantRoleEnum.OWNER,
    name: '老板',
    description: '租户管理员，拥有全部管理权限',
    permissions: [
      'dashboard',
      'orders',
      'orders.view',
      'orders.import',
      'orders.print',
      'printing',
      'printing.view',
      'printing.manage',
      'finance',
      'finance.summary',
      'finance.reconciliation',
      'finance.credit',
      'finance.export',
      'settings',
      'settings.general',
      'settings.printing',
      'settings.roles',
      'settings.users',
    ],
  },
  {
    role: TenantRoleEnum.OPERATOR,
    name: '打单员',
    description: '负责导单、查单和打印',
    permissions: ['dashboard', 'orders', 'orders.view', 'orders.import', 'orders.print', 'printing.view'],
  },
  {
    role: TenantRoleEnum.FINANCE,
    name: '财务',
    description: '负责收款、核销、对账和账期管理',
    permissions: [
      'dashboard',
      'orders.view',
      'finance',
      'finance.summary',
      'finance.reconciliation',
      'finance.credit',
      'finance.export',
    ],
  },
  {
    role: TenantRoleEnum.VIEWER,
    name: '访客',
    description: '只读查看业务数据',
    permissions: ['dashboard', 'orders.view', 'finance.summary'],
  },
];

const GENERAL_SETTINGS_DEFAULTS: TenantGeneralSettings = {
  companyName: '',
  contactPerson: '',
  contactPhone: '',
  address: '',
  licenseNo: '',
  qrCodeExpiry: 30,
  notifySeller: true,
  notifyOwner: true,
  notifyFinance: true,
  creditRemindDays: 3,
  dailyReportPush: true,
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGeneralSettings(currentUser: JwtPayload): Promise<TenantGeneralSettings> {
    const tenantId = this.getTenantId(currentUser);

    const [defaults, override] = await Promise.all([
      this.getPlatformGeneralSettingsDefaults(),
      this.prisma.tenantGeneralSettings.findUnique({
        where: { tenantId },
      }),
    ]);

    return this.mergeGeneralSettings(defaults, override);
  }

  async updateGeneralSettings(
    currentUser: JwtPayload,
    request: UpdateTenantGeneralSettingsRequest,
    ip?: string,
  ): Promise<TenantGeneralSettings> {
    const tenantId = this.getTenantId(currentUser);
    const data = this.toTenantOverrideUpdate(request);

    if (Object.keys(data).length > 0) {
      await this.prisma.tenantGeneralSettings.upsert({
        where: { tenantId },
        create: {
          tenantId,
          ...data,
        },
        update: data,
      });
    }

    const result = await this.getGeneralSettings(currentUser);
    await this.createAuditLog(currentUser, {
      tenantId,
      action: '更新通用配置',
      target: 'tenant_general_settings',
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return result;
  }

  async getRoles(currentUser: JwtPayload): Promise<TenantRoleAccount[]> {
    const tenantId = this.getTenantId(currentUser);
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        role: {
          in: this.getTenantPrismaRoles(),
        },
      },
      select: {
        role: true,
      },
    });

    return TENANT_ROLE_DEFINITIONS.map((item) => ({
      id: item.role,
      name: item.name,
      description: item.description,
      permissions: item.permissions,
      isSystem: true,
      userCount: users.filter((user) => user.role === item.role).length,
    }));
  }

  getPermissions(): PermissionNode[] {
    return PERMISSION_TREE;
  }

  async getUsers(currentUser: JwtPayload): Promise<TenantSettingsUser[]> {
    const tenantId = this.getTenantId(currentUser);
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        role: {
          in: this.getTenantPrismaRoles(),
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return users.map((user) => this.toTenantSettingsUser(user));
  }

  async createUser(
    currentUser: JwtPayload,
    request: CreateTenantUserRequest,
    ip?: string,
  ): Promise<TenantSettingsUser> {
    const tenantId = this.getTenantId(currentUser);
    const account = this.normalizePhoneAsAccount(request.phone);
    await this.ensureAccountAvailable(account);

    const created = await this.prisma.user.create({
      data: {
        tenantId,
        account,
        phone: account,
        passwordHash: await bcrypt.hash(
          request.password?.trim() || DEFAULT_TENANT_USER_PASSWORD,
          10,
        ),
        realName: this.normalizeText(request.name, 'name', 50),
        role: this.toTenantPrismaRole(request.role),
        scope: 'tenant',
        status: UserStatusEnum.ACTIVE,
        requiresPasswordReset: !request.password?.trim(),
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId,
      action: '创建租户用户',
      target: created.realName || created.account,
      targetType: PrismaAuditTargetTypeEnum.ACCOUNT,
      ip,
    });

    return this.toTenantSettingsUser(created);
  }

  async updateUser(
    currentUser: JwtPayload,
    userId: string,
    request: UpdateTenantUserRequest,
    ip?: string,
  ): Promise<TenantSettingsUser> {
    const tenantId = this.getTenantId(currentUser);
    const existing = await this.getScopedTenantUser(tenantId, userId);

    const nextAccount =
      request.account !== undefined ? this.normalizeText(request.account, 'account', 50) : undefined;
    const nextPhone =
      request.phone !== undefined ? this.normalizePhoneAsAccount(request.phone) : undefined;
    const accountCandidate = nextPhone ?? nextAccount;
    if (accountCandidate && accountCandidate !== existing.account) {
      await this.ensureAccountAvailable(accountCandidate, existing.id);
    }

    const updated = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        realName:
          request.name !== undefined ? this.normalizeText(request.name, 'name', 50) : undefined,
        account: accountCandidate,
        phone: nextPhone ?? request.phone,
        role: request.role ? this.toTenantPrismaRole(request.role) : undefined,
        status: request.status ? this.toPrismaTenantUserStatus(request.status) : undefined,
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId,
      action: '更新租户用户',
      target: updated.realName || updated.account,
      targetType: PrismaAuditTargetTypeEnum.ACCOUNT,
      ip,
    });

    return this.toTenantSettingsUser(updated);
  }

  async deleteUser(currentUser: JwtPayload, userId: string, ip?: string): Promise<null> {
    const tenantId = this.getTenantId(currentUser);
    const existing = await this.getScopedTenantUser(tenantId, userId);
    if (existing.id === currentUser.userId) {
      throw new ConflictException('TENANT_OWNER 不可删除自己');
    }

    await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        status: UserStatusEnum.DISABLED,
        account: `${existing.account}#deleted#${Date.now()}`,
        phone: existing.phone ? `${existing.phone}#deleted` : existing.phone,
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId,
      action: '删除租户用户',
      target: existing.realName || existing.account,
      targetType: PrismaAuditTargetTypeEnum.ACCOUNT,
      ip,
    });

    return null;
  }

  async patchUserStatus(
    currentUser: JwtPayload,
    userId: string,
    request: TenantUserStatusUpdateRequest,
    ip?: string,
  ): Promise<TenantSettingsUser> {
    const tenantId = this.getTenantId(currentUser);
    const existing = await this.getScopedTenantUser(tenantId, userId);
    if (existing.id === currentUser.userId && request.status === UserSimpleStatusEnum.DISABLED) {
      throw new ConflictException('当前登录用户不能禁用自己');
    }

    const updated = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        status: this.toPrismaTenantUserStatus(request.status),
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId,
      action: '更新租户用户状态',
      target: updated.realName || updated.account,
      targetType: PrismaAuditTargetTypeEnum.ACCOUNT,
      ip,
    });

    return this.toTenantSettingsUser(updated);
  }

  async getPrintingConfigList(currentUser: JwtPayload): Promise<GetPrintingConfigListResponse> {
    const tenantId = this.getTenantId(currentUser);

    const templates = await this.prisma.importTemplate.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      include: {
        printerTemplate: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      items: templates.map((template) => {
        const item: PrintingConfigListItem = {
          importTemplateId: String(template.id),
          importTemplateName: template.name,
          hasCustomConfig: Boolean(template.printerTemplate),
        };

        if (template.printerTemplate) {
          item.configVersion = template.printerTemplate.configVersion;
          item.updatedAt = template.printerTemplate.updatedAt.toISOString();
          item.updatedBy = template.printerTemplate.updatedBy ?? undefined;
          item.remark = template.printerTemplate.remark ?? undefined;
        }

        return item;
      }),
    };
  }

  async getPrintingConfigDetail(
    currentUser: JwtPayload,
    importTemplateId: string,
  ): Promise<GetPrintingConfigDetailResponse> {
    const template = await this.getScopedImportTemplate(currentUser, importTemplateId);

    if (!template.printerTemplate) {
      return {
        importTemplateId: String(template.id),
        importTemplateName: template.name,
        hasCustomConfig: false,
      };
    }

    return {
      importTemplateId: String(template.id),
      importTemplateName: template.name,
      hasCustomConfig: true,
      configVersion: template.printerTemplate.configVersion,
      config: template.printerTemplate.config as Record<string, unknown>,
      updatedAt: template.printerTemplate.updatedAt.toISOString(),
      updatedBy: template.printerTemplate.updatedBy ?? undefined,
      remark: template.printerTemplate.remark ?? undefined,
    };
  }

  async updatePrintingConfig(
    currentUser: JwtPayload,
    importTemplateId: string,
    request: UpdatePrintingConfigRequest,
    ip?: string,
  ): Promise<UpdatePrintingConfigResponse> {
    const tenantId = this.getTenantId(currentUser);
    await this.getScopedImportTemplate(currentUser, importTemplateId);

    const operator = await this.getOperatorDisplayName(currentUser.userId);
    const bigTemplateId = BigInt(importTemplateId);
    const template = await this.prisma.printerTemplate.upsert({
      where: {
        tenantId_importTemplateId: {
          tenantId,
          importTemplateId: bigTemplateId,
        },
      },
      create: {
        tenantId,
        importTemplateId: bigTemplateId,
        config: request.config as Prisma.InputJsonValue,
        configVersion: 1,
        remark: request.remark,
        updatedBy: operator,
      },
      update: {
        config: request.config as Prisma.InputJsonValue,
        configVersion: {
          increment: 1,
        },
        remark: request.remark,
        updatedBy: operator,
      },
    });

    const result = {
      importTemplateId: String(template.importTemplateId),
      hasCustomConfig: true,
      configVersion: template.configVersion,
      updatedAt: template.updatedAt.toISOString(),
      updatedBy: template.updatedBy ?? undefined,
      remark: template.remark ?? undefined,
    };

    await this.createAuditLog(currentUser, {
      tenantId,
      action: '更新打印配置',
      target: importTemplateId,
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return result;
  }

  async getAuditLogs(
    currentUser: JwtPayload,
    query: TenantAuditLogQuery | ListAuditLogsQueryDto,
  ): Promise<TenantAuditLogListResponse> {
    const tenantId = this.getTenantId(currentUser);
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
    };

    if (query.operator?.trim()) {
      where.actor = {
        contains: query.operator.trim(),
        mode: 'insensitive',
      };
    }
    if (query.startDate || query.endDate) {
      where.time = {};
      if (query.startDate) {
        where.time.gte = dayjs(query.startDate).startOf('day').toDate();
      }
      if (query.endDate) {
        where.time.lte = dayjs(query.endDate).endOf('day').toDate();
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { time: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      list: logs.map((item) => ({
        id: String(item.id),
        action: item.action,
        operator: item.actor,
        ip: item.ip ?? '',
        createdAt: item.time.toISOString(),
      })),
      total,
    };
  }

  private getTenantId(currentUser: JwtPayload): string {
    if (!currentUser.tenantId) {
      throw new ForbiddenException('当前登录态不属于租户侧，无法访问通用配置');
    }

    return currentUser.tenantId;
  }

  private async getScopedImportTemplate(currentUser: JwtPayload, importTemplateId: string) {
    const tenantId = this.getTenantId(currentUser);

    const template = await this.prisma.importTemplate.findFirst({
      where: {
        id: BigInt(importTemplateId),
        tenantId,
        deletedAt: null,
      },
      include: {
        printerTemplate: true,
      },
    });

    if (!template) {
      throw new NotFoundException('未找到对应的导入映射模板');
    }

    return template;
  }

  private async getOperatorDisplayName(userId: string): Promise<string | undefined> {
    const operator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        realName: true,
        account: true,
      },
    });

    return operator?.realName || operator?.account || undefined;
  }

  private async createAuditLog(
    currentUser: JwtPayload,
    input: {
      tenantId: string | null;
      action: string;
      target: string;
      targetType: PrismaAuditTargetTypeEnum;
      ip?: string;
    },
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actor: (await this.getOperatorDisplayName(currentUser.userId)) ?? currentUser.role,
        action: input.action,
        target: input.target,
        targetType: input.targetType,
        tenantId: input.tenantId,
        result: PrismaAuditResultEnum.SUCCESS,
        ip: input.ip?.trim() || null,
      },
    });
  }

  private async getScopedTenantUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        deletedAt: null,
        role: {
          in: this.getTenantPrismaRoles(),
        },
      },
    });

    if (!user) {
      throw new NotFoundException('租户用户不存在');
    }

    return user;
  }

  private async ensureAccountAvailable(account: string, excludeUserId?: string): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: {
        account,
        deletedAt: null,
        id: excludeUserId ? { not: excludeUserId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('登录账号已存在');
    }
  }

  private toTenantSettingsUser(user: {
    id: string;
    realName: string;
    account: string;
    role: UserRoleEnum;
    phone: string | null;
    status: UserStatusEnum;
    loginAt: Date | null;
  }): TenantSettingsUser {
    return {
      id: user.id,
      name: user.realName,
      account: user.account,
      role: user.role as (typeof TenantRoleEnum)[keyof typeof TenantRoleEnum],
      phone: user.phone ?? '',
      status: this.fromPrismaTenantUserStatus(user.status),
      lastLogin: user.loginAt?.toISOString() ?? '',
    };
  }

  private toTenantPrismaRole(
    role: (typeof TenantRoleEnum)[keyof typeof TenantRoleEnum],
  ): UserRoleEnum {
    switch (role) {
      case TenantRoleEnum.OWNER:
        return UserRoleEnum.TENANT_OWNER;
      case TenantRoleEnum.OPERATOR:
        return UserRoleEnum.TENANT_OPERATOR;
      case TenantRoleEnum.FINANCE:
        return UserRoleEnum.TENANT_FINANCE;
      case TenantRoleEnum.VIEWER:
        return UserRoleEnum.TENANT_VIEWER;
      default:
        throw new BadRequestException('role 不是合法租户角色');
    }
  }

  private fromPrismaTenantUserStatus(
    status: UserStatusEnum,
  ): (typeof UserSimpleStatusEnum)[keyof typeof UserSimpleStatusEnum] {
    return status === UserStatusEnum.ACTIVE
      ? UserSimpleStatusEnum.ACTIVE
      : UserSimpleStatusEnum.DISABLED;
  }

  private toPrismaTenantUserStatus(
    status: (typeof UserSimpleStatusEnum)[keyof typeof UserSimpleStatusEnum],
  ): UserStatusEnum {
    return status === UserSimpleStatusEnum.ACTIVE
      ? UserStatusEnum.ACTIVE
      : UserStatusEnum.DISABLED;
  }

  private getTenantPrismaRoles(): UserRoleEnum[] {
    return [
      UserRoleEnum.TENANT_OWNER,
      UserRoleEnum.TENANT_OPERATOR,
      UserRoleEnum.TENANT_FINANCE,
      UserRoleEnum.TENANT_VIEWER,
    ];
  }

  private normalizeText(value: string, label: string, max: number): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`${label} 不能为空`);
    }

    return normalized.length > max ? normalized.slice(0, max) : normalized;
  }

  private normalizePhoneAsAccount(value: string): string {
    return this.normalizeText(value, 'phone', 50);
  }

  private normalizePage(value?: number): number {
    return value && value > 0 ? value : 1;
  }

  private normalizePageSize(value?: number): number {
    if (!value || value <= 0) return 20;
    return Math.min(value, 200);
  }

  private async getPlatformGeneralSettingsDefaults(): Promise<TenantGeneralSettings> {
    const configs = await this.prisma.systemConfig.findMany({
      where: { group: GENERAL_SETTINGS_CONFIG_GROUP },
    });

    const configMap = new Map(configs.map((item) => [item.key, item.value]));

    return {
      companyName: configMap.get('companyName') ?? GENERAL_SETTINGS_DEFAULTS.companyName,
      contactPerson: configMap.get('contactPerson') ?? GENERAL_SETTINGS_DEFAULTS.contactPerson,
      contactPhone: configMap.get('contactPhone') ?? GENERAL_SETTINGS_DEFAULTS.contactPhone,
      address: configMap.get('address') ?? GENERAL_SETTINGS_DEFAULTS.address,
      licenseNo: configMap.get('licenseNo') ?? GENERAL_SETTINGS_DEFAULTS.licenseNo,
      qrCodeExpiry: this.parseNumberValue(
        configMap.get('qrCodeExpiry'),
        GENERAL_SETTINGS_DEFAULTS.qrCodeExpiry,
      ),
      notifySeller: this.parseBooleanValue(
        configMap.get('notifySeller'),
        GENERAL_SETTINGS_DEFAULTS.notifySeller,
      ),
      notifyOwner: this.parseBooleanValue(
        configMap.get('notifyOwner'),
        GENERAL_SETTINGS_DEFAULTS.notifyOwner,
      ),
      notifyFinance: this.parseBooleanValue(
        configMap.get('notifyFinance'),
        GENERAL_SETTINGS_DEFAULTS.notifyFinance,
      ),
      creditRemindDays: this.parseNumberValue(
        configMap.get('creditRemindDays'),
        GENERAL_SETTINGS_DEFAULTS.creditRemindDays,
      ),
      dailyReportPush: this.parseBooleanValue(
        configMap.get('dailyReportPush'),
        GENERAL_SETTINGS_DEFAULTS.dailyReportPush,
      ),
    };
  }

  private mergeGeneralSettings(
    defaults: TenantGeneralSettings,
    override: TenantGeneralSettingsModel | null,
  ): TenantGeneralSettings {
    if (!override) {
      return defaults;
    }

    return {
      companyName: override.companyName ?? defaults.companyName,
      contactPerson: override.contactPerson ?? defaults.contactPerson,
      contactPhone: override.contactPhone ?? defaults.contactPhone,
      address: override.address ?? defaults.address,
      licenseNo: override.licenseNo ?? defaults.licenseNo,
      qrCodeExpiry: override.qrCodeExpiry ?? defaults.qrCodeExpiry,
      notifySeller: override.notifySeller ?? defaults.notifySeller,
      notifyOwner: override.notifyOwner ?? defaults.notifyOwner,
      notifyFinance: override.notifyFinance ?? defaults.notifyFinance,
      creditRemindDays: override.creditRemindDays ?? defaults.creditRemindDays,
      dailyReportPush: override.dailyReportPush ?? defaults.dailyReportPush,
    };
  }

  private toTenantOverrideUpdate(request: UpdateTenantGeneralSettingsRequest) {
    const data: Partial<TenantGeneralSettingsModel> = {};

    if (request.companyName !== undefined) data.companyName = request.companyName;
    if (request.contactPerson !== undefined) data.contactPerson = request.contactPerson;
    if (request.contactPhone !== undefined) data.contactPhone = request.contactPhone;
    if (request.address !== undefined) data.address = request.address;
    if (request.licenseNo !== undefined) data.licenseNo = request.licenseNo;
    if (request.qrCodeExpiry !== undefined) data.qrCodeExpiry = request.qrCodeExpiry;
    if (request.notifySeller !== undefined) data.notifySeller = request.notifySeller;
    if (request.notifyOwner !== undefined) data.notifyOwner = request.notifyOwner;
    if (request.notifyFinance !== undefined) data.notifyFinance = request.notifyFinance;
    if (request.creditRemindDays !== undefined) data.creditRemindDays = request.creditRemindDays;
    if (request.dailyReportPush !== undefined) data.dailyReportPush = request.dailyReportPush;

    return data;
  }

  private parseNumberValue(raw: string | undefined, fallback: number): number {
    if (!raw) {
      return fallback;
    }

    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  private parseBooleanValue(raw: string | undefined, fallback: boolean): boolean {
    if (!raw) {
      return fallback;
    }

    if (raw === 'true') {
      return true;
    }

    if (raw === 'false') {
      return false;
    }

    return fallback;
  }
}
