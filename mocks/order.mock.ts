import {
  OrderImportConflictPolicy,
  OrderImportJobStatus,
  OrderStatus,
  OrderTemplateFieldType,
  PayType,
} from '@sinhe/shared/contracts'
import type {
  MarkOrderReceivedPayload,
  Order,
  OrderImportJobResult,
  OrderImportPreviewPayload,
  OrderImportPreviewResult,
  OrderImportSubmitPayload,
  OrderImportTemplate,
  OrderRemindPayload,
} from '@sinhe/shared/types'
import { defineMock } from 'vite-plugin-mock-dev-server'

const DEFAULT_PAGE_SIZE = 20

const templates: OrderImportTemplate[] = [
  {
    id: 'tpl-a6',
    name: 'A6 标准模板',
    isDefault: true,
    updatedAt: '2026-04-08 09:30:00',
    sourceColumns: [
      { key: 'sourceOrderNo', title: '单据编号', index: 0, sampleValue: 'A6-20260408-001' },
      { key: 'customer', title: '客户名称', index: 1, sampleValue: '幸福超市' },
      { key: 'date', title: '下单日期', index: 2, sampleValue: '2026-04-08' },
      { key: 'skuName', title: '商品名称', index: 3, sampleValue: '青岛啤酒' },
      { key: 'goodsNum', title: '商品数量', index: 4, sampleValue: '24' },
      { key: 'unitPrice', title: '单价', index: 5, sampleValue: '65' },
      { key: 'amount', title: '合计金额', index: 6, sampleValue: '1560' },
      { key: 'payType', title: '付款方式', index: 7, sampleValue: '现款' },
      { key: 'receiverPhone', title: '收货电话', index: 8, sampleValue: '13800000001' },
    ],
    mappings: [
      { sourceColumn: '单据编号', targetField: 'sourceOrderNo', sampleValue: 'A6-20260408-001' },
      { sourceColumn: '客户名称', targetField: 'customer', sampleValue: '幸福超市' },
      { sourceColumn: '下单日期', targetField: 'date', sampleValue: '2026-04-08' },
      { sourceColumn: '商品名称', targetField: 'skuName', sampleValue: '青岛啤酒' },
      { sourceColumn: '商品数量', targetField: 'goodsNum', sampleValue: '24' },
      { sourceColumn: '单价', targetField: 'unitPrice', sampleValue: '65' },
      { sourceColumn: '合计金额', targetField: 'amount', sampleValue: '1560' },
      { sourceColumn: '付款方式', targetField: 'payType', sampleValue: '现款' },
      { sourceColumn: '收货电话', targetField: 'receiverPhone', sampleValue: '13800000001' },
    ],
    fields: [
      {
        key: 'sourceOrderNo',
        label: '源订单号',
        fieldType: OrderTemplateFieldType.TEXT,
        required: true,
        visible: true,
        order: 1,
        builtin: true,
      },
      {
        key: 'customer',
        label: '客户名称',
        fieldType: OrderTemplateFieldType.TEXT,
        required: true,
        visible: true,
        order: 2,
        builtin: true,
      },
      {
        key: 'amount',
        label: '订单金额',
        fieldType: OrderTemplateFieldType.MONEY,
        required: true,
        visible: true,
        order: 3,
        builtin: true,
      },
      {
        key: 'goodsNum',
        label: '商品数量',
        fieldType: OrderTemplateFieldType.NUMBER,
        required: false,
        visible: true,
        order: 4,
      },
      {
        key: 'receiverPhone',
        label: '收货电话',
        fieldType: OrderTemplateFieldType.TEXT,
        required: false,
        visible: true,
        order: 5,
      },
    ],
  },
  {
    id: 'tpl-zhoupu',
    name: '舟谱模板',
    updatedAt: '2026-04-07 18:20:00',
    sourceColumns: [
      { key: 'sourceOrderNo', title: '订单编号', index: 0, sampleValue: 'ZP-20260408-002' },
      { key: 'customer', title: '门店名称', index: 1, sampleValue: '好再来餐饮' },
      { key: 'date', title: '下单时间', index: 2, sampleValue: '2026-04-08' },
      { key: 'skuName', title: '商品', index: 3, sampleValue: '五粮液' },
      { key: 'goodsNum', title: '件数', index: 4, sampleValue: '2' },
      { key: 'amount', title: '总金额', index: 5, sampleValue: '4800' },
      { key: 'receiverName', title: '收货人', index: 6, sampleValue: '李老板' },
    ],
    mappings: [
      { sourceColumn: '订单编号', targetField: 'sourceOrderNo', sampleValue: 'ZP-20260408-002' },
      { sourceColumn: '门店名称', targetField: 'customer', sampleValue: '好再来餐饮' },
      { sourceColumn: '下单时间', targetField: 'date', sampleValue: '2026-04-08' },
      { sourceColumn: '商品', targetField: 'skuName', sampleValue: '五粮液' },
      { sourceColumn: '件数', targetField: 'goodsNum', sampleValue: '2' },
      { sourceColumn: '总金额', targetField: 'amount', sampleValue: '4800' },
      { sourceColumn: '收货人', targetField: 'receiverName', sampleValue: '李老板' },
    ],
    fields: [
      {
        key: 'sourceOrderNo',
        label: 'ERP 单号',
        fieldType: OrderTemplateFieldType.TEXT,
        required: true,
        visible: true,
        order: 1,
        builtin: true,
      },
      {
        key: 'goodsNum',
        label: '件数',
        fieldType: OrderTemplateFieldType.NUMBER,
        required: false,
        visible: true,
        order: 2,
      },
      {
        key: 'receiverName',
        label: '收货人',
        fieldType: OrderTemplateFieldType.TEXT,
        required: false,
        visible: true,
        order: 3,
      },
    ],
  },
]

