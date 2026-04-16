import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  OrderImportConflictPolicyEnum as PrismaImportConflictPolicyEnum,
  OrderImportJobStatusEnum as PrismaImportJobStatusEnum,
  OrderPayTypeEnum as PrismaOrderPayTypeEnum,
  OrderStatusEnum as PrismaOrderStatusEnum,
  PaymentOrderStatusEnum,
  Prisma,
} from '@prisma/client';
import type {
  CreateOrderImportTemplateRequest,
  OrderImportDuplicateOrder,
  OrderImportJobConflictDetail,
  OrderImportJobFailure,
  OrderImportJobResponse,
  OrderImportPreviewError,
  OrderImportPreviewOrder,
  OrderImportPreviewOrderResult,
  OrderImportPreviewRequest,
  OrderImportPreviewResponse,
  OrderImportPreviewSummary,
  OrderImportSubmitRequest,
  OrderImportSubmitResponse,
  OrderImportTemplate,
  OrderImportTemplateMutationResponse,
  OrderImportTemplateField,
  OrderLineItem,
  UpdateOrderImportTemplateRequest,
} from '@shou/types/contracts';
import type { OrderImportJobStatus, OrderPayType, OrderStatus } from '@shou/types/enums';
import {
  OrderImportConflictPolicyEnum,
  OrderImportJobStatusEnum,
  OrderPayTypeEnum,
  OrderStatusEnum,
} from '@shou/types/enums';
import { randomBytes, randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { importConfig } from '../config/import.config';
import { IdGeneratorService } from '../id-generator/id-generator.service';
import { ID_CONFIG } from '../id-generator/id-generator.constants';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  resolveImportJobFinalStatus,
  shouldStartImportJobImmediately,
} from './import-job.worker.helpers';
import { IMPORT_RUNTIME_MODE, type ImportRuntimeMode } from './import.constants';

const IMPORT_PREVIEW_TTL_SECONDS = 3600;
const IMPORT_JOB_POLL_INTERVAL_MS = 5000;
const IMPORT_JOB_LOCK_TTL_SECONDS = 1800;
const IMPORT_JOB_STALE_SECONDS = 120;
const IMPORT_PREVIEW_CONSUME_LOCK_SECONDS = 30;

const DEFAULT_TEMPLATE_FIELDS: OrderImportTemplateField[] = [
  { label: '源订单号', key: 'sourceOrderNo', mapStr: '', isRequired: true },
  { label: '客户名称', key: 'customer', mapStr: '', isRequired: true },
  { label: '客户电话', key: 'customerPhone', mapStr: '', isRequired: true },
  { label: '客户地址', key: 'customerAddress', mapStr: '', isRequired: true },
  { label: '总金额', key: 'totalAmount', mapStr: '', isRequired: true },
  { label: '下单时间', key: 'orderTime', mapStr: '', isRequired: true },
  { label: '结算方式', key: 'payType', mapStr: '', isRequired: true },
];

interface PreparedImportOrder {
  index: number;
  sourceOrderNo: string;
  groupKey?: string;
  customer: string;
  customerPhone: string;
  customerAddress: string;
  totalAmount: number;
  orderTime: string;
  payType: OrderPayType;
  customerFieldValues: Record<string, string>;
  mappingTemplateId?: string;
  lineItems: OrderLineItem[];
}

interface PreviewSnapshot {
  previewId: string;
  tenantId: string;
  templateId: string;
  summary: OrderImportPreviewSummary;
  orders: PreparedImportOrder[];
  duplicateOrders: OrderImportDuplicateOrder[];
  invalidOrders: OrderImportPreviewError[];
}

interface ImportJobProgress {
  processedCount: number;
  successCount: number;
  skippedCount: number;
  overwrittenCount: number;
  failedOrders: OrderImportJobFailure[];
  conflictDetails: OrderImportJobConflictDetail[];
}

interface ImportOrderOutcome {
  type: 'created' | 'skipped' | 'overwritten';
  existingOrderId?: string;
  reason?: string;
}

