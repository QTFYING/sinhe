# 收单吧 SaaS 平台 — 数据模型参考（Prisma 建表依据）

> 本文档承接原 docs/api/api-architecture-overview.md 中的“数据模型（服务端建表参考）”章节。
> 用途：作为 Prisma 建表与服务端数据建模参考，不作为前端 API 联调必读文档。
> 确认日期：2026-04-09

---

## 一、数据模型（服务端建表参考）

### 1.1 用户与权限域

**users 表**

```typescript
{
  id: string                // 主键，如 "USR-001"
  account: string           // 登录账号（全局唯一）
  name: string              // 姓名
  phone: string             // 手机号
  password: string          // 密码（加密存储）
  tenantId: string | null   // 所属租户 ID，平台用户为 null
  tenantType: '平台' | '租户'
  role: string              // 角色名称
  scope: string             // 数据范围描述
  status: 'active' | 'invited' | 'locked' | 'disabled'
  requiresPasswordReset: boolean
  loginAt: string           // 最后登录时间
  createdAt: string
  updatedAt: string
}
```

**roles 表**

```typescript
{
  id: string
  name: string              // 角色名称（同 side 内唯一）
  side: '平台角色' | '租户角色'
  permissions: string[]     // 权限项列表
  isSystem: boolean         // 是否系统内置
  tenantId: string | null   // 租户自定义角色时关联租户
  createdAt: string
  updatedAt: string
}
```

**permissions 表**（权限树）

```typescript
{
  id: string
  label: string
  parentId: string | null
  sort: number
}
```

### 1.2 租户域

**tenants 表**

```typescript
{
  id: string                // 如 "TEN-001"
  name: string              // 租户名称
  packageName: string       // 套餐名称
  admin: string             // 管理员姓名
  region: string            // 地区
  channels: string[]        // 支付通道
  merchants: number         // 商户数
  users: number             // 账号数
  monthlyFlow: number       // 本月流水（元）
  dueInDays: number         // 距到期天数
  lastActiveAt: string      // 最近活跃时间
  status: 'active' | 'onboarding' | 'attention' | 'paused'
  rejectReason: string | null
  freezeReason: string | null
  createdAt: string
  updatedAt: string
}
```

**tenant_certifications 表**（资质审核）

```typescript
{
  id: string
  tenantId: string
  type: string              // "企业实名认证" | "经营资质补充" | "法人身份证更新"
  submitAt: string
  status: '待初审' | '待复核' | '待确认' | '已通过' | '已驳回'
  comment: string | null
  rejectReason: string | null
  reviewedAt: string | null
}
```

**printer_templates 表**（租户打印配置）

```typescript
{
  id: number
  tenantId: string
  name: string              // 模板名称
  paperWidth: number        // 纸张宽度 mm
  paperHeight: number       // 纸张高度 mm
  fields: Array<{
    id: string
    key: string
    label: string
    x: number
    y: number
    w: number
    h: number
    fontSize: number
    bold: boolean
    align: 'left' | 'center' | 'right'
    showLabel: boolean
  }>
  isDefault: boolean
  createdAt: string
  updatedAt: string
}
```

### 1.3 订单域

**orders 表**

```typescript
{
  id: string                // 如 "PLT-20260325-001"
  tenantId: string          // 所属租户
  sourceOrderNo: string | null // ERP 源订单号（用于聚合）
  groupKey: string | null   // 防重判定辅键
  mappingTemplateId: string | null // 绑定的导入模板 ID
  customer: string          // 客户名称
  summary: string           // 商品摘要
  amount: number            // 订单金额（元）
  paid: number              // 已收金额（元）
  customFieldValues: any    // JSON: 动态模板映射的自定义字段
  status: 'pending' | 'partial' | 'paid' | 'expired' | 'credit'
  payType: '现款' | '账期'
  prints: number            // 打印次数
  creditDays: number | null // 账期天数
  creditDueDate: string | null
  date: string              // 订单日期
  voided: boolean
  voidReason: string | null
  voidedAt: string | null
  createdAt: string
  updatedAt: string
}
```

