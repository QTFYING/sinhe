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
  PaymentChannelEnum as PrismaPaymentChannelEnum,
  Prisma,
  TenantCertificationStatusEnum as PrismaTenantCertificationStatusEnum,
  TenantStatusEnum as PrismaTenantStatusEnum,
  UserRoleEnum,
  UserStatusEnum as PrismaUserStatusEnum,
} from '@prisma/client';
import type {
  CreateTenantAuditBatchRequest,
  CreateTenantAuditDecisionRequest,
  CreateTenantCertificationReviewDecisionRequest,
  CreateTenantRequest,
  CreateTenantRenewalRequest,
  CreateTenantStatusChangeBatchRequest,
  CreateUserPasswordResetRequest,
  CreateUserPasswordResetResponse,
  PatchTenantStatusRequest,
  TenantBatchActionResponse,
  TenantCertificationRecordItem,
  TenantCertificationReviewDecisionResponse,
  TenantCertificationStatusResult,
  TenantCertificationSubmitRequest,
  TenantCertificationSubmitResponse,
  TenantListQuery,
  TenantMemberItem,
  TenantMemberListQuery,
  TenantRecordItem,
  UserListQuery,
  UserRecordItem,
  UserStatusUpdateRequest,
  UserUpsertRequest,
} from '@shou/types/contracts';
import type { PaginatedResponse } from '@shou/types/common';
import {
  FreezeActionEnum,
  ReviewActionEnum,
  SortOrderEnum,
  TenantCertificationStatusEnum,
  TenantRoleEnum,
  TenantSideEnum,
  TenantSortFieldEnum,
  TenantStatusEnum,
  UserStatusEnum,
} from '@shou/types/enums';
import * as bcrypt from 'bcrypt';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