@Injectable()
export class ImportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportService.name);
  private readonly queuedJobIds = new Set<string>();
  private jobPollingTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly idGen: IdGeneratorService,
    @Inject(importConfig.KEY)
    private readonly importSettings: ConfigType<typeof importConfig>,
    @Inject(IMPORT_RUNTIME_MODE)
    private readonly runtimeMode: ImportRuntimeMode,
  ) {}

  onModuleInit(): void {
    if (this.runtimeMode === 'worker' || this.importSettings.workerEnabled) {
      this.startImportJobPolling();
    }
  }

  onModuleDestroy(): void {
    if (this.jobPollingTimer) {
      clearInterval(this.jobPollingTimer);
    }
  }

  getDefaultTemplate(): OrderImportTemplateField[] {
    return DEFAULT_TEMPLATE_FIELDS.map((field) => ({ ...field }));
  }

  async getImportTemplates(currentUser: JwtPayload): Promise<OrderImportTemplate[]> {
    const tenantId = this.getTenantId(currentUser);
    const templates = await this.prisma.importTemplate.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return templates.map((template) => this.toTemplate(template));
  }

  async createImportTemplate(
    currentUser: JwtPayload,
    request: CreateOrderImportTemplateRequest,
  ): Promise<OrderImportTemplateMutationResponse> {
    const tenantId = this.getTenantId(currentUser);
    const normalized = this.normalizeTemplatePayload(request);
    await this.ensureTemplateNameAvailable(tenantId, normalized.name);

    const created = await this.prisma.$transaction(async (tx) => {
      if (normalized.isDefault) {
        await tx.importTemplate.updateMany({
          where: { tenantId, deletedAt: null },
          data: { isDefault: false },
        });
      }

      return tx.importTemplate.create({
        data: {
          tenantId,
          name: normalized.name,
          isDefault: normalized.isDefault,
          defaultFields: normalized.defaultFields as unknown as Prisma.InputJsonValue,
          customerFields: normalized.customerFields as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.toTemplateMutationResponse(created);
  }

  async updateImportTemplate(
    currentUser: JwtPayload,
    templateId: string,
    request: UpdateOrderImportTemplateRequest,
  ): Promise<OrderImportTemplateMutationResponse> {
    const tenantId = this.getTenantId(currentUser);
    const existing = await this.getScopedTemplate(tenantId, templateId);
    const current = this.toTemplate(existing);
    const normalized = this.normalizeTemplatePayload({
      name: request.name ?? current.name,
      isDefault: request.isDefault ?? current.isDefault,
      defaultFields: request.defaultFields ?? current.defaultFields,
      customerFields:
        request.customerFields ??
        current.customerFields.map((field) => ({
          label: field.label,
          mapStr: field.mapStr,
        })),
    });
    await this.ensureTemplateNameAvailable(tenantId, normalized.name, templateId);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (normalized.isDefault) {
        await tx.importTemplate.updateMany({
          where: { tenantId, deletedAt: null, id: { not: BigInt(templateId) } },
          data: { isDefault: false },
        });
      }

      return tx.importTemplate.update({
        where: { id: BigInt(templateId) },
        data: {
          name: normalized.name,
          isDefault: normalized.isDefault,
          defaultFields: normalized.defaultFields as unknown as Prisma.InputJsonValue,
          customerFields: normalized.customerFields as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.toTemplateMutationResponse(updated);
  }

  async previewImport(
    currentUser: JwtPayload,
    request: OrderImportPreviewRequest,
  ): Promise<OrderImportPreviewResponse> {
    const tenantId = this.getTenantId(currentUser);
    const snapshot = await this.buildPreviewSnapshot(tenantId, request);

    await this.redis.setJson(this.getPreviewKey(snapshot.previewId), snapshot, IMPORT_PREVIEW_TTL_SECONDS);

    return {
      previewId: snapshot.previewId,
      templateId: snapshot.templateId,
      summary: snapshot.summary,
      orders: snapshot.orders.map((order) => this.toPreviewOrderResult(order)),
      duplicateOrders: snapshot.duplicateOrders,
      invalidOrders: snapshot.invalidOrders,
    };
  }

  async submitOrderImport(
    currentUser: JwtPayload,
    request: OrderImportSubmitRequest,
  ): Promise<OrderImportSubmitResponse> {
    const tenantId = this.getTenantId(currentUser);
    const lockKey = this.getPreviewConsumeLockKey(request.previewId);
    const lockValue = await this.redis.acquireLock(lockKey, IMPORT_PREVIEW_CONSUME_LOCK_SECONDS);
    if (!lockValue) {
      throw new BadRequestException('预检结果正在被消费，请勿重复提交');
    }

    try {
      const snapshot = await this.readPreviewSnapshot(tenantId, request.previewId);
      if (snapshot.invalidOrders.length > 0) {
        throw new BadRequestException('导入数据未通过预检，请先修正订单错误');
      }
      if (snapshot.orders.length === 0) {
        throw new BadRequestException('没有可导入的有效订单');
      }

      const conflictPolicy = request.conflictPolicy ?? OrderImportConflictPolicyEnum.SKIP;
      const jobId = await this.idGen.nextDailyId(ID_CONFIG.IMPORT_JOB.prefix, ID_CONFIG.IMPORT_JOB.digits);
      const job = await this.prisma.importJob.create({
        data: {
          id: jobId,
          tenantId,
          status: PrismaImportJobStatusEnum.PENDING,
          conflictPolicy: this.toPrismaImportConflictPolicy(conflictPolicy),
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          submittedCount: snapshot.orders.length,
          processedCount: 0,
          successCount: 0,
          skippedCount: 0,
          overwrittenCount: 0,
          failedCount: 0,
          failedOrders: [],
          conflictDetails: [],
        },
      });

      await this.redis.delete(this.getPreviewKey(request.previewId));

      if (
        shouldStartImportJobImmediately({
          IMPORT_JOB_WORKER_ENABLED: String(this.importSettings.workerEnabled),
        })
      ) {
        this.enqueueImportJob(job.id);
      }

      return {
        jobId: job.id,
        previewId: snapshot.previewId,
        submittedCount: job.submittedCount,
        status: this.toImportJobStatus(job.status),
      };
    } finally {
      await this.redis.releaseLock(lockKey, lockValue).catch(() => false);
    }
  }

  async getImportJob(currentUser: JwtPayload, jobId: string): Promise<OrderImportJobResponse> {
    const tenantId = this.getTenantId(currentUser);
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, tenantId },
    });

    if (!job) {
      throw new NotFoundException('未找到对应的导入任务');
    }

    const snapshot = this.asPreviewSnapshot(job.snapshot);
    if (!snapshot) {
      throw new NotFoundException('导入任务缺少可读快照');
    }

    return {
      jobId: job.id,
      previewId: snapshot.previewId,
      status: this.toImportJobStatus(job.status),
      submittedCount: job.submittedCount,
      processedCount: job.processedCount,
      successCount: job.successCount,
      skippedCount: job.skippedCount,
      overwrittenCount: job.overwrittenCount,
      failedCount: job.failedCount,
      failedOrders: this.asJobFailures(job.failedOrders),
      conflictDetails: this.asConflictDetails(job.conflictDetails),
      completedAt: job.completedAt?.toISOString(),
    };
  }

  private async buildPreviewSnapshot(
    tenantId: string,
    request: OrderImportPreviewRequest,
  ): Promise<PreviewSnapshot> {
    if (!request.orders?.length) {
      throw new BadRequestException('导入预检至少需要一张订单');
    }

    const template = this.toTemplate(await this.getScopedTemplate(tenantId, request.templateId));
    const customerFieldKeySet = new Set(template.customerFields.map((field) => field.key));
    const invalidErrors: OrderImportPreviewError[] = [];
    const normalizedOrders: PreparedImportOrder[] = [];

    request.orders.forEach((order, index) => {
      const prepared = this.normalizePreviewOrder(order, index + 1, String(template.id), customerFieldKeySet);
      if ('error' in prepared) {
        invalidErrors.push(...prepared.error);
        return;
      }

      normalizedOrders.push(prepared.value);
    });

    const batchCountMap = normalizedOrders.reduce<Map<string, number>>((acc, order) => {
      acc.set(order.sourceOrderNo, (acc.get(order.sourceOrderNo) ?? 0) + 1);
      return acc;
    }, new Map());

    const validOrders = normalizedOrders.filter((order) => {
      const currentCount = batchCountMap.get(order.sourceOrderNo) ?? 0;
      if (currentCount <= 1) {
        return true;
      }

      invalidErrors.push({
        index: order.index,
        sourceOrderNo: order.sourceOrderNo,
        field: 'sourceOrderNo',
        reason: '当前批次存在重复的源订单号',
      });
      return false;
    });

    const existingMap = await this.loadExistingOrderMap(
      tenantId,
      Array.from(new Set(validOrders.map((order) => order.sourceOrderNo))),
    );

    const duplicateOrders = validOrders
      .filter((order) => existingMap.has(order.sourceOrderNo))
      .map((order) => {
        const existing = existingMap.get(order.sourceOrderNo)!;
        return {
          sourceOrderNo: order.sourceOrderNo,
          existingOrderId: existing.id,
          customer: existing.customer,
          totalAmount: existing.totalAmount,
          existingStatus: existing.status,
          incomingCount: batchCountMap.get(order.sourceOrderNo) ?? 1,
        };
      });

    return {
      previewId: randomUUID(),
      tenantId,
      templateId: String(template.id),
      summary: this.buildPreviewSummary(request.orders.length, validOrders, invalidErrors, duplicateOrders),
      orders: validOrders,
      duplicateOrders: this.uniqueDuplicateOrders(duplicateOrders),
      invalidOrders: invalidErrors,
    };
  }

  private normalizePreviewOrder(
    order: OrderImportPreviewOrder,
    index: number,
    templateId: string,
    customerFieldKeySet: Set<string>,
  ): { value: PreparedImportOrder } | { error: OrderImportPreviewError[] } {
    const errors: OrderImportPreviewError[] = [];
    const sourceOrderNo = this.readString(order.sourceOrderNo);
    const customer = this.readString(order.customer);
    const customerPhone = this.readString(order.customerPhone);
    const customerAddress = this.readString(order.customerAddress);
    const groupKey = this.readString(order.groupKey) ?? sourceOrderNo;
    const totalAmount = this.readMoney(order.totalAmount);
    const orderTime = this.readDate(order.orderTime);
    const payType = this.readPayType(order.payType);

    if (!sourceOrderNo) {
      errors.push({ index, field: 'sourceOrderNo', reason: '源订单号不能为空' });
    }
    if (!customer) {
      errors.push({ index, sourceOrderNo, field: 'customer', reason: '客户名称不能为空' });
    }
    if (!customerPhone) {
      errors.push({ index, sourceOrderNo, field: 'customerPhone', reason: '客户电话不能为空' });
    }
    if (!customerAddress) {
      errors.push({ index, sourceOrderNo, field: 'customerAddress', reason: '客户地址不能为空' });
    }
    if (totalAmount === undefined) {
      errors.push({ index, sourceOrderNo, field: 'totalAmount', reason: '总金额不能为空' });
    } else if (totalAmount.lte(0)) {
      errors.push({ index, sourceOrderNo, field: 'totalAmount', reason: '总金额必须大于 0' });
    }
    if (!orderTime) {
      errors.push({ index, sourceOrderNo, field: 'orderTime', reason: '下单时间格式不正确' });
    }
    if (!payType) {
      errors.push({ index, sourceOrderNo, field: 'payType', reason: '结算方式不正确，仅支持 cash 或 credit' });
    }

    const customerFieldValues = this.normalizeCustomerFieldValues(
      order.customerFieldValues,
      customerFieldKeySet,
      index,
      sourceOrderNo,
    );
    errors.push(...customerFieldValues.errors);

    const lineItems = this.normalizeLineItems(order.lineItems ?? [], index, sourceOrderNo);
    errors.push(...lineItems.errors);

    if (
      errors.length > 0
      || !sourceOrderNo
      || !customer
      || !customerPhone
      || !customerAddress
      || !totalAmount
      || !orderTime
      || !payType
    ) {
      return { error: errors };
    }

    return {
      value: {
        index,
        sourceOrderNo,
        groupKey,
        customer,
        customerPhone,
        customerAddress,
        totalAmount: Number(totalAmount.toFixed(2)),
        orderTime: orderTime.toISOString(),
        payType,
        customerFieldValues: customerFieldValues.values,
        mappingTemplateId: templateId,
        lineItems: lineItems.values,
      },
    };
  }

  private normalizeCustomerFieldValues(
    value: Record<string, string> | undefined,
    customerFieldKeySet: Set<string>,
    index: number,
    sourceOrderNo?: string,
  ): { values: Record<string, string>; errors: OrderImportPreviewError[] } {
    const errors: OrderImportPreviewError[] = [];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { values: {}, errors };
    }

    const values = Object.entries(value).reduce<Record<string, string>>((acc, [key, item]) => {
      const resolved = this.readString(item);
      if (!customerFieldKeySet.has(key)) {
        errors.push({
          index,
          sourceOrderNo,
          field: 'customerFieldValues',
          reason: `自定义字段 key 不存在：${key}`,
        });
        return acc;
      }

      if (resolved) {
        acc[key] = resolved;
      }
      return acc;
    }, {});

    return { values, errors };
  }

  private normalizeLineItems(
    lineItems: OrderLineItem[],
    index: number,
    sourceOrderNo?: string,
  ): { values: OrderLineItem[]; errors: OrderImportPreviewError[] } {
    const errors: OrderImportPreviewError[] = [];
    const values: OrderLineItem[] = [];

    lineItems.forEach((item, itemIndex) => {
      try {
        values.push(this.normalizeLineItem(item));
      } catch (error) {
        errors.push({
          index,
          sourceOrderNo,
          field: `lineItems[${itemIndex}]`,
          reason: error instanceof Error ? error.message : '订单明细格式不正确',
        });
      }
    });

    return { values, errors };
  }

  private normalizeLineItem(item: OrderLineItem): OrderLineItem {
    const quantity = this.toDecimal(item.quantity, 'quantity', 3);
    const unitPrice = this.toMoney(item.unitPrice, 'unitPrice', true);
    const lineAmount = this.toMoney(item.lineAmount, 'lineAmount', true);
    const expected = quantity.mul(unitPrice).toDecimalPlaces(2);

    if (!expected.equals(lineAmount)) {
      throw new BadRequestException('lineAmount 必须等于 quantity * unitPrice');
    }

    return {
      itemId: item.itemId,
      skuId: item.skuId ?? null,
      skuName: this.normalizeRequiredText(item.skuName, 'skuName', 200),
      skuSpec: item.skuSpec?.trim() ? this.cut(item.skuSpec.trim(), 100) : undefined,
      unit: this.normalizeRequiredText(item.unit, 'unit', 20),
      quantity: Number(quantity.toFixed(3)),
      unitPrice: Number(unitPrice.toFixed(2)),
      lineAmount: Number(lineAmount.toFixed(2)),
    };
  }

  private buildPreviewSummary(
    totalOrders: number,
    orders: PreparedImportOrder[],
    invalidOrders: OrderImportPreviewError[],
    duplicateOrders: OrderImportDuplicateOrder[],
  ): OrderImportPreviewSummary {
    const invalidOrderCount = new Set(invalidOrders.map((item) => item.index)).size;
    return {
      totalOrders,
      validOrders: orders.length,
      invalidOrders: invalidOrderCount,
      duplicateOrderCount: this.uniqueDuplicateOrders(duplicateOrders).length,
      errorCount: invalidOrders.length,
    };
  }

  private uniqueDuplicateOrders(duplicateOrders: OrderImportDuplicateOrder[]): OrderImportDuplicateOrder[] {
    const seen = new Set<string>();
    return duplicateOrders.filter((item) => {
      if (seen.has(item.sourceOrderNo)) {
        return false;
      }
      seen.add(item.sourceOrderNo);
      return true;
    });
  }

  private enqueueImportJob(jobId: string): void {
    if (this.queuedJobIds.has(jobId)) {
      return;
    }

    this.queuedJobIds.add(jobId);
    setImmediate(() => {
      void this.runQueuedImportJob(jobId).finally(() => {
        this.queuedJobIds.delete(jobId);
      });
    });
  }

  private startImportJobPolling(): void {
    void this.pollRunnableImportJobs().catch((error) => {
      this.logger.error('导入任务轮询初始化失败', error instanceof Error ? error.stack : undefined);
    });
    this.jobPollingTimer = setInterval(() => {
      void this.pollRunnableImportJobs().catch((error) => {
        this.logger.error('导入任务轮询失败', error instanceof Error ? error.stack : undefined);
      });
    }, IMPORT_JOB_POLL_INTERVAL_MS);
  }

  private async pollRunnableImportJobs(): Promise<void> {
    const staleBefore = new Date(Date.now() - IMPORT_JOB_STALE_SECONDS * 1000);
    const jobs = await this.prisma.importJob.findMany({
      where: {
        OR: [
          { status: PrismaImportJobStatusEnum.PENDING },
          {
            status: PrismaImportJobStatusEnum.PROCESSING,
            OR: [{ heartbeatAt: null }, { heartbeatAt: { lt: staleBefore } }],
          },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    for (const job of jobs) {
      this.enqueueImportJob(job.id);
    }
  }

  private async runQueuedImportJob(jobId: string): Promise<void> {
    const lockKey = this.getImportJobLockKey(jobId);
    const lockValue = await this.redis.acquireLock(lockKey, IMPORT_JOB_LOCK_TTL_SECONDS);
    if (!lockValue) {
      return;
    }

    try {
      const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
      if (
        !job ||
        job.status === PrismaImportJobStatusEnum.COMPLETED ||
        job.status === PrismaImportJobStatusEnum.FAILED
      ) {
        return;
      }

      const snapshot = this.asPreviewSnapshot(job.snapshot);
      if (!snapshot) {
        await this.markImportJobFailed(jobId, '导入任务缺少可恢复快照，无法继续执行');
        return;
      }

      const progress = this.readJobProgress(job);
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: PrismaImportJobStatusEnum.PROCESSING,
          startedAt: job.startedAt ?? new Date(),
          heartbeatAt: new Date(),
          lastError: null,
        },
      });

      await this.processImportJob(
        job.id,
        job.tenantId,
        snapshot,
        this.toImportConflictPolicy(job.conflictPolicy),
        progress,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入任务执行失败';
      this.logger.error(`导入任务执行失败: ${jobId}`, error instanceof Error ? error.stack : undefined);
      await this.markImportJobFailed(jobId, message);
    } finally {
      await this.redis.releaseLock(lockKey, lockValue).catch(() => false);
    }
  }

  private async processImportJob(
    jobId: string,
    tenantId: string,
    snapshot: PreviewSnapshot,
    conflictPolicy: (typeof OrderImportConflictPolicyEnum)[keyof typeof OrderImportConflictPolicyEnum],
    initialProgress: ImportJobProgress,
  ): Promise<void> {
    let progress = initialProgress;

    for (let index = progress.processedCount; index < snapshot.orders.length; index += 1) {
      const order = snapshot.orders[index];

      try {
        progress = await this.prisma.$transaction(async (tx) => {
          const outcome = await this.applyImportOrder(tx, tenantId, order, conflictPolicy);
          const nextProgress = this.nextProgressForOutcome(progress, order, outcome);
          await tx.importJob.update({
            where: { id: jobId },
            data: this.toImportJobProgressUpdate(nextProgress),
          });
          return nextProgress;
        });
      } catch (error) {
        const nextProgress = this.nextProgressForFailure(progress, order, error);
        await this.prisma.importJob.update({
          where: { id: jobId },
          data: this.toImportJobProgressUpdate(nextProgress),
        });
        progress = nextProgress;
      }
    }

    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        ...this.toImportJobProgressUpdate(progress),
        status: this.resolveFinalImportJobStatus(progress),
        completedAt: new Date(),
        lastError: null,
      },
    });
  }

  private async applyImportOrder(
    client: Prisma.TransactionClient,
    tenantId: string,
    order: PreparedImportOrder,
    conflictPolicy: (typeof OrderImportConflictPolicyEnum)[keyof typeof OrderImportConflictPolicyEnum],
  ): Promise<ImportOrderOutcome> {
    const existing = await this.findExistingOrder(client, tenantId, order.sourceOrderNo);
    if (existing) {
      if (conflictPolicy === OrderImportConflictPolicyEnum.SKIP) {
        return {
          type: 'skipped',
          existingOrderId: existing.id,
          reason: '命中重复订单，按 skip 跳过',
        };
      }

      if (await this.hasSettledFlow(client, existing.id)) {
        return {
          type: 'skipped',
          existingOrderId: existing.id,
          reason: '已有支付记录或支付单，禁止覆盖',
        };
      }

      await client.order.update({
        where: { id: existing.id },
        data: this.toOrderUpdateInput(order),
      });

      return {
        type: 'overwritten',
        existingOrderId: existing.id,
        reason: '覆盖已有订单成功',
      };
    }

    const orderId = await this.idGen.nextDailyId(ID_CONFIG.ORDER.prefix, ID_CONFIG.ORDER.digits);
    await client.order.create({
      data: { ...this.toOrderCreateInput(tenantId, order), id: orderId } as unknown as Prisma.OrderCreateInput,
    });

    return { type: 'created' };
  }

  private nextProgressForOutcome(
    current: ImportJobProgress,
    order: PreparedImportOrder,
    outcome: ImportOrderOutcome,
  ): ImportJobProgress {
    const next: ImportJobProgress = {
      processedCount: current.processedCount + 1,
      successCount: current.successCount,
      skippedCount: current.skippedCount,
      overwrittenCount: current.overwrittenCount,
      failedOrders: [...current.failedOrders],
      conflictDetails: [...current.conflictDetails],
    };

    if (outcome.type === 'created') {
      next.successCount += 1;
      return next;
    }

    next.conflictDetails.push({
      sourceOrderNo: order.sourceOrderNo,
      existingOrderId: outcome.existingOrderId,
      action:
        outcome.type === 'overwritten'
          ? OrderImportConflictPolicyEnum.OVERWRITE
          : OrderImportConflictPolicyEnum.SKIP,
      reason: outcome.reason ?? '导入任务处理完成',
    });

    if (outcome.type === 'overwritten') {
      next.overwrittenCount += 1;
    } else {
      next.skippedCount += 1;
    }

    return next;
  }

  private nextProgressForFailure(
    current: ImportJobProgress,
    order: PreparedImportOrder,
    error: unknown,
  ): ImportJobProgress {
    return {
      processedCount: current.processedCount + 1,
      successCount: current.successCount,
      skippedCount: current.skippedCount,
      overwrittenCount: current.overwrittenCount,
      failedOrders: [
        ...current.failedOrders,
        {
          index: order.index,
          sourceOrderNo: order.sourceOrderNo,
          reason: error instanceof Error ? error.message : '导入处理失败',
        },
      ],
      conflictDetails: [...current.conflictDetails],
    };
  }

  private readJobProgress(job: {
    processedCount: number;
    successCount: number;
    skippedCount: number;
    overwrittenCount: number;
    failedOrders: Prisma.JsonValue | null;
    conflictDetails: Prisma.JsonValue | null;
  }): ImportJobProgress {
    return {
      processedCount: job.processedCount,
      successCount: job.successCount,
      skippedCount: job.skippedCount,
      overwrittenCount: job.overwrittenCount,
      failedOrders: this.asJobFailures(job.failedOrders),
      conflictDetails: this.asConflictDetails(job.conflictDetails),
    };
  }

  private toImportJobProgressUpdate(progress: ImportJobProgress): Prisma.ImportJobUpdateInput {
    return {
      processedCount: progress.processedCount,
      successCount: progress.successCount,
      skippedCount: progress.skippedCount,
      overwrittenCount: progress.overwrittenCount,
      failedCount: progress.failedOrders.length,
      failedOrders: progress.failedOrders as unknown as Prisma.InputJsonValue,
      conflictDetails: progress.conflictDetails as unknown as Prisma.InputJsonValue,
      heartbeatAt: new Date(),
    };
  }

  private resolveFinalImportJobStatus(progress: ImportJobProgress): PrismaImportJobStatusEnum {
    return resolveImportJobFinalStatus({
      successCount: progress.successCount,
      skippedCount: progress.skippedCount,
      overwrittenCount: progress.overwrittenCount,
      failedCount: progress.failedOrders.length,
    });
  }

  private async markImportJobFailed(jobId: string, message: string): Promise<void> {
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: PrismaImportJobStatusEnum.FAILED,
        completedAt: new Date(),
        heartbeatAt: new Date(),
        lastError: this.cut(message, 500),
      },
    });
  }

  private toOrderCreateInput(
    tenantId: string,
    order: PreparedImportOrder,
  ): Prisma.OrderCreateInput {
    return {
      tenant: { connect: { id: tenantId } },
      sourceOrderNo: order.sourceOrderNo,
      groupKey: order.groupKey,
      mappingTemplate: { connect: { id: BigInt(order.mappingTemplateId as string) } },
      qrCodeToken: this.generateQrCodeToken(),
      customer: this.cut(order.customer, 100),
      customerPhone: this.cut(order.customerPhone, 30),
      customerAddress: this.cut(order.customerAddress, 255),
      totalAmount: this.toPrismaDecimal(this.toMoney(order.totalAmount, 'totalAmount')),
      paid: this.toPrismaDecimal(new Decimal(0)),
      customerFieldValues: order.customerFieldValues as unknown as Prisma.InputJsonValue,
      status: PrismaOrderStatusEnum.PENDING,
      payType: this.toPrismaOrderPayType(order.payType),
      prints: 0,
      orderTime: new Date(order.orderTime),
      voided: false,
      lineItems: {
        create: order.lineItems.map((item) => this.toLineItemInput(item)),
      },
    } as unknown as Prisma.OrderCreateInput;
  }

  private toOrderUpdateInput(order: PreparedImportOrder): Prisma.OrderUpdateInput {
    return {
      groupKey: order.groupKey,
      mappingTemplate: { connect: { id: BigInt(order.mappingTemplateId as string) } },
      customer: this.cut(order.customer, 100),
      customerPhone: this.cut(order.customerPhone, 30),
      customerAddress: this.cut(order.customerAddress, 255),
      totalAmount: this.toPrismaDecimal(this.toMoney(order.totalAmount, 'totalAmount')),
      paid: this.toPrismaDecimal(new Decimal(0)),
      customerFieldValues: order.customerFieldValues as unknown as Prisma.InputJsonValue,
      status: PrismaOrderStatusEnum.PENDING,
      payType: this.toPrismaOrderPayType(order.payType),
      orderTime: new Date(order.orderTime),
      voided: false,
      voidReason: null,
      voidedAt: null,
      lineItems: {
        deleteMany: {},
        create: order.lineItems.map((item) => this.toLineItemInput(item)),
      },
    } as unknown as Prisma.OrderUpdateInput;
  }

  private toLineItemInput(item: OrderLineItem): Prisma.OrderItemCreateWithoutOrderInput {
    return {
      skuId: item.skuId ?? null,
      skuName: this.cut(item.skuName, 200),
      skuSpec: item.skuSpec ? this.cut(item.skuSpec, 100) : undefined,
      unit: this.cut(item.unit, 20),
      quantity: this.toPrismaDecimal(this.toDecimal(item.quantity, 'quantity', 3)),
      unitPrice: this.toPrismaDecimal(this.toMoney(item.unitPrice, 'unitPrice', true)),
      lineAmount: this.toPrismaDecimal(this.toMoney(item.lineAmount, 'lineAmount', true)),
    };
  }

  private toPreviewOrderResult(order: PreparedImportOrder): OrderImportPreviewOrderResult {
    return {
      sourceOrderNo: order.sourceOrderNo,
      groupKey: order.groupKey,
      customer: order.customer,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      totalAmount: order.totalAmount,
      orderTime: order.orderTime,
      payType: order.payType,
      customerFieldValues: order.customerFieldValues,
      mappingTemplateId: order.mappingTemplateId,
      lineItems: order.lineItems,
    };
  }

  private normalizeTemplatePayload(
    payload: CreateOrderImportTemplateRequest,
  ): Pick<OrderImportTemplate, 'name' | 'isDefault' | 'defaultFields' | 'customerFields'> {
    const name = this.normalizeRequiredText(payload.name, 'name', 100);
    const incomingDefaultFields = payload.defaultFields ?? [];
    if (incomingDefaultFields.length !== DEFAULT_TEMPLATE_FIELDS.length) {
      throw new BadRequestException(
        `defaultFields 必须完整包含 ${DEFAULT_TEMPLATE_FIELDS.length} 个系统字段`,
      );
    }

    this.ensureNoDuplicate(
      incomingDefaultFields.map((field) =>
        this.normalizeRequiredText(field.key, 'defaultFields.key', 50),
      ),
      'defaultFields.key',
    );

    const defaultFieldMap = new Map<string, OrderImportTemplateField>(
      incomingDefaultFields.map((field: OrderImportTemplateField) => [field.key, field]),
    );

    const defaultFields = DEFAULT_TEMPLATE_FIELDS.map((field) => {
      const input = defaultFieldMap.get(field.key);
      if (!input) {
        throw new BadRequestException(`缺少系统字段：${field.key}`);
      }
      if (input.label !== field.label) {
        throw new BadRequestException(`系统字段 ${field.key} 的 label 不允许修改`);
      }
      if (input.isRequired !== field.isRequired) {
        throw new BadRequestException(`系统字段 ${field.key} 的 isRequired 不允许修改`);
      }
      const mapStr = this.readString(input?.mapStr);
      if (!mapStr) {
        throw new BadRequestException(`${field.label} 的 mapStr 不能为空`);
      }
      return {
        label: field.label,
        key: field.key,
        mapStr,
        isRequired: true,
      };
    });

    const unexpectedDefaultField = (payload.defaultFields ?? []).find(
      (field: OrderImportTemplateField) => !DEFAULT_TEMPLATE_FIELDS.some((item) => item.key === field.key),
    );
    if (unexpectedDefaultField) {
      throw new BadRequestException(`默认字段 key 非法：${unexpectedDefaultField.key}`);
    }

    const customerFields = (payload.customerFields ?? []).map((field, index): OrderImportTemplateField => {
      const label = this.normalizeRequiredText(field.label, `customerFields[${index}].label`, 100);
      const mapStr = this.readString(field.mapStr);
      if (!mapStr) {
        throw new BadRequestException(`customerFields[${index}].mapStr 不能为空`);
      }

      return {
        label,
        key: `customerKey${index + 1}`,
        mapStr,
        isRequired: false,
      };
    });

    this.ensureNoDuplicate(customerFields.map((field) => field.label), 'customerFields.label');
    this.ensureNoDuplicate(
      [...defaultFields, ...customerFields].map((field) => field.mapStr),
      'mapStr',
    );

    return {
      name,
      isDefault: Boolean(payload.isDefault),
      defaultFields,
      customerFields,
    };
  }

  private ensureNoDuplicate(values: string[], label: string): void {
    const seen = new Set<string>();
    for (const value of values) {
      const normalized = value.trim().toLowerCase();
      if (seen.has(normalized)) {
        throw new BadRequestException(`${label} 重复：${value}`);
      }
      seen.add(normalized);
    }
  }

  private async ensureTemplateNameAvailable(
    tenantId: string,
    name: string,
    excludeTemplateId?: string,
  ): Promise<void> {
    const existing = await this.prisma.importTemplate.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        id: excludeTemplateId ? { not: BigInt(excludeTemplateId) } : undefined,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('映射模板名称已存在');
    }
  }

  private async getScopedTemplate(tenantId: string, templateId: string) {
    const template = await this.prisma.importTemplate.findFirst({
      where: { id: BigInt(templateId), tenantId, deletedAt: null },
    });
    if (!template) {
      throw new NotFoundException('未找到对应的导入模板');
    }
    return template;
  }

  private async loadExistingOrderMap(
    tenantId: string,
    sourceOrderNos: string[],
  ): Promise<Map<string, { id: string; customer: string; totalAmount: number; status: OrderStatus }>> {
    if (sourceOrderNos.length === 0) {
      return new Map();
    }

    const existing = await this.prisma.order.findMany({
      where: { tenantId, sourceOrderNo: { in: sourceOrderNos }, deletedAt: null },
      select: {
        id: true,
        sourceOrderNo: true,
        customer: true,
        totalAmount: true,
        status: true,
      },
    });

    return new Map(
      existing
        .filter((item): item is typeof item & { sourceOrderNo: string } => Boolean(item.sourceOrderNo))
        .map((item) => [
          item.sourceOrderNo,
          {
            id: item.id,
            customer: item.customer,
            totalAmount: Number(item.totalAmount.toFixed(2)),
            status: this.fromPrismaOrderStatus(item.status),
          },
        ]),
    );
  }

  private async readPreviewSnapshot(tenantId: string, previewId: string): Promise<PreviewSnapshot> {
    const snapshot = await this.redis.getJson<PreviewSnapshot>(this.getPreviewKey(previewId));
    if (!snapshot) {
      throw new BadRequestException('预检结果不存在或已过期');
    }
    if (snapshot.tenantId !== tenantId) {
      throw new ForbiddenException('无权使用该预检结果');
    }
    return snapshot;
  }

  private async findExistingOrder(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    sourceOrderNo: string,
  ) {
    return client.order.findUnique({
      where: { tenantId_sourceOrderNo: { tenantId, sourceOrderNo } },
      select: { id: true },
    });
  }

  private async hasSettledFlow(
    client: Prisma.TransactionClient | PrismaService,
    orderId: string,
  ): Promise<boolean> {
    const [payments, paymentOrders] = await Promise.all([
      client.payment.count({ where: { orderId } }),
      client.paymentOrder.count({
        where: {
          orderId,
          status: {
            in: [
              PaymentOrderStatusEnum.PAYING,
              PaymentOrderStatusEnum.PENDING_VERIFICATION,
              PaymentOrderStatusEnum.PAID,
            ],
          },
        },
      }),
    ]);

    return payments > 0 || paymentOrders > 0;
  }

  private toTemplate(template: {
    id: bigint;
    name: string;
    isDefault: boolean;
    updatedAt: Date;
    defaultFields: Prisma.JsonValue;
    customerFields: Prisma.JsonValue;
  }): OrderImportTemplate {
    return {
      id: String(template.id),
      name: template.name,
      isDefault: template.isDefault,
      updatedAt: template.updatedAt.toISOString(),
      defaultFields: this.asTemplateFields(template.defaultFields),
      customerFields: this.asTemplateFields(template.customerFields),
    };
  }

  private toTemplateMutationResponse(template: {
    id: bigint;
    name: string;
    isDefault: boolean;
    updatedAt: Date;
  }): OrderImportTemplateMutationResponse {
    return {
      id: String(template.id),
      name: template.name,
      isDefault: template.isDefault,
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  private asTemplateFields(value: Prisma.JsonValue): OrderImportTemplateField[] {
    return Array.isArray(value) ? (value as unknown as OrderImportTemplateField[]) : [];
  }

  private asJobFailures(value: Prisma.JsonValue | null): OrderImportJobFailure[] {
    return Array.isArray(value) ? (value as unknown as OrderImportJobFailure[]) : [];
  }

  private asConflictDetails(value: Prisma.JsonValue | null): OrderImportJobConflictDetail[] {
    return Array.isArray(value) ? (value as unknown as OrderImportJobConflictDetail[]) : [];
  }

  private readString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const resolved = String(value).trim();
    return resolved ? resolved : undefined;
  }

  private readDate(value: unknown): Date | undefined {
    const resolved = this.readString(value);
    if (!resolved) {
      return undefined;
    }
    const date = new Date(resolved);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private readMoney(value: unknown): Decimal | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
    if (!Number.isFinite(numeric)) {
      return undefined;
    }
    return new Decimal(numeric).toDecimalPlaces(2);
  }

  private readPayType(value: unknown): OrderPayType | undefined {
    return value === OrderPayTypeEnum.CREDIT ? OrderPayTypeEnum.CREDIT
      : value === OrderPayTypeEnum.CASH ? OrderPayTypeEnum.CASH
        : undefined;
  }

  private toImportJobStatus(status: PrismaImportJobStatusEnum): OrderImportJobStatus {
    switch (status) {
      case PrismaImportJobStatusEnum.PENDING:
        return OrderImportJobStatusEnum.PENDING;
      case PrismaImportJobStatusEnum.PROCESSING:
        return OrderImportJobStatusEnum.PROCESSING;
      case PrismaImportJobStatusEnum.COMPLETED:
        return OrderImportJobStatusEnum.COMPLETED;
      case PrismaImportJobStatusEnum.FAILED:
        return OrderImportJobStatusEnum.FAILED;
      default:
        return OrderImportJobStatusEnum.PENDING;
    }
  }

  private toPrismaImportConflictPolicy(
    conflictPolicy: (typeof OrderImportConflictPolicyEnum)[keyof typeof OrderImportConflictPolicyEnum],
  ): PrismaImportConflictPolicyEnum {
    return conflictPolicy === OrderImportConflictPolicyEnum.OVERWRITE
      ? PrismaImportConflictPolicyEnum.OVERWRITE
      : PrismaImportConflictPolicyEnum.SKIP;
  }

  private toImportConflictPolicy(
    conflictPolicy: PrismaImportConflictPolicyEnum,
  ): (typeof OrderImportConflictPolicyEnum)[keyof typeof OrderImportConflictPolicyEnum] {
    return conflictPolicy === PrismaImportConflictPolicyEnum.OVERWRITE
      ? OrderImportConflictPolicyEnum.OVERWRITE
      : OrderImportConflictPolicyEnum.SKIP;
  }

  private fromPrismaOrderStatus(status: PrismaOrderStatusEnum): OrderStatus {
    switch (status) {
      case PrismaOrderStatusEnum.PARTIAL:
        return OrderStatusEnum.PARTIAL;
      case PrismaOrderStatusEnum.PAID:
        return OrderStatusEnum.PAID;
      case PrismaOrderStatusEnum.EXPIRED:
        return OrderStatusEnum.EXPIRED;
      case PrismaOrderStatusEnum.CREDIT:
        return OrderStatusEnum.CREDIT;
      case PrismaOrderStatusEnum.PENDING:
      default:
        return OrderStatusEnum.PENDING;
    }
  }

  private toPrismaOrderPayType(payType: OrderPayType): PrismaOrderPayTypeEnum {
    return payType === OrderPayTypeEnum.CREDIT
      ? PrismaOrderPayTypeEnum.CREDIT
      : PrismaOrderPayTypeEnum.CASH;
  }

  private toDecimal(
    value: number,
    label: string,
    scale: number,
    allowZero = false,
  ): Decimal {
    if (!Number.isFinite(value)) {
      throw new BadRequestException(`${label} 必须是合法数字`);
    }

    const decimal = new Decimal(String(value)).toDecimalPlaces(scale);
    if (allowZero ? decimal.lt(0) : decimal.lte(0)) {
      throw new BadRequestException(`${label} 必须${allowZero ? '大于等于' : '大于'} 0`);
    }

    return decimal;
  }

  private toMoney(value: number, label: string, allowZero = false): Decimal {
    return this.toDecimal(value, label, 2, allowZero);
  }

  private toPrismaDecimal(value: Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value.toString());
  }

  private normalizeRequiredText(value: string, label: string, max: number): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${label} 不能为空`);
    }
    return this.cut(trimmed, max);
  }

  private cut(value: string, max: number): string {
    return value.length > max ? value.slice(0, max) : value;
  }

  private generateQrCodeToken(): string {
    return randomBytes(32).toString('hex');
  }

  private asPreviewSnapshot(value: Prisma.JsonValue | null): PreviewSnapshot | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as unknown as PreviewSnapshot)
      : null;
  }

  private getPreviewKey(previewId: string): string {
    return `import:preview:${previewId}`;
  }

  private getPreviewConsumeLockKey(previewId: string): string {
    return `import:preview:consume:${previewId}`;
  }

  private getImportJobLockKey(jobId: string): string {
    return `import:job:lock:${jobId}`;
  }

  private getTenantId(currentUser: JwtPayload): string {
    if (!currentUser.tenantId) {
      throw new ForbiddenException('当前登录态不属于租户侧，无法执行导入功能');
    }
    return currentUser.tenantId;
  }
}