const orders: Order[] = [
  {
    id: 'PLT-20260408-001',
    sourceOrderNo: 'A6-20260408-001',
    groupKey: 'A6-20260408-001',
    sourcePlatform: 'A6 ERP',
    mappingTemplateId: 'tpl-a6',
    importBatchId: 'IMP-20260408-001',
    importedAt: '2026-04-08 09:35:00',
    customer: '幸福超市',
    summary: '青岛啤酒×24等3件',
    amount: 1560,
    paid: 1560,
    status: OrderStatus.PAID,
    payType: PayType.CASH,
    prints: 1,
    date: '2026-04-08 09:12',
    voided: false,
    customFieldValues: {
      goodsNum: 3,
      receiverPhone: '13800000001',
    },
    lineItems: [
      {
        lineId: 'LINE-001',
        sourceLineNo: '1',
        sourceOrderNo: 'A6-20260408-001',
        skuCode: 'BEER-001',
        skuName: '青岛啤酒',
        skuSpec: '500ml × 12',
        unit: '箱',
        quantity: 2,
        unitPrice: 480,
        lineAmount: 960,
      },
      {
        lineId: 'LINE-002',
        sourceLineNo: '2',
        sourceOrderNo: 'A6-20260408-001',
        skuCode: 'DRINK-002',
        skuName: '可口可乐',
        skuSpec: '330ml × 24',
        unit: '件',
        quantity: 1,
        unitPrice: 300,
        lineAmount: 300,
      },
      {
        lineId: 'LINE-003',
        sourceLineNo: '3',
        sourceOrderNo: 'A6-20260408-001',
        skuCode: 'SNACK-003',
        skuName: '薯片',
        skuSpec: '70g',
        unit: '盒',
        quantity: 10,
        unitPrice: 30,
        lineAmount: 300,
      },
    ],
  },
  {
    id: 'PLT-20260408-002',
    sourceOrderNo: 'ZP-20260408-002',
    groupKey: 'ZP-20260408-002',
    sourcePlatform: '舟谱',
    mappingTemplateId: 'tpl-zhoupu',
    importBatchId: 'IMP-20260408-001',
    importedAt: '2026-04-08 09:36:00',
    customer: '好再来餐饮',
    summary: '五粮液×2等2件',
    amount: 4800,
    paid: 0,
    status: OrderStatus.PENDING,
    payType: PayType.CASH,
    prints: 1,
    date: '2026-04-08 09:30',
    voided: false,
    customFieldValues: {
      goodsNum: 2,
      receiverName: '李老板',
    },
    lineItems: [
      {
        lineId: 'LINE-011',
        sourceLineNo: '1',
        sourceOrderNo: 'ZP-20260408-002',
        skuCode: 'WLY-001',
        skuName: '五粮液',
        skuSpec: '52度 / 500ml',
        unit: '箱',
        quantity: 2,
        unitPrice: 1880,
        lineAmount: 3760,
      },
      {
        lineId: 'LINE-012',
        sourceLineNo: '2',
        sourceOrderNo: 'ZP-20260408-002',
        skuCode: 'WATER-001',
        skuName: '矿泉水',
        skuSpec: '550ml × 24',
        unit: '件',
        quantity: 2,
        unitPrice: 520,
        lineAmount: 1040,
      },
    ],
  },
  {
    id: 'PLT-20260408-003',
    sourceOrderNo: 'A6-20260408-003',
    groupKey: 'A6-20260408-003',
    sourcePlatform: 'A6 ERP',
    mappingTemplateId: 'tpl-a6',
    importBatchId: 'IMP-20260408-002',
    importedAt: '2026-04-08 10:05:00',
    customer: '张三超市',
    summary: '可乐×48等2件',
    amount: 1200,
    paid: 800,
    status: OrderStatus.PARTIAL,
    payType: PayType.CASH,
    prints: 2,
    date: '2026-04-08 08:55',
    voided: false,
    customFieldValues: {
      goodsNum: 2,
      receiverPhone: '13800000003',
    },
    lineItems: [
      {
        lineId: 'LINE-021',
        sourceLineNo: '1',
        sourceOrderNo: 'A6-20260408-003',
        skuName: '可口可乐',
        skuSpec: '330ml × 24',
        unit: '件',
        quantity: 2,
        unitPrice: 300,
        lineAmount: 600,
      },
      {
        lineId: 'LINE-022',
        sourceLineNo: '2',
        sourceOrderNo: 'A6-20260408-003',
        skuName: '雪碧',
        skuSpec: '330ml × 24',
        unit: '件',
        quantity: 2,
        unitPrice: 300,
        lineAmount: 600,
      },
    ],
  },
  {
    id: 'PLT-20260408-004',
    sourceOrderNo: 'A6-20260408-004',
    groupKey: 'A6-20260408-004',
    sourcePlatform: 'A6 ERP',
    mappingTemplateId: 'tpl-a6',
    importBatchId: 'IMP-20260408-002',
    importedAt: '2026-04-08 10:10:00',
    customer: '李四便利',
    summary: '农夫山泉×120',
    amount: 360,
    paid: 0,
    status: OrderStatus.CREDIT,
    payType: PayType.CREDIT,
    prints: 1,
    date: '2026-04-08 10:02',
    voided: false,
    customFieldValues: {
      goodsNum: 1,
      receiverPhone: '13800000004',
    },
    lineItems: [
      {
        lineId: 'LINE-031',
        sourceLineNo: '1',
        sourceOrderNo: 'A6-20260408-004',
        skuName: '农夫山泉',
        skuSpec: '550ml × 24',
        unit: '件',
        quantity: 5,
        unitPrice: 72,
        lineAmount: 360,
      },
    ],
  },
  {
    id: 'PLT-20260408-005',
    sourceOrderNo: 'ZP-20260407-009',
    groupKey: 'ZP-20260407-009',
    sourcePlatform: '舟谱',
    mappingTemplateId: 'tpl-zhoupu',
    importBatchId: 'IMP-20260407-003',
    importedAt: '2026-04-07 17:05:00',
    customer: '吴九便利',
    summary: '红牛×72等1件',
    amount: 792,
    paid: 0,
    status: OrderStatus.EXPIRED,
    payType: PayType.CREDIT,
    prints: 1,
    date: '2026-04-07 08:30',
    voided: true,
    voidReason: '订单过期未付款',
    voidedAt: '2026-04-08 08:00:00',
    customFieldValues: {
      goodsNum: 1,
      receiverName: '吴老板',
    },
    lineItems: [
      {
        lineId: 'LINE-041',
        sourceLineNo: '1',
        sourceOrderNo: 'ZP-20260407-009',
        skuName: '红牛',
        skuSpec: '250ml × 24',
        unit: '箱',
        quantity: 3,
        unitPrice: 264,
        lineAmount: 792,
      },
    ],
  },
]

