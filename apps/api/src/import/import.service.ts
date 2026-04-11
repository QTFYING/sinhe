import {
  BadRequestException,
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
  OrderImportPreviewRequest,
  OrderImportPreviewResponse,
  OrderImportPreviewRowError,
  OrderImportPreviewSummary,
  OrderImportSubmitRequest,
  OrderImportSubmitResponse,
  OrderImportTemplate,
  OrderLineItem,
  TenantOrderItem,
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
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { importConfig } from '../config/import.config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  resolveImportJobFinalStatus,
  shouldStartImportJobImmediately,
} from './import-job.worker.helpers';
import {
  buildImportOrderSummary,
  countMatchedImportFields,
  readImportColumn,
  resolveImportOrderStatus,
  resolveImportPayType,
} from './import.domain';
import { IMPORT_RUNTIME_MODE, type ImportRuntimeMode } from './import.constants';

const IMPORT_PREVIEW_TTL_SECONDS = 3600;
const IMPORT_JOB_POLL_INTERVAL_MS = 5000;
const IMPORT_JOB_LOCK_TTL_SECONDS = 1800;
const IMPORT_JOB_STALE_SECONDS = 120;
const DEFAULT_UNIT = '件';
const BUILTIN_KEYS = new Set([
  'sourceOrderNo',
  'groupKey',
  'customer',
  'summary',
  'amount',
  'paid',
  'status',
  'payType',
  'prints',
  'date',
  'creditDays',
  'skuId',
  'skuName',
  'skuSpec',
  'unit',
  'quantity',
  'unitPrice',
  'lineAmount',
]);

type TemplateField = OrderImportTemplate['fields'][number];
type TemplateMapping = OrderImportTemplate['mappings'][number];
type TemplateSourceColumn = OrderImportTemplate['sourceColumns'][number];

interface NormalizedImportOrder extends TenantOrderItem {
  creditDays?: number;
  rowNumbers: number[];
}

interface PreviewSnapshot {
  tenantId: string;
  templateId?: string;
  matchedFieldCount?: number;
  requiredFieldMissing: string[];
  summary: OrderImportPreviewSummary;
  aggregatedOrders: NormalizedImportOrder[];
  duplicateOrders: OrderImportDuplicateOrder[];
  invalidRows: OrderImportPreviewRowError[];
}

interface ImportJobProgress {
  processedCount: number;
  successCount: number;
  skippedCount: number;
  overwrittenCount: number;
  failedRows: OrderImportJobFailure[];
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

  async getImportTemplates(currentUser: JwtPayload): Promise<OrderImportTemplate[]> {
    const tenantId = this.getTenantId(currentUser);
    const templates = await this.prisma.importTemplate.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return templates.map((item) => this.toTemplate(item));
  }

