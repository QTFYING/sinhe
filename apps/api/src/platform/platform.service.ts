import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditTargetTypeEnum,
  PaymentRecordStatusEnum,
  Prisma,
  TenantCertificationStatusEnum as PrismaTenantCertificationStatusEnum,
  TenantStatusEnum as PrismaTenantStatusEnum,
  UserStatusEnum as PrismaUserStatusEnum,
} from '@prisma/client';
import type {
  ConsoleInfoResponse,
  DashboardMetricItem,
  LoginRiskEventItem,
  PlatformOverviewResponse,
  PlatformTodoItem,
  TenantHealthItem,
} from '@shou/types/contracts';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

const PLATFORM_PRODUCT_NAME = '收单吧';
const PLATFORM_SUITE_NAME = '平台运营后台';
const PLATFORM_SCOPE_LABEL = '平台视角';
const PLATFORM_TENANT_LABEL = '—';
const ACTIVE_USER_WINDOW_DAYS = 30;
const TODO_RENEWAL_WINDOW_DAYS = 7;
const OVERVIEW_RENEWAL_WINDOW_DAYS = 30;

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async getConsoleInfo(currentUser: JwtPayload): Promise<ConsoleInfoResponse> {
    this.ensurePlatformScope(currentUser);

    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        account: true,
        realName: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('当前用户不存在');
    }

    return {
      productName: PLATFORM_PRODUCT_NAME,
      suiteName: PLATFORM_SUITE_NAME,
      scopeLabel: PLATFORM_SCOPE_LABEL,
      operator: user.realName || user.account,
      role: user.role,
      currentTenant: PLATFORM_TENANT_LABEL,
    };
  }

  async getMetrics(currentUser: JwtPayload): Promise<DashboardMetricItem[]> {
    this.ensurePlatformScope(currentUser);

    const todayStart = dayjs().startOf('day').toDate();
    const monthStart = dayjs().startOf('month').toDate();
    const renewalDeadline = dayjs().add(TODO_RENEWAL_WINDOW_DAYS, 'day').endOf('day').toDate();

    const [
      totalTenants,
      activeTenants,
      onboardingTenants,
      monthFlowAggregate,
      totalFlowAggregate,
      newTenantsThisMonth,
      pendingCertificationCount,
      renewalRiskCount,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenant.count({
        where: { deletedAt: null, status: PrismaTenantStatusEnum.ACTIVE },
      }),
      this.prisma.tenant.count({
        where: { deletedAt: null, status: PrismaTenantStatusEnum.ONBOARDING },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: PaymentRecordStatusEnum.SUCCESS,
          paidAt: { gte: monthStart },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: PaymentRecordStatusEnum.SUCCESS,
        },
      }),
      this.prisma.tenant.count({
        where: { deletedAt: null, createdAt: { gte: monthStart } },
      }),
      this.prisma.tenantCertification.count({
        where: {
          status: {
            in: [
              PrismaTenantCertificationStatusEnum.PENDING_INITIAL_REVIEW,
              PrismaTenantCertificationStatusEnum.PENDING_SECONDARY_REVIEW,
              PrismaTenantCertificationStatusEnum.PENDING_CONFIRMATION,
            ],
          },
        },
      }),
      this.prisma.tenant.count({
        where: {
          deletedAt: null,
          expireAt: {
            gte: todayStart,
            lte: renewalDeadline,
          },
        },
      }),
    ]);

    const monthFlow = this.toMoney(monthFlowAggregate._sum.amount);
    const totalFlow = this.toMoney(totalFlowAggregate._sum.amount);
    const riskAlerts = pendingCertificationCount + renewalRiskCount;

    return [
      {
        label: '租户总数',
        value: `${totalTenants} 家`,
        helper: `活跃 ${activeTenants} 家，待上线 ${onboardingTenants} 家`,
        tone: 'blue',
      },
      {
        label: '平台总流水',
        value: `${this.formatAmount(totalFlow)} 元`,
        helper: `本月实收 ${this.formatAmount(monthFlow)} 元`,
        tone: 'emerald',
      },
      {
        label: '本月新增租户',
        value: `${newTenantsThisMonth} 家`,
        helper: '统计自然月内新建租户数量',
        tone: 'amber',
      },
      {
        label: '风险预警',
        value: `${riskAlerts} 条`,
        helper: `待审核 ${pendingCertificationCount} 条，近 ${TODO_RENEWAL_WINDOW_DAYS} 天到期 ${renewalRiskCount} 家`,
        tone: 'rose',
      },
    ];
  }

  async getTodos(currentUser: JwtPayload): Promise<PlatformTodoItem[]> {
    this.ensurePlatformScope(currentUser);

    const todayStart = dayjs().startOf('day').toDate();
    const renewalDeadline = dayjs().add(TODO_RENEWAL_WINDOW_DAYS, 'day').endOf('day').toDate();

    const [pendingCertificationCount, onboardingTenantCount, renewalRiskCount, pausedTenantCount] =
      await Promise.all([
        this.prisma.tenantCertification.count({
          where: {
            status: {
              in: [
                PrismaTenantCertificationStatusEnum.PENDING_INITIAL_REVIEW,
                PrismaTenantCertificationStatusEnum.PENDING_SECONDARY_REVIEW,
                PrismaTenantCertificationStatusEnum.PENDING_CONFIRMATION,
              ],
            },
          },
        }),
        this.prisma.tenant.count({
          where: {
            deletedAt: null,
            status: PrismaTenantStatusEnum.ONBOARDING,
          },
        }),
        this.prisma.tenant.count({
          where: {
            deletedAt: null,
            expireAt: {
              gte: todayStart,
              lte: renewalDeadline,
            },
          },
        }),
        this.prisma.tenant.count({
          where: {
            deletedAt: null,
            status: PrismaTenantStatusEnum.PAUSED,
          },
        }),
      ]);

    const todos: PlatformTodoItem[] = [];

    if (pendingCertificationCount > 0) {
      todos.push({
        title: `资质审核待处理 ${pendingCertificationCount} 条`,
        detail: '存在待初审、待复核或待确认的资质申请，需尽快完成审核流转。',
        owner: '平台审核',
        priority: '高',
      });
    }

    if (renewalRiskCount > 0) {
      todos.push({
        title: `近 ${TODO_RENEWAL_WINDOW_DAYS} 天到期租户 ${renewalRiskCount} 家`,
        detail: '请跟进续费进度，避免到期后影响租户正常运营。',
        owner: '商务运营',
        priority: '高',
      });
    }

    if (onboardingTenantCount > 0) {
      todos.push({
        title: `待上线租户 ${onboardingTenantCount} 家`,
        detail: '租户仍处于上线准备阶段，需要继续跟进初始化配置与培训。',
        owner: '客户成功',
        priority: '中',
      });
    }

    if (pausedTenantCount > 0) {
      todos.push({
        title: `冻结租户 ${pausedTenantCount} 家`,
        detail: '请确认冻结原因是否已解除，并判断是否需要恢复服务。',
        owner: '平台运营',
        priority: '中',
      });
    }

    if (todos.length === 0) {
      todos.push({
        title: '平台运营稳定',
        detail: '当前没有需要立即处理的高优先级事项。',
        owner: '平台运营',
        priority: '低',
      });
    }

    return todos;
  }

  async getTenantHealth(currentUser: JwtPayload): Promise<TenantHealthItem[]> {
    this.ensurePlatformScope(currentUser);
    return this.buildTenantHealthItems();
  }

  async getRiskEvents(currentUser: JwtPayload): Promise<LoginRiskEventItem[]> {
    this.ensurePlatformScope(currentUser);

    const [lockedUsers, accountAuditLogs] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          status: {
            in: [PrismaUserStatusEnum.LOCKED, PrismaUserStatusEnum.DISABLED],
          },
        },
        include: {
          tenant: {
            select: { name: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.auditLog.findMany({
        where: {
          targetType: AuditTargetTypeEnum.ACCOUNT,
        },
        include: {
          tenant: {
            select: { name: true },
          },
        },
        orderBy: { time: 'desc' },
        take: 10,
      }),
    ]);

    const userEvents = lockedUsers.map((user) => ({
      account: user.account,
      tenant: user.tenant?.name ?? '平台',
      event:
        user.status === PrismaUserStatusEnum.LOCKED ? '账号处于锁定状态' : '账号已被停用',
      time: user.updatedAt.toISOString(),
      level: user.status === PrismaUserStatusEnum.LOCKED ? '高' : '中',
    }));

    const auditEvents = accountAuditLogs.map((log) => ({
      account: log.target,
      tenant: log.tenant?.name ?? '平台',
      event: log.action,
      time: log.time.toISOString(),
      level: this.resolveAuditRiskLevel(log.action),
    }));

    return [...userEvents, ...auditEvents]
      .sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf())
      .slice(0, 10);
  }

  async getOverview(currentUser: JwtPayload): Promise<PlatformOverviewResponse> {
    this.ensurePlatformScope(currentUser);

    const todayStart = dayjs().startOf('day');
    const monthStart = dayjs().startOf('month');
    const sevenDayStart = dayjs().subtract(6, 'day').startOf('day');
    const renewalDeadline = dayjs().add(OVERVIEW_RENEWAL_WINDOW_DAYS, 'day').endOf('day');

    const tenantHealthItemsPromise = this.buildTenantHealthItems();
    const recentTenantsPromise = this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
        createdAt: {
          gte: sevenDayStart.toDate(),
        },
      },
      select: {
        createdAt: true,
      },
    });

    const [
      totalTenants,
      newTenantsThisMonth,
      activeNewTenants,
      totalFlowAggregate,
      churnWarningCount,
      renewalRiskTenants,
      tenantHealthItems,
      recentTenants,
    ] = await Promise.all([
      this.prisma.tenant.count({
        where: { deletedAt: null },
      }),
      this.prisma.tenant.count({
        where: {
          deletedAt: null,
          createdAt: { gte: monthStart.toDate() },
        },
      }),
      this.prisma.tenant.count({
        where: {
          deletedAt: null,
          createdAt: { gte: monthStart.toDate() },
          status: PrismaTenantStatusEnum.ACTIVE,
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: PaymentRecordStatusEnum.SUCCESS,
        },
      }),
      this.prisma.tenant.count({
        where: {
          deletedAt: null,
          OR: [
            {
              expireAt: {
                gte: todayStart.toDate(),
                lte: renewalDeadline.toDate(),
              },
            },
            { status: PrismaTenantStatusEnum.ATTENTION },
            { status: PrismaTenantStatusEnum.PAUSED },
          ],
        },
      }),
      this.prisma.tenant.findMany({
        where: {
          deletedAt: null,
          expireAt: {
            gte: todayStart.toDate(),
            lte: renewalDeadline.toDate(),
          },
        },
        orderBy: [{ expireAt: 'asc' }, { createdAt: 'asc' }],
        take: 10,
        select: {
          name: true,
          adminName: true,
          expireAt: true,
        },
      }),
      tenantHealthItemsPromise,
      recentTenantsPromise,
    ]);

    const totalFlow = this.toMoney(totalFlowAggregate._sum.amount);
    const healthScore =
      tenantHealthItems.length > 0
        ? Math.round(
            tenantHealthItems.reduce((sum, item) => sum + item.health, 0) / tenantHealthItems.length,
          )
        : 0;

    const dailyTrend = Array.from({ length: 7 }, (_, index) => {
      const current = sevenDayStart.add(index, 'day');
      return recentTenants.filter((tenant) => dayjs(tenant.createdAt).isSame(current, 'day')).length;
    });

    return {
      totalFlow,
      totalTenants,
      newTenantsThisMonth,
      healthScore,
      growth: {
        newTenants: newTenantsThisMonth,
        trialToFormal: activeNewTenants,
        churnWarning: churnWarningCount,
        dailyTrend,
      },
      renewalRisks: renewalRiskTenants.map((tenant) => ({
        tenantName: tenant.name,
        dueInDays: this.resolveDueInDays(tenant.expireAt),
        owner: tenant.adminName?.trim() || '待分配',
      })),
    };
  }

  private async buildTenantHealthItems(): Promise<TenantHealthItem[]> {
    const activeSince = dayjs().subtract(ACTIVE_USER_WINDOW_DAYS, 'day').startOf('day').toDate();

    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      select: {
        name: true,
        adminName: true,
        status: true,
        freezeReason: true,
        rejectReason: true,
        expireAt: true,
        createdAt: true,
        users: {
          where: { deletedAt: null },
          select: {
            loginAt: true,
          },
        },
      },
    });

    return tenants
      .map((tenant) => {
        const totalUsers = tenant.users.length;
        const activeUsers = tenant.users.filter(
          (user) => user.loginAt && dayjs(user.loginAt).isAfter(activeSince),
        ).length;
        const dueInDays = this.resolveDueInDays(tenant.expireAt);
        const health = this.resolveTenantHealthScore(tenant.status, activeUsers, totalUsers, dueInDays);

        return {
          tenant: tenant.name,
          health,
          userCoverage: this.resolveUserCoverage(activeUsers, totalUsers),
          exception: this.resolveTenantException({
            status: tenant.status,
            dueInDays,
            freezeReason: tenant.freezeReason,
            rejectReason: tenant.rejectReason,
            activeUsers,
            totalUsers,
          }),
          owner: tenant.adminName?.trim() || '待分配',
          _createdAt: tenant.createdAt.getTime(),
        };
      })
      .sort((a, b) => {
        if (a.health !== b.health) {
          return a.health - b.health;
        }
        return b._createdAt - a._createdAt;
      })
      .map(({ _createdAt, ...item }) => item);
  }

  private resolveTenantHealthScore(
    status: PrismaTenantStatusEnum,
    activeUsers: number,
    totalUsers: number,
    dueInDays: number,
  ): number {
    const baseScore = (() => {
      switch (status) {
        case PrismaTenantStatusEnum.PAUSED:
          return 35;
        case PrismaTenantStatusEnum.ATTENTION:
          return 55;
        case PrismaTenantStatusEnum.ONBOARDING:
          return 68;
        case PrismaTenantStatusEnum.ACTIVE:
        default:
          return 82;
      }
    })();

    const coverageBonus =
      totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 12) : 0;
    const duePenalty =
      dueInDays <= 7 ? 15 : dueInDays <= 30 ? 6 : 0;
    const idlePenalty = totalUsers > 0 && activeUsers === 0 ? 8 : 0;
    const rawScore = baseScore + coverageBonus - duePenalty - idlePenalty;

    return Math.min(100, Math.max(0, rawScore));
  }

  private resolveTenantException(input: {
    status: PrismaTenantStatusEnum;
    dueInDays: number;
    freezeReason: string | null;
    rejectReason: string | null;
    activeUsers: number;
    totalUsers: number;
  }): string {
    if (input.status === PrismaTenantStatusEnum.PAUSED) {
      return input.freezeReason?.trim() || '租户已冻结';
    }

    if (input.status === PrismaTenantStatusEnum.ATTENTION) {
      return input.rejectReason?.trim() || '存在待处理风险';
    }

    if (input.status === PrismaTenantStatusEnum.ONBOARDING) {
      return '待完成上线准备';
    }

    if (input.dueInDays <= 7) {
      return `距离到期 ${input.dueInDays} 天`;
    }

    if (input.totalUsers > 0 && input.activeUsers === 0) {
      return `近 ${ACTIVE_USER_WINDOW_DAYS} 天暂无活跃账号`;
    }

    return '运行稳定';
  }

  private resolveUserCoverage(activeUsers: number, totalUsers: number): string {
    if (totalUsers === 0) {
      return '0/0 已开通';
    }

    return `${activeUsers}/${totalUsers} 近${ACTIVE_USER_WINDOW_DAYS}天活跃`;
  }

  private resolveAuditRiskLevel(action: string): string {
    if (action.includes('删除') || action.includes('冻结') || action.includes('停用')) {
      return '高';
    }

    if (action.includes('重置') || action.includes('修改密码') || action.includes('锁定')) {
      return '中';
    }

    return '低';
  }

  private resolveDueInDays(expireAt: Date | null): number {
    if (!expireAt) {
      return 0;
    }

    return Math.max(dayjs(expireAt).endOf('day').diff(dayjs().startOf('day'), 'day'), 0);
  }

  private toMoney(value: Prisma.Decimal | Decimal | null | undefined): number {
    if (!value) {
      return 0;
    }

    return Number(new Decimal(value.toString()).toFixed(2));
  }

  private formatAmount(amount: number): string {
    return new Decimal(amount).toFixed(2);
  }

  private ensurePlatformScope(currentUser: JwtPayload): void {
    if (currentUser.side !== 'platform' || currentUser.tenantId) {
      throw new ForbiddenException('当前登录态不属于平台侧');
    }
  }
}