const previewResults: Record<string, OrderImportPreviewResult> = {
  success: {
    previewId: 'preview-success',
    templateId: 'tpl-a6',
    matchedFieldCount: 7,
    requiredFieldMissing: [],
    summary: {
      totalRows: 5,
      validRows: 5,
      invalidRows: 0,
      aggregatedOrderCount: 2,
      duplicateOrderCount: 0,
      errorCount: 0,
    },
    aggregatedOrders: [
      {
        id: 'PREVIEW-001',
        sourceOrderNo: 'A6-20260408-101',
        groupKey: 'A6-20260408-101',
        mappingTemplateId: 'tpl-a6',
        customer: '新城超市',
        summary: '青岛啤酒×24等2件',
        amount: 1680,
        paid: 0,
        status: OrderStatus.PENDING,
        payType: PayType.CASH,
        prints: 0,
        date: '2026-04-08 11:00',
        lineItems: [
          {
            lineId: 'P-LINE-001',
            sourceOrderNo: 'A6-20260408-101',
            skuName: '青岛啤酒',
            quantity: 2,
            unitPrice: 480,
            lineAmount: 960,
          },
          {
            lineId: 'P-LINE-002',
            sourceOrderNo: 'A6-20260408-101',
            skuName: '可口可乐',
            quantity: 2,
            unitPrice: 360,
            lineAmount: 720,
          },
        ],
        customFieldValues: {
          goodsNum: 2,
          receiverPhone: '13800000999',
        },
      },
      {
        id: 'PREVIEW-002',
        sourceOrderNo: 'A6-20260408-102',
        groupKey: 'A6-20260408-102',
        mappingTemplateId: 'tpl-a6',
        customer: '东湖便利',
        summary: '农夫山泉×120',
        amount: 360,
        paid: 0,
        status: OrderStatus.CREDIT,
        payType: PayType.CREDIT,
        prints: 0,
        date: '2026-04-08 11:10',
        lineItems: [
          {
            lineId: 'P-LINE-003',
            sourceOrderNo: 'A6-20260408-102',
            skuName: '农夫山泉',
            quantity: 5,
            unitPrice: 72,
            lineAmount: 360,
          },
        ],
        customFieldValues: {
          goodsNum: 1,
          receiverPhone: '13800000888',
        },
      },
    ],
    invalidRows: [],
    duplicateOrders: [],
  },
  duplicate: {
    previewId: 'preview-duplicate',
    templateId: 'tpl-zhoupu',
    matchedFieldCount: 6,
    requiredFieldMissing: [],
    summary: {
      totalRows: 6,
      validRows: 5,
      invalidRows: 1,
      aggregatedOrderCount: 3,
      duplicateOrderCount: 1,
      errorCount: 1,
    },
    aggregatedOrders: [
      {
        id: 'PREVIEW-101',
        sourceOrderNo: 'ZP-20260408-002',
        groupKey: 'ZP-20260408-002',
        mappingTemplateId: 'tpl-zhoupu',
        customer: '好再来餐饮',
        summary: '五粮液×2等2件',
        amount: 4800,
        paid: 0,
        status: OrderStatus.PENDING,
        payType: PayType.CASH,
        prints: 0,
        date: '2026-04-08 12:00',
        lineItems: [
          {
            lineId: 'P-LINE-101',
            sourceOrderNo: 'ZP-20260408-002',
            skuName: '五粮液',
            quantity: 2,
            unitPrice: 1880,
            lineAmount: 3760,
          },
          {
            lineId: 'P-LINE-102',
            sourceOrderNo: 'ZP-20260408-002',
            skuName: '矿泉水',
            quantity: 2,
            unitPrice: 520,
            lineAmount: 1040,
          },
        ],
        customFieldValues: {
          goodsNum: 2,
          receiverName: '李老板',
        },
      },
      {
        id: 'PREVIEW-102',
        sourceOrderNo: 'ZP-20260408-200',
        groupKey: 'ZP-20260408-200',
        mappingTemplateId: 'tpl-zhoupu',
        customer: '城南超市',
        summary: '红牛×24',
        amount: 264,
        paid: 0,
        status: OrderStatus.PENDING,
        payType: PayType.CASH,
        prints: 0,
        date: '2026-04-08 12:10',
        lineItems: [
          {
            lineId: 'P-LINE-103',
            sourceOrderNo: 'ZP-20260408-200',
            skuName: '红牛',
            quantity: 1,
            unitPrice: 264,
            lineAmount: 264,
          },
        ],
        customFieldValues: {
          goodsNum: 1,
          receiverName: '王店长',
        },
      },
    ],
    invalidRows: [
      {
        row: 6,
        field: 'amount',
        sourceOrderNo: 'ZP-20260408-201',
        reason: '金额格式错误',
      },
    ],
    duplicateOrders: [
      {
        sourceOrderNo: 'ZP-20260408-002',
        existingOrderId: 'PLT-20260408-002',
        customer: '好再来餐饮',
        amount: 4800,
        existingStatus: OrderStatus.PENDING,
        incomingRowCount: 2,
      },
    ],
  },
  error: {
    previewId: 'preview-error',
    templateId: 'tpl-a6',
    matchedFieldCount: 3,
    requiredFieldMissing: ['sourceOrderNo', 'customer'],
    summary: {
      totalRows: 4,
      validRows: 0,
      invalidRows: 4,
      aggregatedOrderCount: 0,
      duplicateOrderCount: 0,
      errorCount: 4,
    },
    aggregatedOrders: [],
    invalidRows: [
      { row: 1, field: 'sourceOrderNo', reason: '源订单号不能为空' },
      { row: 2, field: 'customer', reason: '客户名称不能为空' },
      { row: 3, field: 'amount', reason: '订单金额必须为数字' },
      { row: 4, field: 'date', reason: '下单时间格式非法' },
    ],
    duplicateOrders: [],
  },
}