**order_items 表**（订单行项目，H5 展示用）

```typescript
{
  id: string
  orderId: string           // 关联订单
  skuName: string           // 商品名称
  skuSpec: string | null    // 规格
  unit: string              // 单位
  quantity: number
  unitPrice: number
  lineAmount: number
}
```

**import_templates 表**（Excel 导入映射模板）

```typescript
{
  id: string
  tenantId: string
  name: string
  isDefault: boolean
  sourceColumns: any        // JSON: Excel 表头读取快照数组
  fields: any               // JSON: 靶点骨架定义数组
  mappings: any             // JSON: 映射连线关系数组
  createdAt: string
  updatedAt: string
}
```

**import_jobs 表**（异步导入任务）

```typescript
{
  id: string
  tenantId: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  submittedCount: number
  processedCount: number
  successCount: number
  skippedCount: number
  overwrittenCount: number
  failedCount: number
  failedRows: any           // JSON: 行级报错日志
  conflictDetails: any      // JSON: 重复冲突判定策略与结果追溯
  createdAt: string
  updatedAt: string
}
```

### 1.4 支付域

**payments 表**（收款流水）

```typescript
{
  id: string                // 流水号，如 "PAY-20260330-001"
  tenantId: string
  orderId: string           // 关联订单号
  customer: string
  amount: number            // 收款金额（元）
  channel: string           // 支付通道：微信支付 | 支付宝 | 现金 | 其他
  fee: number               // 手续费（元）
  net: number               // 到账金额（元）
  status: 'success' | 'partial' | 'pending' | 'failed'
  paidAt: string            // 支付完成时间
  createdAt: string
}
```

**payment_orders 表**（H5 支付单，对接网关用）

```typescript
{
  id: string                // 支付单号
  orderNo: string           // 关联业务订单号
  amount: number
  status: 'pending' | 'pending_verification' | 'paid' | 'failed'
  paymentMethod: 'online' | 'cash' | 'other_paid' | null
  channel: 'wx_jsapi' | 'ali_h5' | 'direct' | null
  statusMessage: string | null
  // 线下支付信息
  offlineRemark: string | null
  cashVerifyStatus: 'pending' | 'verified' | null
  offlineSubmittedAt: string | null
  cashVerifiedAt: string | null
  // 网关信息
  gatewayTradeNo: string | null  // 第三方支付单号
  paidAt: string | null
  createdAt: string
  updatedAt: string
}
```



### 1.5 计费域

**packages 表**（套餐定义）

```typescript
{
  id: string
  name: string              // "基础版" | "标准版" | "旗舰版"
  price: string             // 价格描述，如 "¥4,999/年"
  rate: string              // 费率描述，如 "费率 4‰"
  strategy: string          // 策略说明
  features: string[]        // 套餐功能列表
  tenants: number           // 在用租户数（可计算）
  status: 'active' | 'draft' | 'archived'
  createdAt: string
  updatedAt: string
}
```

**contracts 表**

```typescript
{
  contractNo: string        // 如 "HT-202603-001"
  tenantId: string
  type: '电子签' | '归档件'
  packageName: string
  contactName: string
  phone: string
  annualFee: string
  rate: string
  serviceStart: string
  serviceEnd: string
  status: '履约中' | '待续约' | '待签署' | '待归档' | '已终止'
  signLink: string | null
  smsSent: boolean
  remark: string | null
  terminateReason: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}
```

**invoices 表**

```typescript
{
  billNo: string            // 如 "INV-001"
  tenantId: string
  amount: string
  cycle: string             // 结算周期，如 "2026-03"
  status: '已开票' | '待开票' | '对账中' | '已作废'
  taxRate: number | null
  issuedAt: string | null
  voidReason: string | null
  voidedAt: string | null
  createdAt: string
}
```

### 1.6 运维域

**notices 表**（系统公告）

```typescript
{
  id: string
  title: string
  content: string
  planVersion: string       // 套餐版本范围
  audience: string          // 发布范围
  timing: 'immediate' | 'scheduled'
  scheduledAt: string | null
  reminder: boolean         // 24小时二次提醒
  isDraft: boolean
  status: '已发布' | '草稿' | '已下架'
  publishAt: string | null
  createdAt: string
  updatedAt: string
}
```

