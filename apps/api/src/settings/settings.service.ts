import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  TenantGeneralSettings as TenantGeneralSettingsModel,
} from '@prisma/client';
import type {
  GetPrintingConfigDetailResponse,
  GetPrintingConfigListResponse,
  PrintingConfigListItem,
  TenantGeneralSettings,
  UpdateTenantGeneralSettingsRequest,
  UpdatePrintingConfigRequest,
  UpdatePrintingConfigResponse,
} from '@shou/types/contracts';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

const GENERAL_SETTINGS_CONFIG_GROUP = 'tenant_general_defaults';

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

    return this.getGeneralSettings(currentUser);
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
          importTemplateId: template.id,
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
        importTemplateId: template.id,
        importTemplateName: template.name,
        hasCustomConfig: false,
      };
    }

    return {
      importTemplateId: template.id,
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
  ): Promise<UpdatePrintingConfigResponse> {
    const tenantId = this.getTenantId(currentUser);
    await this.getScopedImportTemplate(currentUser, importTemplateId);

    const operator = await this.getOperatorDisplayName(currentUser.userId);
    const template = await this.prisma.printerTemplate.upsert({
      where: {
        tenantId_importTemplateId: {
          tenantId,
          importTemplateId,
        },
      },
      create: {
        tenantId,
        importTemplateId,
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

    return {
      importTemplateId: template.importTemplateId,
      configVersion: template.configVersion,
      config: template.config as Record<string, unknown>,
      updatedAt: template.updatedAt.toISOString(),
      updatedBy: template.updatedBy ?? undefined,
      remark: template.remark ?? undefined,
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
        id: importTemplateId,
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