const jobs: Record<string, OrderImportJobResult> = {
  'job-success': {
    jobId: 'job-success',
    status: OrderImportJobStatus.COMPLETED,
    submittedCount: 2,
    processedCount: 2,
    successCount: 2,
    skippedCount: 0,
    overwrittenCount: 0,
    failedCount: 0,
    failedRows: [],
    conflictDetails: [],
    completedAt: '2026-04-08 11:06:00',
  },
  'job-partial': {
    jobId: 'job-partial',
    status: OrderImportJobStatus.COMPLETED,
    submittedCount: 3,
    processedCount: 3,
    successCount: 1,
    skippedCount: 1,
    overwrittenCount: 1,
    failedCount: 1,
    failedRows: [
      {
        row: 6,
        sourceOrderNo: 'ZP-20260408-201',
        reason: '金额格式错误，未导入',
      },
    ],
    conflictDetails: [
      {
        sourceOrderNo: 'ZP-20260408-002',
        existingOrderId: 'PLT-20260408-002',
        action: OrderImportConflictPolicy.OVERWRITE,
        reason: '用户选择覆盖已有订单',
      },
      {
        sourceOrderNo: 'ZP-20260408-210',
        existingOrderId: 'PLT-20260407-210',
        action: OrderImportConflictPolicy.SKIP,
        reason: '用户选择跳过重复订单',
      },
    ],
    completedAt: '2026-04-08 12:16:00',
  },
  'job-failed': {
    jobId: 'job-failed',
    status: OrderImportJobStatus.FAILED,
    submittedCount: 2,
    processedCount: 2,
    successCount: 0,
    skippedCount: 0,
    overwrittenCount: 0,
    failedCount: 2,
    failedRows: [
      {
        row: 1,
        sourceOrderNo: 'A6-20260408-900',
        reason: '模板字段缺失，无法导入',
      },
      {
        row: 2,
        sourceOrderNo: 'A6-20260408-901',
        reason: '客户名称为空，无法入库',
      },
    ],
    conflictDetails: [],
    completedAt: '2026-04-08 14:30:00',
  },
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function toStringValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return String(value ?? '')
}