const DEFAULT_USER_PASSWORD = '123456';
const DEFAULT_TENANT_CHANNEL = 'lakala';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async createTenant(createTenantDto: CreateTenantDto) {
    return this.prisma.tenant.create({
      data: {
        name: this.normalizeText(createTenantDto.name, 'name', 100),
        contactPhone: this.normalizeText(createTenantDto.contactPhone, 'contactPhone', 20),
        maxCreditDays: createTenantDto.maxCreditDays,
      },
    });
  }

  async getTenantInfo(currentUser: JwtPayload) {
    const tenantId = this.getTenantId(currentUser);

    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  }

  async getTenants(query: TenantListQuery): Promise<PaginatedResponse<TenantRecordItem>> {
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const monthStart = dayjs().startOf('month').toDate();
    const where: Prisma.TenantWhereInput = {
      deletedAt: null,
    };

    if (query.status) {
      where.status = this.toPrismaTenantStatus(query.status);
    }
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { id: keyword },
        { name: { contains: keyword, mode: 'insensitive' } },
        { adminName: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          users: {
            where: { deletedAt: null },
            select: { id: true, loginAt: true },
          },
          payments: {
            where: { paidAt: { gte: monthStart } },
            select: { amount: true },
          },
          paymentOrders: {
            select: { channel: true },
          },
        },
        orderBy: this.buildTenantOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      list: tenants.map((tenant) => this.toTenantRecordItem(tenant)),
      total,
      page,
      pageSize,
    };
  }

  async createAdminTenant(
    currentUser: JwtPayload,
    request: CreateTenantRequest,
    ip?: string,
  ): Promise<TenantRecordItem> {
    const dueInDays = this.normalizePositiveInt(request.dueInDays, 'dueInDays');
    const created = await this.prisma.tenant.create({
      data: {
        name: this.normalizeText(request.name, 'name', 100),
        contactPhone: '',
        packageName: this.normalizeText(request.packageName, 'packageName', 100),
        adminName: this.normalizeText(request.admin, 'admin', 50),
        region: this.normalizeText(request.region, 'region', 100),
        status: PrismaTenantStatusEnum.ONBOARDING,
        expireAt: dayjs().add(dueInDays, 'day').endOf('day').toDate(),
      },
      include: {
        users: { where: { deletedAt: null }, select: { id: true, loginAt: true } },
        payments: {
          where: { paidAt: { gte: dayjs().startOf('month').toDate() } },
          select: { amount: true },
        },
        paymentOrders: { select: { channel: true } },
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId: created.id,
      action: '创建租户',
      target: created.name,
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return this.toTenantRecordItem(created, [request.channel]);
  }

  async createTenantAuditDecision(
    currentUser: JwtPayload,
    tenantId: string,
    request: CreateTenantAuditDecisionRequest,
    ip?: string,
  ): Promise<TenantRecordItem> {
    const tenant = await this.getTenantOrThrow(tenantId);
    if (request.action === ReviewActionEnum.REJECT && !request.rejectReason?.trim()) {
      throw new BadRequestException('rejectReason 不能为空');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status:
          request.action === ReviewActionEnum.APPROVE
            ? PrismaTenantStatusEnum.ACTIVE
            : PrismaTenantStatusEnum.ONBOARDING,
        rejectReason:
          request.action === ReviewActionEnum.REJECT ? request.rejectReason?.trim() || null : null,
      },
      include: {
        users: { where: { deletedAt: null }, select: { id: true, loginAt: true } },
        payments: {
          where: { paidAt: { gte: dayjs().startOf('month').toDate() } },
          select: { amount: true },
        },
        paymentOrders: { select: { channel: true } },
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId: tenant.id,
      action: request.action === ReviewActionEnum.APPROVE ? '通过租户审核' : '驳回租户审核',
      target: tenant.name,
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return this.toTenantRecordItem(updated);
  }

  async createTenantAuditBatch(
    currentUser: JwtPayload,
    request: CreateTenantAuditBatchRequest,
    ip?: string,
  ): Promise<TenantBatchActionResponse> {
    const ids = this.normalizeIdArray(request.ids, 'ids');
    const failedIds: string[] = [];
    let successCount = 0;

    for (const id of ids) {
      try {
        await this.prisma.tenant.update({
          where: { id },
          data: {
            status: PrismaTenantStatusEnum.ACTIVE,
            rejectReason: null,
          },
        });
        successCount += 1;
      } catch {
        failedIds.push(id);
      }
    }

    await this.createAuditLog(currentUser, {
      tenantId: null,
      action: '批量通过租户审核',
      target: ids.join(','),
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return { successCount, failedIds };
  }

  async createTenantRenewal(
    currentUser: JwtPayload,
    tenantId: string,
    request: CreateTenantRenewalRequest,
    ip?: string,
  ): Promise<TenantRecordItem> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const baseDate =
      tenant.expireAt && dayjs(tenant.expireAt).isAfter(dayjs())
        ? dayjs(tenant.expireAt)
        : dayjs();

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        packageName: this.normalizeText(request.packageName, 'packageName', 100),
        expireAt: baseDate.add(request.days, 'day').endOf('day').toDate(),
      },
      include: {
        users: { where: { deletedAt: null }, select: { id: true, loginAt: true } },
        payments: {
          where: { paidAt: { gte: dayjs().startOf('month').toDate() } },
          select: { amount: true },
        },
        paymentOrders: { select: { channel: true } },
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId: tenant.id,
      action: '租户续费',
      target: tenant.name,
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return this.toTenantRecordItem(updated);
  }

  async patchTenantStatus(
    currentUser: JwtPayload,
    tenantId: string,
    request: PatchTenantStatusRequest,
    ip?: string,
  ): Promise<TenantRecordItem> {
    const tenant = await this.getTenantOrThrow(tenantId);
    if (request.action === FreezeActionEnum.FREEZE && !request.reason?.trim()) {
      throw new BadRequestException('冻结时 reason 必填');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        status:
          request.action === FreezeActionEnum.FREEZE
            ? PrismaTenantStatusEnum.PAUSED
            : PrismaTenantStatusEnum.ACTIVE,
        freezeReason:
          request.action === FreezeActionEnum.FREEZE ? request.reason?.trim() || null : null,
      },
      include: {
        users: { where: { deletedAt: null }, select: { id: true, loginAt: true } },
        payments: {
          where: { paidAt: { gte: dayjs().startOf('month').toDate() } },
          select: { amount: true },
        },
        paymentOrders: { select: { channel: true } },
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId: tenant.id,
      action: request.action === FreezeActionEnum.FREEZE ? '冻结租户' : '解冻租户',
      target: tenant.name,
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return this.toTenantRecordItem(updated);
  }

  async createTenantStatusChangeBatch(
    currentUser: JwtPayload,
    request: CreateTenantStatusChangeBatchRequest,
    ip?: string,
  ): Promise<TenantBatchActionResponse> {
    const ids = this.normalizeIdArray(request.ids, 'ids');
    const failedIds: string[] = [];
    let successCount = 0;

    for (const id of ids) {
      try {
        await this.prisma.tenant.update({
          where: { id },
          data: {
            status: PrismaTenantStatusEnum.PAUSED,
            freezeReason: this.normalizeText(request.reason, 'reason', 255),
          },
        });
        successCount += 1;
      } catch {
        failedIds.push(id);
      }
    }

    await this.createAuditLog(currentUser, {
      tenantId: null,
      action: '批量冻结租户',
      target: ids.join(','),
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return { successCount, failedIds };
  }

  async getTenantMembers(
    query: TenantMemberListQuery,
  ): Promise<PaginatedResponse<TenantMemberItem>> {
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (query.tenantType === TenantSideEnum.PLATFORM) {
      where.tenantId = null;
    }
    if (query.tenantType === TenantSideEnum.TENANT) {
      where.tenantId = { not: null };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { tenant: true },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      list: users.map((user) => ({
        id: user.id,
        name: user.realName,
        account: user.account,
        tenant: user.tenant?.name ?? '平台',
        tenantType: user.tenantId ? TenantSideEnum.TENANT : TenantSideEnum.PLATFORM,
        role: user.role,
        status: this.fromPrismaUserStatus(user.status),
        scope: user.scope ?? '',
      })),
      total,
      page,
      pageSize,
    };
  }

  async getCertificationQueue(): Promise<TenantCertificationRecordItem[]> {
    const records = await this.prisma.tenantCertification.findMany({
      where: {
        status: {
          in: [
            PrismaTenantCertificationStatusEnum.PENDING_INITIAL_REVIEW,
            PrismaTenantCertificationStatusEnum.PENDING_SECONDARY_REVIEW,
            PrismaTenantCertificationStatusEnum.PENDING_CONFIRMATION,
          ],
        },
      },
      include: {
        tenant: true,
      },
      orderBy: { submitAt: 'asc' },
    });

    return records.map((item) => ({
      id: item.id,
      tenant: item.tenant.name,
      type: item.type,
      submitAt: item.submitAt.toISOString(),
      status: this.fromPrismaCertificationStatus(item.status),
      comment: item.comment ?? undefined,
    }));
  }

  async createCertificationReviewDecision(
    currentUser: JwtPayload,
    certificationId: string,
    request: CreateTenantCertificationReviewDecisionRequest,
    ip?: string,
  ): Promise<TenantCertificationReviewDecisionResponse> {
    const certification = await this.prisma.tenantCertification.findUnique({
      where: { id: certificationId },
      include: { tenant: true },
    });

    if (!certification) {
      throw new NotFoundException('资质记录不存在');
    }

    const previousStatus = certification.status;
    const nextStatus = this.getNextCertificationStatus(previousStatus, request.action);
    const reviewedAt = new Date();
    const updated = await this.prisma.tenantCertification.update({
      where: { id: certification.id },
      data: {
        status: nextStatus,
        comment: request.comment?.trim() || null,
        rejectReason:
          request.action === ReviewActionEnum.REJECT ? request.comment?.trim() || null : null,
        reviewedAt,
      },
      include: { tenant: true },
    });

    await this.createAuditLog(currentUser, {
      tenantId: updated.tenantId,
      action: '处理资质审核',
      target: updated.tenant.name,
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return {
      id: updated.id,
      tenant: updated.tenant.name,
      type: updated.type,
      submitAt: updated.submitAt.toISOString(),
      previousStatus: this.fromPrismaCertificationStatus(previousStatus),
      status: this.fromPrismaCertificationStatus(updated.status),
      comment: updated.comment ?? undefined,
      reviewedAt: reviewedAt.toISOString(),
    };
  }

  async submitCertification(
    currentUser: JwtPayload,
    request: TenantCertificationSubmitRequest,
    ip?: string,
  ): Promise<TenantCertificationSubmitResponse> {
    const tenantId = this.getTenantId(currentUser);
    const created = await this.prisma.tenantCertification.create({
      data: {
        tenantId,
        type: '企业实名认证',
        licenseUrl: this.normalizeText(request.licenseUrl, 'licenseUrl', 500),
        legalPerson: this.normalizeText(request.legalPerson, 'legalPerson', 50),
        legalIdCard: this.normalizeText(request.legalIdCard, 'legalIdCard', 50),
        contactPhone: this.normalizeText(request.contactPhone, 'contactPhone', 20),
        remark: request.remark?.trim() || null,
        status: PrismaTenantCertificationStatusEnum.PENDING_INITIAL_REVIEW,
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId,
      action: '提交资质材料',
      target: created.id,
      targetType: PrismaAuditTargetTypeEnum.TENANT,
      ip,
    });

    return {
      certId: created.id,
      status: TenantCertificationStatusEnum.PENDING_INITIAL_REVIEW,
      submittedAt: created.submitAt.toISOString(),
    };
  }

  async getCertificationStatus(currentUser: JwtPayload): Promise<TenantCertificationStatusResult> {
    const tenantId = this.getTenantId(currentUser);
    const latest = await this.prisma.tenantCertification.findFirst({
      where: { tenantId },
      orderBy: [{ submitAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (!latest) {
      return {
        certId: null,
        status: null,
        submittedAt: null,
        reviewedAt: null,
        reviewComment: null,
        rejectReason: null,
      };
    }

    return {
      certId: latest.id,
      status: this.fromPrismaCertificationStatus(latest.status),
      submittedAt: latest.submitAt.toISOString(),
      reviewedAt: latest.reviewedAt?.toISOString() ?? null,
      reviewComment: latest.comment ?? null,
      rejectReason: latest.rejectReason ?? null,
    };
  }

  async getAdminUsers(query: UserListQuery): Promise<PaginatedResponse<UserRecordItem>> {
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { realName: { contains: keyword, mode: 'insensitive' } },
        { account: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    if (query.role?.trim()) {
      where.role = query.role.trim() as UserRoleEnum;
    }
    if (query.tenant?.trim()) {
      const keyword = query.tenant.trim();
      where.tenant = {
        OR: [{ id: keyword }, { name: { contains: keyword, mode: 'insensitive' } }],
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { tenant: true },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      list: users.map((item) => this.toUserRecordItem(item)),
      total,
      page,
      pageSize,
    };
  }

  async createAdminUser(
    currentUser: JwtPayload,
    request: UserUpsertRequest,
    ip?: string,
  ): Promise<UserRecordItem> {
    const account = this.normalizeText(request.account, 'account', 50);
    await this.ensureAccountAvailable(account);
    const tenantId = await this.resolveTenantIdForUser(request.tenantType, request.tenant);
    const role = this.resolveUserRoleForUpsert(request.tenantType, request.role);
    const status = this.toPrismaUserStatus(request.status ?? UserStatusEnum.ACTIVE);

    const created = await this.prisma.user.create({
      data: {
        tenantId,
        account,
        phone: this.normalizeText(request.phone, 'phone', 20),
        passwordHash: await bcrypt.hash(DEFAULT_USER_PASSWORD, 10),
        realName: this.normalizeText(request.name, 'name', 50),
        role,
        scope: this.normalizeText(request.scope, 'scope', 100),
        status,
        requiresPasswordReset: true,
      },
      include: { tenant: true },
    });

    await this.createAuditLog(currentUser, {
      tenantId: created.tenantId,
      action: '创建平台用户',
      target: created.realName || created.account,
      targetType: PrismaAuditTargetTypeEnum.ACCOUNT,
      ip,
    });

    return this.toUserRecordItem(created);
  }

  async updateAdminUser(
    currentUser: JwtPayload,
    userId: string,
    request: UserUpsertRequest,
    ip?: string,
  ): Promise<UserRecordItem> {
    const existing = await this.getAdminUserOrThrow(userId);
    const account = this.normalizeText(request.account, 'account', 50);
    if (account !== existing.account) {
      await this.ensureAccountAvailable(account, existing.id);
    }

    const tenantId = await this.resolveTenantIdForUser(request.tenantType, request.tenant);
    const role = this.resolveUserRoleForUpsert(request.tenantType, request.role);
    const updated = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        tenantId,
        account,
        phone: this.normalizeText(request.phone, 'phone', 20),
        realName: this.normalizeText(request.name, 'name', 50),
        role,
        scope: this.normalizeText(request.scope, 'scope', 100),
        status: request.status ? this.toPrismaUserStatus(request.status) : undefined,
      },
      include: { tenant: true },
    });

    await this.createAuditLog(currentUser, {
      tenantId: updated.tenantId,
      action: '更新平台用户',
      target: updated.realName || updated.account,
      targetType: PrismaAuditTargetTypeEnum.ACCOUNT,
      ip,
    });

    return this.toUserRecordItem(updated);
  }

  async deleteAdminUser(currentUser: JwtPayload, userId: string, ip?: string): Promise<null> {
    const existing = await this.getAdminUserOrThrow(userId);
    if (existing.id === currentUser.userId) {
      throw new ConflictException('当前登录用户不能删除自己');
    }

    await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        status: PrismaUserStatusEnum.DISABLED,
        account: `${existing.account}#deleted#${Date.now()}`,
        phone: existing.phone ? `${existing.phone}#deleted` : existing.phone,
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId: existing.tenantId,
      action: '删除平台用户',
      target: existing.realName || existing.account,
      targetType: PrismaAuditTargetTypeEnum.ACCOUNT,
      ip,
    });

    return null;
  }

  async patchAdminUserStatus(
    currentUser: JwtPayload,
    userId: string,
    request: UserStatusUpdateRequest,
    ip?: string,
  ): Promise<UserRecordItem> {
    const existing = await this.getAdminUserOrThrow(userId);
    if (existing.id === currentUser.userId && request.status !== UserStatusEnum.ACTIVE) {
      throw new ConflictException('当前登录用户不能修改自己的不可用状态');
    }

    const updated = await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        status: this.toPrismaUserStatus(request.status),
      },
      include: { tenant: true },
    });

    await this.createAuditLog(currentUser, {
      tenantId: updated.tenantId,
      action: '更新平台用户状态',
      target: updated.realName || updated.account,
      targetType: PrismaAuditTargetTypeEnum.ACCOUNT,
      ip,
    });

    return this.toUserRecordItem(updated);
  }

  async resetAdminUserPassword(
    currentUser: JwtPayload,
    userId: string,
    request: CreateUserPasswordResetRequest,
    ip?: string,
  ): Promise<CreateUserPasswordResetResponse> {
    const existing = await this.getAdminUserOrThrow(userId);
    await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await bcrypt.hash(request.password?.trim() || DEFAULT_USER_PASSWORD, 10),
        requiresPasswordReset: true,
      },
    });

    await this.createAuditLog(currentUser, {
      tenantId: existing.tenantId,
      action: '重置用户密码',
      target: existing.realName || existing.account,
      targetType: PrismaAuditTargetTypeEnum.ACCOUNT,
      ip,
    });

    return {
      requiresPasswordReset: true,
    };
  }

  private async getTenantOrThrow(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    return tenant;
  }

  private async getAdminUserOrThrow(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  private buildTenantOrderBy(
    query: TenantListQuery,
  ): Prisma.TenantOrderByWithRelationInput[] {
    const sortOrder = query.sortOrder === SortOrderEnum.ASC ? 'asc' : 'desc';
    switch (query.sortBy) {
      case TenantSortFieldEnum.NAME:
        return [{ name: sortOrder }];
      case TenantSortFieldEnum.PACKAGE_NAME:
        return [{ packageName: sortOrder }];
      case TenantSortFieldEnum.STATUS:
        return [{ status: sortOrder }];
      case TenantSortFieldEnum.DUE_IN_DAYS:
        return [{ expireAt: sortOrder }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private toTenantRecordItem(
    tenant: {
      id: string;
      name: string;
      packageName: string | null;
      adminName: string | null;
      region: string | null;
      status: PrismaTenantStatusEnum;
      rejectReason: string | null;
      freezeReason: string | null;
      expireAt: Date | null;
      updatedAt: Date;
      users: Array<{ id: string; loginAt: Date | null }>;
      payments: Array<{ amount: Prisma.Decimal }>;
      paymentOrders: Array<{ channel: PrismaPaymentChannelEnum | null }>;
    },
    channelOverride?: string[],
  ): TenantRecordItem {
    const monthlyFlow = tenant.payments.reduce(
      (sum, item) => sum.plus(item.amount.toString()),
      new Decimal(0),
    );
    const lastActiveAt = tenant.users
      .map((item) => item.loginAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const channels = channelOverride?.length
      ? channelOverride
      : Array.from(
          new Set(
            tenant.paymentOrders
              .map((item) => this.fromPrismaPaymentChannel(item.channel))
              .filter((item): item is string => Boolean(item)),
          ),
        );

    return {
      id: tenant.id,
      name: tenant.name,
      packageName: tenant.packageName ?? '',
      admin: tenant.adminName ?? '',
      region: tenant.region ?? '',
      merchants: 1,
      users: tenant.users.length,
      channels: channels.length > 0 ? channels : [DEFAULT_TENANT_CHANNEL],
      monthlyFlow: Number(monthlyFlow.toFixed(2)),
      dueInDays: this.resolveDueInDays(tenant.expireAt),
      lastActiveAt: (lastActiveAt ?? tenant.updatedAt).toISOString(),
      status: this.fromPrismaTenantStatus(tenant.status),
      rejectReason: tenant.rejectReason ?? null,
      freezeReason: tenant.freezeReason ?? null,
    };
  }

  private toUserRecordItem(user: {
    id: string;
    account: string;
    realName: string;
    phone: string | null;
    tenantId: string | null;
    tenant: { name: string } | null;
    role: UserRoleEnum;
    scope: string | null;
    status: PrismaUserStatusEnum;
    loginAt: Date | null;
    requiresPasswordReset: boolean;
  }): UserRecordItem {
    return {
      id: user.id,
      account: user.account,
      name: user.realName,
      tenant: user.tenant?.name ?? '平台',
      tenantType: user.tenantId ? TenantSideEnum.TENANT : TenantSideEnum.PLATFORM,
      role: user.role,
      scope: user.scope ?? '',
      phone: user.phone ?? '',
      status: this.fromPrismaUserStatus(user.status),
      loginAt: user.loginAt?.toISOString() ?? '',
      requiresPasswordReset: user.requiresPasswordReset,
    };
  }

  private async resolveTenantIdForUser(
    tenantType: string,
    tenant: string,
  ): Promise<string | null> {
    if (tenantType === TenantSideEnum.PLATFORM) {
      return null;
    }
    if (tenantType !== TenantSideEnum.TENANT) {
      throw new BadRequestException('tenantType 不是合法值');
    }

    const keyword = tenant.trim();
    if (!keyword) {
      throw new BadRequestException('tenant 不能为空');
    }

    const matched = await this.prisma.tenant.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: keyword }, { name: keyword }],
      },
      select: { id: true },
    });
    if (!matched) {
      throw new NotFoundException('所属租户不存在');
    }

    return matched.id;
  }

  private resolveUserRoleForUpsert(tenantType: string, role: string): UserRoleEnum {
    if (tenantType === TenantSideEnum.PLATFORM) {
      if (role !== UserRoleEnum.OS_SUPER_ADMIN) {
        throw new BadRequestException('平台侧当前仅支持 OS_SUPER_ADMIN');
      }
      return UserRoleEnum.OS_SUPER_ADMIN;
    }

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

  private getNextCertificationStatus(
    currentStatus: PrismaTenantCertificationStatusEnum,
    action: string,
  ): PrismaTenantCertificationStatusEnum {
    if (action === ReviewActionEnum.REJECT) {
      return PrismaTenantCertificationStatusEnum.REJECTED;
    }
    if (action !== ReviewActionEnum.APPROVE) {
      throw new BadRequestException('action 不是合法审核动作');
    }

    switch (currentStatus) {
      case PrismaTenantCertificationStatusEnum.PENDING_INITIAL_REVIEW:
        return PrismaTenantCertificationStatusEnum.PENDING_SECONDARY_REVIEW;
      case PrismaTenantCertificationStatusEnum.PENDING_SECONDARY_REVIEW:
        return PrismaTenantCertificationStatusEnum.PENDING_CONFIRMATION;
      case PrismaTenantCertificationStatusEnum.PENDING_CONFIRMATION:
        return PrismaTenantCertificationStatusEnum.APPROVED;
      default:
        throw new ConflictException('当前资质状态不允许继续审核');
    }
  }

  private fromPrismaCertificationStatus(
    status: PrismaTenantCertificationStatusEnum,
  ): (typeof TenantCertificationStatusEnum)[keyof typeof TenantCertificationStatusEnum] {
    switch (status) {
      case PrismaTenantCertificationStatusEnum.PENDING_SECONDARY_REVIEW:
        return TenantCertificationStatusEnum.PENDING_SECONDARY_REVIEW;
      case PrismaTenantCertificationStatusEnum.PENDING_CONFIRMATION:
        return TenantCertificationStatusEnum.PENDING_CONFIRMATION;
      case PrismaTenantCertificationStatusEnum.APPROVED:
        return TenantCertificationStatusEnum.APPROVED;
      case PrismaTenantCertificationStatusEnum.REJECTED:
        return TenantCertificationStatusEnum.REJECTED;
      case PrismaTenantCertificationStatusEnum.PENDING_INITIAL_REVIEW:
      default:
        return TenantCertificationStatusEnum.PENDING_INITIAL_REVIEW;
    }
  }

  private fromPrismaTenantStatus(
    status: PrismaTenantStatusEnum,
  ): (typeof TenantStatusEnum)[keyof typeof TenantStatusEnum] {
    switch (status) {
      case PrismaTenantStatusEnum.ONBOARDING:
        return TenantStatusEnum.ONBOARDING;
      case PrismaTenantStatusEnum.ATTENTION:
        return TenantStatusEnum.ATTENTION;
      case PrismaTenantStatusEnum.PAUSED:
        return TenantStatusEnum.PAUSED;
      case PrismaTenantStatusEnum.ACTIVE:
      default:
        return TenantStatusEnum.ACTIVE;
    }
  }

  private toPrismaTenantStatus(
    status: (typeof TenantStatusEnum)[keyof typeof TenantStatusEnum],
  ): PrismaTenantStatusEnum {
    switch (status) {
      case TenantStatusEnum.ONBOARDING:
        return PrismaTenantStatusEnum.ONBOARDING;
      case TenantStatusEnum.ATTENTION:
        return PrismaTenantStatusEnum.ATTENTION;
      case TenantStatusEnum.PAUSED:
        return PrismaTenantStatusEnum.PAUSED;
      case TenantStatusEnum.ACTIVE:
      default:
        return PrismaTenantStatusEnum.ACTIVE;
    }
  }

  private fromPrismaUserStatus(
    status: PrismaUserStatusEnum,
  ): (typeof UserStatusEnum)[keyof typeof UserStatusEnum] {
    switch (status) {
      case PrismaUserStatusEnum.INVITED:
        return UserStatusEnum.INVITED;
      case PrismaUserStatusEnum.LOCKED:
        return UserStatusEnum.LOCKED;
      case PrismaUserStatusEnum.DISABLED:
        return UserStatusEnum.DISABLED;
      case PrismaUserStatusEnum.ACTIVE:
      default:
        return UserStatusEnum.ACTIVE;
    }
  }

  private toPrismaUserStatus(
    status: (typeof UserStatusEnum)[keyof typeof UserStatusEnum],
  ): PrismaUserStatusEnum {
    switch (status) {
      case UserStatusEnum.INVITED:
        return PrismaUserStatusEnum.INVITED;
      case UserStatusEnum.LOCKED:
        return PrismaUserStatusEnum.LOCKED;
      case UserStatusEnum.DISABLED:
        return PrismaUserStatusEnum.DISABLED;
      case UserStatusEnum.ACTIVE:
      default:
        return PrismaUserStatusEnum.ACTIVE;
    }
  }

  private fromPrismaPaymentChannel(channel: PrismaPaymentChannelEnum | null): string | null {
    if (channel === PrismaPaymentChannelEnum.LAKALA) {
      return 'lakala';
    }
    return null;
  }

  private resolveDueInDays(expireAt: Date | null): number {
    if (!expireAt) return 0;
    return Math.max(dayjs(expireAt).endOf('day').diff(dayjs().startOf('day'), 'day'), 0);
  }

  private normalizePage(value?: number): number {
    return value && value > 0 ? value : 1;
  }

  private normalizePageSize(value?: number): number {
    if (!value || value <= 0) return 20;
    return Math.min(value, 200);
  }

  private normalizePositiveInt(value: number, label: string): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${label} 必须是正整数`);
    }

    return value;
  }

  private normalizeText(value: string, label: string, max: number): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`${label} 不能为空`);
    }

    return normalized.length > max ? normalized.slice(0, max) : normalized;
  }

  private normalizeIdArray(values: string[], label: string): string[] {
    const normalized = Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
    if (normalized.length === 0) {
      throw new BadRequestException(`${label} 不能为空`);
    }

    return normalized;
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
        actor: (await this.getActorName(currentUser.userId)) ?? currentUser.role,
        action: input.action,
        target: input.target,
        targetType: input.targetType,
        tenantId: input.tenantId,
        result: PrismaAuditResultEnum.SUCCESS,
        ip: input.ip?.trim() || null,
      },
    });
  }

  private async getActorName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        realName: true,
        account: true,
      },
    });

    return user?.realName || user?.account || null;
  }

  private getTenantId(currentUser: JwtPayload): string {
    if (!currentUser.tenantId) {
      throw new ForbiddenException('当前登录态不属于租户侧');
    }

    return currentUser.tenantId;
  }
}