**notice_reads 表**（公告已读状态）

```typescript
{
  id: string
  noticeId: string
  tenantId: string
  userId: string
  isRead: boolean
  readAt: string | null
}
```

**tickets 表**

```typescript
{
  no: string                // 如 "TK-2301"
  tenantId: string
  issue: string
  assignee: string
  status: '处理中' | '待分派' | '已解决'
  resolution: string | null
  createdAt: string
  updatedAt: string
}
```

**ticket_replies 表**

```typescript
{
  id: string
  ticketNo: string
  content: string
  attachments: string[]
  repliedBy: string
  repliedAt: string
}
```

**audit_logs 表**

```typescript
{
  id: string
  actor: string             // 操作人
  action: string            // 操作名称
  target: string            // 操作对象
  targetType: '账号' | '角色' | '租户'
  tenantId: string | null
  result: '成功' | '待处理'
  time: string
}
```

**alert_rules 表**

```typescript
{
  id: string
  name: string
  trigger: string
  channel: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}
```

**security_policies 表**

```typescript
{
  id: string
  title: string
  detail: string
  enabled: boolean
}
```

**ip_whitelist 表**

```typescript
{
  id: string
  label: string
  cidr: string
}
```

**period_policies 表**（单行配置）

```typescript
{
  sessionHours: number      // 会话有效时长，默认 8
  passwordDays: number      // 密码过期周期，默认 90
  retentionDays: number     // 审计日志保留天数，默认 180
}
```

**system_configs 表**

```typescript
{
  group: string             // "全局参数" | "邮件通道" | "短信通道"
  key: string
  value: string
  note: string
}
```

**service_configs 表**

```typescript
{
  id: string
  name: string
  category: string
  key: string
  provider: string
  note: string
}
```

**service_providers 表**（外部服务商）

```typescript
{
  id: string
  name: string
  category: string          // "消息通道" | "资质审核" | "合同管理"
  contactName: string
  contactPhone: string
  status: '已接入' | '试运行'
  score: string
  updatedAt: string
}
```

## 二、建表汇总

| # | 表名 | 说明 | 关联的前端 |
|---|------|------|-----------|
| 1 | users | 用户账号 | Admin + Tenant |
| 2 | roles | 角色模板 | Admin + Tenant |
| 3 | permissions | 权限树 | Admin + Tenant |
| 4 | tenants | 租户 | Admin + Tenant |
| 5 | tenant_certifications | 资质审核 | Admin + Tenant |
| 6 | printer_templates | 打印模板配置 | Tenant |
| 7 | orders | 订单 | Admin + Tenant + H5 |
| 8 | order_items | 订单行项目 | Admin + Tenant + H5 |
| 9 | import_templates | 导入模板 | Tenant |
| 10 | import_jobs | 异步导入任务 | Tenant |
| 11 | payments | 收款流水 | Admin + Tenant |
| 12 | payment_orders | H5 支付单 | H5 + Tenant（核销） |
| 11 | packages | 套餐定义 | Admin |
| 12 | contracts | 合同 | Admin |
| 13 | invoices | 账单 | Admin |
| 14 | notices | 系统公告 | Admin（写）+ Tenant（读） |
| 15 | notice_reads | 公告已读状态 | Tenant |
| 16 | tickets | 工单 | Admin |
| 17 | ticket_replies | 工单回复 | Admin |
| 18 | audit_logs | 操作日志 | Admin + Tenant |
| 19 | alert_rules | 告警规则 | Admin |
| 20 | security_policies | 安全策略 | Admin |
| 21 | ip_whitelist | IP 白名单 | Admin |
| 22 | period_policies | 周期策略 | Admin |
| 23 | system_configs | 系统配置 | Admin |
| 24 | service_configs | 服务接入配置 | Admin |
| 25 | service_providers | 外部服务商 | Admin |
| — | **合计** | **25 张表** | — |