  async createImportTemplate(
    currentUser: JwtPayload,
    request: CreateOrderImportTemplateRequest,
  ): Promise<OrderImportTemplate> {
    const tenantId = this.getTenantId(currentUser);
    this.validateTemplate(request);

    const created = await this.prisma.$transaction(async (tx) => {
      if (request.isDefault) {
        await tx.importTemplate.updateMany({
          where: { tenantId, deletedAt: null },
          data: { isDefault: false },
        });
      }

      return tx.importTemplate.create({
        data: {
          tenantId,
          name: request.name.trim(),
          isDefault: request.isDefault,
          sourceColumns: request.sourceColumns as unknown as Prisma.InputJsonValue,
          fields: request.fields as unknown as Prisma.InputJsonValue,
          mappings: request.mappings as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.toTemplate(created);
  }

  async updateImportTemplate(
    currentUser: JwtPayload,
    templateId: string,
    request: UpdateOrderImportTemplateRequest,
  ): Promise<OrderImportTemplate> {
    const tenantId = this.getTenantId(currentUser);
    const existing = await this.getScopedTemplate(tenantId, templateId);

    const payload: CreateOrderImportTemplateRequest = {
      name: request.name?.trim() || existing.name,
      isDefault: request.isDefault ?? existing.isDefault,
      sourceColumns: request.sourceColumns ?? this.asSourceColumns(existing.sourceColumns),
      fields: request.fields ?? this.asFields(existing.fields),
      mappings: request.mappings ?? this.asMappings(existing.mappings),
    };
    this.validateTemplate(payload);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.importTemplate.updateMany({
          where: { tenantId, deletedAt: null, id: { not: templateId } },
          data: { isDefault: false },
        });
      }

      return tx.importTemplate.update({
        where: { id: templateId },
        data: {
          name: payload.name,
          isDefault: payload.isDefault,
          sourceColumns: payload.sourceColumns as unknown as Prisma.InputJsonValue,
          fields: payload.fields as unknown as Prisma.InputJsonValue,
          mappings: payload.mappings as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.toTemplate(updated);
  }

  async previewImport(
    currentUser: JwtPayload,
    request: OrderImportPreviewRequest,
  ): Promise<OrderImportPreviewResponse> {
    const tenantId = this.getTenantId(currentUser);
    const snapshot = await this.buildPreviewSnapshot(tenantId, request);
    const previewId = randomUUID();

    await this.redis.setJson(this.getPreviewKey(previewId), snapshot, IMPORT_PREVIEW_TTL_SECONDS);

    return {
      previewId,
      templateId: snapshot.templateId,
      matchedFieldCount: snapshot.matchedFieldCount,
      requiredFieldMissing: snapshot.requiredFieldMissing,
      summary: snapshot.summary,
      aggregatedOrders: snapshot.aggregatedOrders.map((item) => this.toTenantOrder(item)),
      duplicateOrders: snapshot.duplicateOrders,
      invalidRows: snapshot.invalidRows,
    };
  }

  async submitOrderImport(
    currentUser: JwtPayload,
    request: OrderImportSubmitRequest,
  ): Promise<OrderImportSubmitResponse> {
    const tenantId = this.getTenantId(currentUser);
    const snapshot = request.previewId
      ? await this.readPreviewSnapshot(tenantId, request.previewId)
      : await this.buildPreviewSnapshot(tenantId, {
          templateId: request.templateId,
          rows: request.rows ?? [],
        });

    if (snapshot.requiredFieldMissing.length > 0 || snapshot.invalidRows.length > 0) {
      throw new BadRequestException('导入数据未通过预检，请先修正映射或行数据错误');
    }

    if (snapshot.aggregatedOrders.length === 0) {
      throw new BadRequestException('没有可导入的有效订单');
    }

    const conflictPolicy = request.conflictPolicy ?? OrderImportConflictPolicyEnum.SKIP;
    const job = await this.prisma.importJob.create({
      data: {
        tenantId,
        status: PrismaImportJobStatusEnum.PENDING,
        conflictPolicy: this.toPrismaImportConflictPolicy(conflictPolicy),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        submittedCount: snapshot.aggregatedOrders.length,
        processedCount: 0,
        successCount: 0,
        skippedCount: 0,
        overwrittenCount: 0,
        failedCount: 0,
        failedRows: [],
        conflictDetails: [],
      },
    });

    if (
      shouldStartImportJobImmediately({
        IMPORT_JOB_WORKER_ENABLED: String(this.importSettings.workerEnabled),
      })
    ) {
      this.enqueueImportJob(job.id);
    }

    return {
      jobId: job.id,
      submittedCount: job.submittedCount,
      status: this.toImportJobStatus(job.status),
    };
  }

  async getImportJob(currentUser: JwtPayload, jobId: string): Promise<OrderImportJobResponse> {
    const tenantId = this.getTenantId(currentUser);
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, tenantId },
    });

    if (!job) {
      throw new NotFoundException('未找到对应的导入任务');
    }

    return {
      jobId: job.id,
      status: this.toImportJobStatus(job.status),
      submittedCount: job.submittedCount,
      processedCount: job.processedCount,
      successCount: job.successCount,
      skippedCount: job.skippedCount,
      overwrittenCount: job.overwrittenCount,
      failedCount: job.failedCount,
      failedRows: this.asJobFailures(job.failedRows),
      conflictDetails: this.asConflictDetails(job.conflictDetails),
      completedAt: job.completedAt?.toISOString(),
    };
  }

  private async buildPreviewSnapshot(
    tenantId: string,
    request: OrderImportPreviewRequest,
  ): Promise<PreviewSnapshot> {
    if (!request.rows?.length) {
      throw new BadRequestException('导入预检至少需要一行原始数据');
    }

    const resolved = await this.resolveTemplate(tenantId, request.templateId, request.rows);
    if (!resolved.template) {
      const invalidRows = request.rows.map((_, index) => ({
        row: index + 1,
        reason: '未命中可用的导入模板，请先选择模板',
      }));
      return {
        tenantId,
        requiredFieldMissing: [],
        summary: {
          totalRows: request.rows.length,
          validRows: 0,
          invalidRows: request.rows.length,
          aggregatedOrderCount: 0,
          duplicateOrderCount: 0,
          errorCount: invalidRows.length,
        },
        aggregatedOrders: [],
        duplicateOrders: [],
        invalidRows,
      };
    }

    const template = resolved.template;
    const requiredFieldMissing = template.fields
      .filter((field) => field.required)
      .filter((field) => !template.mappings.some((mapping) => mapping.targetField === field.key))
      .map((field) => field.key);

    const invalidRows: OrderImportPreviewRowError[] = [];
    const invalidRowNumbers = new Set<number>();
    const aggregates = new Map<string, NormalizedImportOrder>();

    request.rows.forEach((row, index) => {
      const rowNumber = index + 1;
      const values = this.extractValues(row, template.mappings);
      const sourceOrderNo = this.readString(values.sourceOrderNo);
      const customer = this.readString(values.customer);

      template.fields
        .filter((field) => field.required && !this.hasValue(values[field.key]))
        .forEach((field) => {
          invalidRows.push({
            row: rowNumber,
            field: field.key,
            sourceOrderNo,
            reason: `字段 ${field.key} 为必填项`,
          });
          invalidRowNumbers.add(rowNumber);
        });
      if (invalidRowNumbers.has(rowNumber)) return;

      if (!sourceOrderNo) {
        invalidRows.push({ row: rowNumber, field: 'sourceOrderNo', reason: '缺少 sourceOrderNo' });
        invalidRowNumbers.add(rowNumber);
        return;
      }
      if (!customer) {
        invalidRows.push({ row: rowNumber, field: 'customer', sourceOrderNo, reason: '缺少 customer' });
        invalidRowNumbers.add(rowNumber);
        return;
      }

      const lineItem = this.buildLineItem(values, rowNumber, sourceOrderNo);
      if (!lineItem.ok) {
        invalidRows.push(lineItem.error);
        invalidRowNumbers.add(rowNumber);
        return;
      }

      this.mergePreviewRow(aggregates, {
        rowNumber,
        sourceOrderNo,
        customer,
        values,
        fields: template.fields,
        templateId: template.id,
        lineItem: lineItem.value,
      });
    });

    const aggregatedOrders = Array.from(aggregates.values()).filter((order) => {
      if (order.amount <= 0) {
        order.amount = this.round(order.lineItems.reduce((sum, item) => sum + item.lineAmount, 0));
      }
      if (!order.summary) order.summary = buildImportOrderSummary(order.lineItems);
      order.status = resolveImportOrderStatus(order.status, order.payType, order.paid, order.amount);

      if (order.amount <= 0) {
        order.rowNumbers.forEach((row) => {
          invalidRows.push({ row, sourceOrderNo: order.sourceOrderNo, reason: '订单金额必须大于 0' });
          invalidRowNumbers.add(row);
        });
        return false;
      }
      return true;
    });

    const existingMap = await this.loadExistingOrderMap(
      tenantId,
      aggregatedOrders.map((item) => item.sourceOrderNo).filter((item): item is string => Boolean(item)),
    );
    const duplicateOrders = aggregatedOrders
      .filter((item) => item.sourceOrderNo && existingMap.has(item.sourceOrderNo))
      .map((item) => ({
        sourceOrderNo: item.sourceOrderNo as string,
        existingOrderId: existingMap.get(item.sourceOrderNo as string),
        incomingRowCount: item.rowNumbers.length,
      }));

    return {
      tenantId,
      templateId: template.id,
      matchedFieldCount: resolved.matchedFieldCount,
      requiredFieldMissing,
      summary: {
        totalRows: request.rows.length,
        validRows: request.rows.length - invalidRowNumbers.size,
        invalidRows: invalidRowNumbers.size,
        aggregatedOrderCount: aggregatedOrders.length,
        duplicateOrderCount: duplicateOrders.length,
        errorCount: invalidRows.length,
      },
      aggregatedOrders,
      duplicateOrders,
      invalidRows,
    };
  }

  private mergePreviewRow(
    aggregates: Map<string, NormalizedImportOrder>,
    input: {
      rowNumber: number;
      sourceOrderNo: string;
      customer: string;
      values: Record<string, unknown>;
      fields: TemplateField[];
      templateId: string;
      lineItem: OrderLineItem;
    },
  ): void {
    const amount = this.readMoney(input.values.amount) ?? 0;
    const paid = this.readMoney(input.values.paid) ?? 0;
    const creditDays = this.readInt(input.values.creditDays);
    const payType = resolveImportPayType(this.readString(input.values.payType), creditDays);
    const status = resolveImportOrderStatus(
      this.readString(input.values.status),
      payType,
      paid,
      amount || input.lineItem.lineAmount,
    );
    const summary = this.readString(input.values.summary) ?? '';
    const date = (this.readDate(input.values.date) ?? new Date()).toISOString();
    const customFieldValues = this.extractCustomValues(input.values, input.fields);

    const aggregate = aggregates.get(input.sourceOrderNo);
    if (!aggregate) {
      aggregates.set(input.sourceOrderNo, {
        id: randomUUID(),
        sourceOrderNo: input.sourceOrderNo,
        groupKey: this.readString(input.values.groupKey) ?? input.sourceOrderNo,
        mappingTemplateId: input.templateId,
        customer: input.customer,
        summary,
        amount,
        paid,
        status,
        payType,
        prints: this.readInt(input.values.prints) ?? 0,
        date,
        lineItems: [input.lineItem],
        customFieldValues: Object.keys(customFieldValues).length ? customFieldValues : undefined,
        voided: false,
        creditDays: creditDays ?? undefined,
        rowNumbers: [input.rowNumber],
      });
      return;
    }

    aggregate.lineItems.push(input.lineItem);
    aggregate.rowNumbers.push(input.rowNumber);
    aggregate.amount = Math.max(aggregate.amount, amount);
    aggregate.paid = Math.max(aggregate.paid, paid);
    aggregate.prints = Math.max(aggregate.prints, this.readInt(input.values.prints) ?? 0);
    if (!aggregate.summary && summary) aggregate.summary = summary;
    if (!aggregate.customFieldValues && Object.keys(customFieldValues).length) {
      aggregate.customFieldValues = customFieldValues;
    }
    if (!aggregate.creditDays && creditDays) aggregate.creditDays = creditDays;
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
      if (!job || job.status === PrismaImportJobStatusEnum.COMPLETED || job.status === PrismaImportJobStatusEnum.FAILED) {
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

    for (let index = progress.processedCount; index < snapshot.aggregatedOrders.length; index += 1) {
      const order = snapshot.aggregatedOrders[index];

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
    order: NormalizedImportOrder,
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

    await client.order.create({ data: this.toOrderCreateInput(tenantId, order) });
    return { type: 'created' };
  }

  private nextProgressForOutcome(
    current: ImportJobProgress,
    order: NormalizedImportOrder,
    outcome: ImportOrderOutcome,
  ): ImportJobProgress {
    const next: ImportJobProgress = {
      processedCount: current.processedCount + 1,
      successCount: current.successCount,
      skippedCount: current.skippedCount,
      overwrittenCount: current.overwrittenCount,
      failedRows: [...current.failedRows],
      conflictDetails: [...current.conflictDetails],
    };

    if (outcome.type === 'created') {
      next.successCount += 1;
      return next;
    }

    if (!order.sourceOrderNo) {
      throw new BadRequestException('重复订单处理缺少 sourceOrderNo');
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
    order: NormalizedImportOrder,
    error: unknown,
  ): ImportJobProgress {
    return {
      processedCount: current.processedCount + 1,
      successCount: current.successCount,
      skippedCount: current.skippedCount,
      overwrittenCount: current.overwrittenCount,
      failedRows: [
        ...current.failedRows,
        {
          row: order.rowNumbers[0] ?? 0,
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
    failedRows: Prisma.JsonValue | null;
    conflictDetails: Prisma.JsonValue | null;
  }): ImportJobProgress {
    return {
      processedCount: job.processedCount,
      successCount: job.successCount,
      skippedCount: job.skippedCount,
      overwrittenCount: job.overwrittenCount,
      failedRows: this.asJobFailures(job.failedRows),
      conflictDetails: this.asConflictDetails(job.conflictDetails),
    };
  }

  private toImportJobProgressUpdate(progress: ImportJobProgress): Prisma.ImportJobUpdateInput {
    return {
      processedCount: progress.processedCount,
      successCount: progress.successCount,
      skippedCount: progress.skippedCount,
      overwrittenCount: progress.overwrittenCount,
      failedCount: progress.failedRows.length,
      failedRows: progress.failedRows as unknown as Prisma.InputJsonValue,
      conflictDetails: progress.conflictDetails as unknown as Prisma.InputJsonValue,
      heartbeatAt: new Date(),
    };
  }

  private resolveFinalImportJobStatus(progress: ImportJobProgress): PrismaImportJobStatusEnum {
    return resolveImportJobFinalStatus({
      successCount: progress.successCount,
      skippedCount: progress.skippedCount,
      overwrittenCount: progress.overwrittenCount,
      failedCount: progress.failedRows.length,
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

  private toOrderCreateInput(tenantId: string, order: NormalizedImportOrder): Prisma.OrderCreateInput {
    return {
      tenant: { connect: { id: tenantId } },
      sourceOrderNo: order.sourceOrderNo,
      groupKey: order.groupKey,
      mappingTemplate: order.mappingTemplateId
        ? { connect: { id: order.mappingTemplateId } }
        : undefined,
      qrCodeToken: this.generateQrCodeToken(),
      customer: this.cut(order.customer, 100),
      summary: this.cut(order.summary, 255),
      amount: order.amount,
      paid: order.paid,
      customFieldValues: order.customFieldValues
        ? (order.customFieldValues as unknown as Prisma.InputJsonValue)
        : undefined,
      status: this.toPrismaOrderStatus(order.status),
      payType: this.toPrismaOrderPayType(order.payType),
      prints: order.prints,
      creditDays: order.creditDays,
      creditDueDate: this.toCreditDueDate(order.date, order.creditDays),
      date: new Date(order.date),
      voided: order.voided,
      voidReason: order.voidReason,
      voidedAt: order.voidedAt ? new Date(order.voidedAt) : undefined,
      lineItems: { create: order.lineItems.map((item) => this.toLineItemInput(item)) },
    };
  }

  private toOrderUpdateInput(order: NormalizedImportOrder): Prisma.OrderUpdateInput {
    return {
      groupKey: order.groupKey,
      mappingTemplate: order.mappingTemplateId
        ? { connect: { id: order.mappingTemplateId } }
        : { disconnect: true },
      customer: this.cut(order.customer, 100),
      summary: this.cut(order.summary, 255),
      amount: order.amount,
      paid: order.paid,
      customFieldValues: order.customFieldValues
        ? (order.customFieldValues as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      status: this.toPrismaOrderStatus(order.status),
      payType: this.toPrismaOrderPayType(order.payType),
      creditDays: order.creditDays,
      creditDueDate: this.toCreditDueDate(order.date, order.creditDays),
      date: new Date(order.date),
      lineItems: {
        deleteMany: {},
        create: order.lineItems.map((item) => this.toLineItemInput(item)),
      },
    };
  }

  private toLineItemInput(item: OrderLineItem) {
    return {
      skuId: item.skuId ?? null,
      skuName: this.cut(item.skuName, 200),
      skuSpec: item.skuSpec ? this.cut(item.skuSpec, 100) : undefined,
      unit: this.cut(item.unit, 20),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineAmount: item.lineAmount,
    };
  }

  private buildLineItem(values: Record<string, unknown>, row: number, sourceOrderNo: string) {
    const summary = this.readString(values.summary);
    const skuName = this.readString(values.skuName) ?? summary;
    if (!skuName) {
      return {
        ok: false as const,
        error: { row, field: 'skuName', sourceOrderNo, reason: '缺少 skuName' },
      };
    }

    const quantity = this.readNumber(values.quantity) ?? 1;
    const unit = this.readString(values.unit) ?? DEFAULT_UNIT;
    const unitPrice = this.readMoney(values.unitPrice);
    const lineAmount =
      this.readMoney(values.lineAmount) ??
      (unitPrice !== undefined ? this.round(quantity * unitPrice) : undefined);

    if (lineAmount === undefined) {
      return {
        ok: false as const,
        error: { row, field: 'lineAmount', sourceOrderNo, reason: '缺少 lineAmount 或 unitPrice' },
      };
    }

    return {
      ok: true as const,
      value: {
        skuId: this.readString(values.skuId) ?? undefined,
        skuName,
        skuSpec: this.readString(values.skuSpec) ?? undefined,
        unit,
        quantity,
        unitPrice: unitPrice ?? (quantity === 0 ? 0 : this.round(lineAmount / quantity)),
        lineAmount,
      },
    };
  }

  private extractValues(row: Record<string, unknown>, mappings: TemplateMapping[]): Record<string, unknown> {
    return mappings.reduce<Record<string, unknown>>((acc, mapping) => {
      acc[mapping.targetField] = readImportColumn(row, mapping.sourceColumn);
      return acc;
    }, {});
  }

  private extractCustomValues(values: Record<string, unknown>, fields: TemplateField[]): Record<string, string> {
    return fields.reduce<Record<string, string>>((acc, field) => {
      if (field.builtin || BUILTIN_KEYS.has(field.key)) return acc;
      const value = values[field.key];
      if (this.hasValue(value)) acc[field.key] = String(value).trim();
      return acc;
    }, {});
  }

  private async resolveTemplate(
    tenantId: string,
    templateId: string | undefined,
    rows: Array<Record<string, unknown>>,
  ): Promise<{ template?: OrderImportTemplate; matchedFieldCount?: number }> {
    if (templateId) {
      const template = this.toTemplate(await this.getScopedTemplate(tenantId, templateId));
      return { template, matchedFieldCount: countMatchedImportFields(rows, template.mappings) };
    }

    const templates = await this.prisma.importTemplate.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    let bestTemplate: OrderImportTemplate | undefined;
    let bestScore = 0;
    for (const item of templates) {
      const template = this.toTemplate(item);
      const score = countMatchedImportFields(rows, template.mappings);
      if (score > bestScore) {
        bestTemplate = template;
        bestScore = score;
      }
    }

    return { template: bestTemplate, matchedFieldCount: bestScore || undefined };
  }

  private async loadExistingOrderMap(tenantId: string, sourceOrderNos: string[]): Promise<Map<string, string>> {
    if (sourceOrderNos.length === 0) return new Map();
    const existing = await this.prisma.order.findMany({
      where: { tenantId, sourceOrderNo: { in: sourceOrderNos } },
      select: { id: true, sourceOrderNo: true },
    });

    return new Map(
      existing
        .filter((item): item is { id: string; sourceOrderNo: string } => Boolean(item.sourceOrderNo))
        .map((item) => [item.sourceOrderNo, item.id]),
    );
  }

  private async readPreviewSnapshot(tenantId: string, previewId: string): Promise<PreviewSnapshot> {
    const snapshot = await this.redis.getJson<PreviewSnapshot>(this.getPreviewKey(previewId));
    if (!snapshot) throw new BadRequestException('预检结果不存在或已过期');
    if (snapshot.tenantId !== tenantId) throw new ForbiddenException('无权使用该预检结果');
    return snapshot;
  }

  private async findExistingOrder(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    sourceOrderNo?: string,
  ) {
    if (!sourceOrderNo) return null;
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

  private async getScopedTemplate(tenantId: string, templateId: string) {
    const template = await this.prisma.importTemplate.findFirst({
      where: { id: templateId, tenantId, deletedAt: null },
    });
    if (!template) throw new NotFoundException('未找到对应的导入模板');
    return template;
  }

  private validateTemplate(payload: CreateOrderImportTemplateRequest): void {
    this.ensureNoDuplicate(payload.fields.map((item) => item.key), '字段 key');
    this.ensureNoDuplicate(payload.sourceColumns.map((item) => item.key), '列 key');
    this.ensureNoDuplicate(payload.mappings.map((item) => item.targetField), '目标字段映射');
    const fieldKeys = new Set(payload.fields.map((item) => item.key));
    const invalidMapping = payload.mappings.find((item) => !fieldKeys.has(item.targetField));
    if (invalidMapping) {
      throw new BadRequestException(`映射目标字段不存在：${invalidMapping.targetField}`);
    }
  }

  private ensureNoDuplicate(values: string[], label: string): void {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) throw new BadRequestException(`${label}重复：${value}`);
      seen.add(value);
    }
  }

  private toTemplate(template: {
    id: string;
    name: string;
    isDefault: boolean;
    updatedAt: Date;
    sourceColumns: Prisma.JsonValue;
    fields: Prisma.JsonValue;
    mappings: Prisma.JsonValue;
  }): OrderImportTemplate {
    return {
      id: template.id,
      name: template.name,
      isDefault: template.isDefault,
      updatedAt: template.updatedAt.toISOString(),
      sourceColumns: this.asSourceColumns(template.sourceColumns),
      fields: this.asFields(template.fields),
      mappings: this.asMappings(template.mappings),
    };
  }

  private toTenantOrder(order: NormalizedImportOrder): TenantOrderItem {
    return {
      id: order.id,
      sourceOrderNo: order.sourceOrderNo,
      groupKey: order.groupKey,
      mappingTemplateId: order.mappingTemplateId,
      customer: order.customer,
      summary: order.summary,
      amount: order.amount,
      paid: order.paid,
      status: order.status,
      payType: order.payType,
      prints: order.prints,
      date: order.date,
      lineItems: order.lineItems,
      customFieldValues: order.customFieldValues,
      voided: order.voided,
      voidReason: order.voidReason,
      voidedAt: order.voidedAt,
    };
  }

  private asSourceColumns(value: Prisma.JsonValue): TemplateSourceColumn[] {
    return Array.isArray(value) ? (value as unknown as TemplateSourceColumn[]) : [];
  }

  private asFields(value: Prisma.JsonValue): TemplateField[] {
    return Array.isArray(value) ? (value as unknown as TemplateField[]) : [];
  }

  private asMappings(value: Prisma.JsonValue): TemplateMapping[] {
    return Array.isArray(value) ? (value as unknown as TemplateMapping[]) : [];
  }

  private asJobFailures(value: Prisma.JsonValue | null): OrderImportJobFailure[] {
    return Array.isArray(value) ? (value as unknown as OrderImportJobFailure[]) : [];
  }

  private asConflictDetails(value: Prisma.JsonValue | null): OrderImportJobConflictDetail[] {
    return Array.isArray(value) ? (value as unknown as OrderImportJobConflictDetail[]) : [];
  }

  private hasValue(value: unknown): boolean {
    return value !== null && value !== undefined && (typeof value !== 'string' || value.trim().length > 0);
  }

  private readString(value: unknown): string | undefined {
    return this.hasValue(value) ? String(value).trim() : undefined;
  }

  private readNumber(value: unknown): number | undefined {
    if (!this.hasValue(value)) return undefined;
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
    return Number.isNaN(numeric) ? undefined : numeric;
  }

  private readInt(value: unknown): number | undefined {
    const numeric = this.readNumber(value);
    return numeric === undefined ? undefined : Math.trunc(numeric);
  }

  private readMoney(value: unknown): number | undefined {
    const numeric = this.readNumber(value);
    return numeric === undefined ? undefined : this.round(numeric);
  }

  private readDate(value: unknown): Date | undefined {
    if (!this.hasValue(value)) return undefined;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
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
    switch (conflictPolicy) {
      case OrderImportConflictPolicyEnum.OVERWRITE:
        return PrismaImportConflictPolicyEnum.OVERWRITE;
      case OrderImportConflictPolicyEnum.SKIP:
      default:
        return PrismaImportConflictPolicyEnum.SKIP;
    }
  }

  private toImportConflictPolicy(
    conflictPolicy: PrismaImportConflictPolicyEnum,
  ): (typeof OrderImportConflictPolicyEnum)[keyof typeof OrderImportConflictPolicyEnum] {
    switch (conflictPolicy) {
      case PrismaImportConflictPolicyEnum.OVERWRITE:
        return OrderImportConflictPolicyEnum.OVERWRITE;
      case PrismaImportConflictPolicyEnum.SKIP:
      default:
        return OrderImportConflictPolicyEnum.SKIP;
    }
  }

  private toPrismaOrderStatus(status: OrderStatus): PrismaOrderStatusEnum {
    switch (status) {
      case OrderStatusEnum.PENDING:
        return PrismaOrderStatusEnum.PENDING;
      case OrderStatusEnum.PARTIAL:
        return PrismaOrderStatusEnum.PARTIAL;
      case OrderStatusEnum.PAID:
        return PrismaOrderStatusEnum.PAID;
      case OrderStatusEnum.EXPIRED:
        return PrismaOrderStatusEnum.EXPIRED;
      case OrderStatusEnum.CREDIT:
        return PrismaOrderStatusEnum.CREDIT;
      default:
        return PrismaOrderStatusEnum.PENDING;
    }
  }

  private toPrismaOrderPayType(payType: OrderPayType): PrismaOrderPayTypeEnum {
    switch (payType) {
      case OrderPayTypeEnum.CREDIT:
        return PrismaOrderPayTypeEnum.CREDIT;
      case OrderPayTypeEnum.CASH:
      default:
        return PrismaOrderPayTypeEnum.CASH;
    }
  }

  private toCreditDueDate(date: string, creditDays?: number): Date | undefined {
    if (!creditDays || creditDays <= 0) return undefined;
    const base = new Date(date);
    if (Number.isNaN(base.getTime())) return undefined;
    base.setDate(base.getDate() + creditDays);
    return base;
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
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