function toNumberValue(value: unknown, fallback: number) {
  const parsed = Number(toStringValue(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function findOrderById(id: string) {
  return orders.find((item) => item.id === id)
}

function resolveScenario(request: { query?: Record<string, unknown>; body?: unknown }, fallback: string) {
  const queryScenario = toStringValue(request.query?.scenario)
  if (queryScenario) return queryScenario

  if (request.body && typeof request.body === 'object' && 'scenario' in request.body) {
    return toStringValue((request.body as { scenario?: unknown }).scenario) || fallback
  }

  return fallback
}

function filterOrders(query: Record<string, unknown> | undefined) {
  const keyword = toStringValue(query?.keyword).trim()
  const status = toStringValue(query?.status).trim()
  const payType = toStringValue(query?.payType).trim()
  const dateFrom = toStringValue(query?.dateFrom).trim()
  const dateTo = toStringValue(query?.dateTo).trim()
  const templateId = toStringValue(query?.templateId).trim()

  return orders.filter((order) => {
    const matchKeyword =
      !keyword ||
      order.id.includes(keyword) ||
      order.customer.includes(keyword) ||
      String(order.sourceOrderNo ?? '').includes(keyword)
    const matchStatus = !status || order.status === status
    const matchPayType = !payType || order.payType === payType
    const matchTemplate = !templateId || order.mappingTemplateId === templateId
    const matchFrom = !dateFrom || order.date >= dateFrom
    const matchTo = !dateTo || order.date <= dateTo

    return matchKeyword && matchStatus && matchPayType && matchTemplate && matchFrom && matchTo
  })
}

export default defineMock([
  {
    url: '/api/import/templates',
    delay: 120,
    body(request) {
      const scenario = resolveScenario(request, 'default')
      const data = scenario === 'empty' ? [] : clone(templates)

      return {
        code: 0,
        message: 'ok',
        data,
      }
    },
  },
  {
    url: '/api/import/templates',
    method: 'POST',
    delay: 160,
    body(request) {
      const payload = (request.body ?? {}) as Partial<OrderImportTemplate>
      const template: OrderImportTemplate = {
        id: `tpl-custom-${templates.length + 1}`,
        name: String(payload.name ?? `自定义模板${templates.length + 1}`),
        isDefault: false,
        updatedAt: '2026-04-08 15:00:00',
        mappings: payload.mappings ?? [],
        sourceColumns: payload.sourceColumns ?? [],
        fields: payload.fields ?? [],
      }

      templates.push(template)

      return {
        code: 0,
        message: 'ok',
        data: clone(template),
      }
    },
  },
  {
    url: '/api/import/templates/:id',
    method: 'PUT',
    delay: 160,
    body(request) {
      const id = toStringValue(request.params.id)
      const payload = (request.body ?? {}) as Partial<OrderImportTemplate>
      const target = templates.find((item) => item.id === id)

      if (!target) {
        return {
          code: 40401,
          message: '模板不存在',
          data: null,
        }
      }

      target.name = payload.name ?? target.name
      target.isDefault = payload.isDefault ?? target.isDefault
      target.mappings = payload.mappings ?? target.mappings
      target.sourceColumns = payload.sourceColumns ?? target.sourceColumns
      target.fields = payload.fields ?? target.fields
      target.updatedAt = '2026-04-08 15:10:00'

      return {
        code: 0,
        message: 'ok',
        data: clone(target),
      }
    },
  },
  {
    url: '/api/import/preview',
    method: 'POST',
    delay: 220,
    body(request) {
      const payload = (request.body ?? {}) as Partial<OrderImportPreviewPayload>
      const scenario = resolveScenario(request, payload.templateId === 'tpl-a6' ? 'success' : 'duplicate')
      const result = previewResults[scenario] ?? previewResults.duplicate

      return {
        code: 0,
        message: 'ok',
        data: clone(result),
      }
    },
  },
  {
    url: '/api/orders/import',
    method: 'POST',
    delay: 180,
    body(request) {
      const payload = (request.body ?? {}) as Partial<OrderImportSubmitPayload>
      const scenario = resolveScenario(
        request,
        payload.previewId === 'preview-success'
          ? 'success'
          : payload.previewId === 'preview-error'
            ? 'failed'
            : 'partial',
      )

      const data =
        scenario === 'success'
          ? {
              jobId: 'job-success',
              submittedCount: 2,
              status: OrderImportJobStatus.PENDING,
            }
          : scenario === 'failed'
            ? {
                jobId: 'job-failed',
                submittedCount: 2,
                status: OrderImportJobStatus.PENDING,
              }
            : {
                jobId: 'job-partial',
                submittedCount: 3,
                status: OrderImportJobStatus.PENDING,
              }

      return {
        code: 0,
        message: 'ok',
        data,
      }
    },
  },
  {
    url: '/api/orders/import/jobs/:jobId',
    delay: 120,
    body(request) {
      const jobId = toStringValue(request.params.jobId)
      const job = jobs[jobId]

      if (!job) {
        return {
          code: 40401,
          message: '导入任务不存在',
          data: null,
        }
      }

      return {
        code: 0,
        message: 'ok',
        data: clone(job),
      }
    },
  },
  {
    url: '/api/orders/:id/remind',
    method: 'POST',
    delay: 100,
    body(request) {
      const id = toStringValue(request.params.id)
      const payload = (request.body ?? {}) as OrderRemindPayload
      const order = findOrderById(id)

      if (!order) {
        return {
          code: 40401,
          message: '订单不存在',
          data: null,
        }
      }

      return {
        code: 0,
        message: 'ok',
        data: {
          sent: true,
          channels: payload.channels?.length ? payload.channels : ['sms'],
        },
      }
    },
  },
  {
    url: '/api/orders/:id/mark-received',
    method: 'POST',
    delay: 140,
    body(request) {
      const id = toStringValue(request.params.id)
      const payload = (request.body ?? {}) as MarkOrderReceivedPayload
      const order = findOrderById(id)

      if (!order) {
        return {
          code: 40401,
          message: '订单不存在',
          data: null,
        }
      }

      const remain = Math.max(0, order.amount - order.paid)
      const receiveAmount = payload.amount ?? remain
      const nextPaid = Math.min(order.amount, order.paid + receiveAmount)

      order.paid = nextPaid
      order.status = nextPaid >= order.amount ? OrderStatus.PAID : OrderStatus.PARTIAL

      return {
        code: 0,
        message: 'ok',
        data: {
          orderId: order.id,
          status: order.status,
          paid: order.paid,
        },
      }
    },
  },
  {
    url: '/api/orders/:id',
    delay: 100,
    body(request) {
      const id = toStringValue(request.params.id)
      const order = findOrderById(id)

      if (!order) {
        return {
          code: 40401,
          message: '订单不存在',
          data: null,
        }
      }

      return {
        code: 0,
        message: 'ok',
        data: clone(order),
      }
    },
  },
  {
    url: '/api/orders',
    delay: 100,
    body(request) {
      const page = toNumberValue(request.query?.page, 1)
      const pageSize = toNumberValue(request.query?.pageSize, DEFAULT_PAGE_SIZE)
      const filtered = filterOrders(request.query)
      const start = (page - 1) * pageSize
      const list = filtered.slice(start, start + pageSize)

      return {
        code: 0,
        message: 'ok',
        data: {
          list: clone(list),
          total: filtered.length,
          page,
          pageSize,
        },
      }
    },
  },
])
