# 收单吧 SaaS 平台 — 数据模型参考（Prisma 建表依据）

> 本文档承接原 docs/api/api-architecture-overview.md 中的“数据模型（服务端建表参考）”章节。
> 用途：作为 Prisma 建表与服务端数据建模参考，不作为前端 API 联调必读文档。
> 确认日期：2026-04-09
> 统一枚举命名与取值参见 **[../enums/enum-manual.md](../enums/enum-manual.md)**。

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
  tenantType: TenantSide   // 用户所属侧：平台用户或租户用户
  role: string              // 角色名称
  scope: string             // 数据范围描述
  status: UserStatus       // 账号状态
  requiresPasswordReset: boolean // 是否要求下次登录强制修改密码
  loginAt: string           // 最后登录时间
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**roles 表**

```typescript
{
  id: string                // 角色 ID
  name: string              // 角色名称（同 side 内唯一）
  side: TenantSide            // 角色归属侧；platform=平台角色，tenant=租户角色
  permissions: string[]     // 权限项列表
  isSystem: boolean         // 是否系统内置
  tenantId: string | null   // 租户自定义角色时关联租户
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**permissions 表**（权限树）

```typescript
{
  id: string                // 权限节点 ID
  label: string             // 权限名称
  parentId: string | null   // 父节点 ID；顶级节点为 null
  sort: number              // 排序值
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
  status: 'active' | 'onboarding' | 'attention' | 'paused' // 租户状态
  rejectReason: string | null // 驳回原因
  freezeReason: string | null // 冻结原因
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**tenant_certifications 表**（资质审核）

```typescript
{
  id: string                // 资质记录 ID
  tenantId: string          // 关联租户 ID
  type: string              // "企业实名认证" | "经营资质补充" | "法人身份证更新"
  submitAt: string          // 提交时间
  status: TenantCertificationStatus // 审核状态
  comment: string | null    // 审核备注
  rejectReason: string | null // 驳回原因
  reviewedAt: string | null // 最近审核时间
}
```

**tenant_general_settings 表**（租户通用配置覆盖层）

```typescript
{
  id: string                // 配置记录 ID
  tenantId: string          // 关联租户 ID
  companyName: string | null // 企业名称覆盖值
  contactPerson: string | null // 联系人覆盖值
  contactPhone: string | null // 联系电话覆盖值
  address: string | null    // 企业地址覆盖值
  licenseNo: string | null  // 营业执照号覆盖值
  qrCodeExpiry: number | null // 收款二维码有效期覆盖值（天）
  notifySeller: boolean | null // 是否通知业务员
  notifyOwner: boolean | null // 是否通知老板
  notifyFinance: boolean | null // 是否通知财务
  creditRemindDays: number | null // 账期提醒提前天数覆盖值
  dailyReportPush: boolean | null // 是否开启日报推送
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**约束说明：**

- `tenantId` 唯一索引
- 仅保存租户覆盖值；未覆盖字段由平台默认配置补齐

**printer_templates 表**（租户打印配置）

```typescript
{
  id: string                // 打印配置记录 ID
  tenantId: string          // 关联租户 ID
  importTemplateId: string   // 绑定的导入映射模板 ID
  config: any                // JSON: 前端维护的完整打印配置快照，服务端不解析内部结构
  configVersion: number      // 配置版本号
  remark: string | null     // 备注信息
  updatedBy: string | null  // 最近更新人
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**约束说明：**

- `(tenantId, importTemplateId)` 唯一索引
- 若某张映射模板不存在自定义配置，则前端回退本地默认打印模板

### 1.3 订单域

**orders 表**

```typescript
{
  id: string                // 如 "PLT-20260325-001"
  tenantId: string          // 所属租户
  sourceOrderNo: string | null // ERP 源订单号（用于聚合）
  groupKey: string | null   // 防重判定辅键
  mappingTemplateId: string | null // 绑定的导入模板 ID
  qrCodeToken: string       // 订单级 H5 公开路由标识，送货单二维码直接使用
  customer: string          // 客户名称
  summary: string           // 商品摘要
  amount: number            // 订单金额（元）
  paid: number              // 已收金额（元）
  customFieldValues: any    // JSON: 动态模板映射的自定义字段
  status: OrderStatus         // 订单收款状态
  payType: OrderPayType    // 付款方式
  prints: number            // 打印次数
  creditDays: number | null // 账期天数
  creditDueDate: string | null // 账期到期日
  date: string              // 订单日期
  voided: boolean           // 是否已作废
  voidReason: string | null // 作废原因
  voidedAt: string | null   // 作废时间
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**约束说明：**

- `qrCodeToken` 唯一索引
- 创建订单与导入订单时同步生成 `qrCodeToken`

**order_items 表**（订单行项目，H5 展示用）

```typescript
{
  id: string                // 行项目 ID
  orderId: string           // 关联订单
  skuName: string           // 商品名称
  skuSpec: string | null    // 规格
  unit: string              // 单位
  quantity: number          // 数量
  unitPrice: number         // 单价
  lineAmount: number        // 行金额
}
```

**import_templates 表**（Excel 导入映射模板）

```typescript
{
  id: string                // 导入模板 ID
  tenantId: string          // 关联租户 ID
  name: string              // 模板名称
  isDefault: boolean        // 是否默认模板
  sourceColumns: any        // JSON: Excel 表头读取快照数组
  fields: any               // JSON: 靶点骨架定义数组
  mappings: any             // JSON: 映射连线关系数组
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**import_jobs 表**（异步导入任务）

```typescript
{
  id: string                // 导入任务 ID
  tenantId: string          // 关联租户 ID
  status: OrderImportJobStatus // 任务状态
  submittedCount: number    // 提交处理的订单数
  processedCount: number    // 已处理订单数
  successCount: number      // 成功入库数
  skippedCount: number      // 跳过数量
  overwrittenCount: number  // 覆盖更新数量
  failedCount: number       // 失败数量
  failedRows: any           // JSON: 行级报错日志
  conflictDetails: any      // JSON: 重复冲突判定策略与结果追溯
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**print_record_batches 表**（打印回执批次幂等）

```typescript
{
  id: string                // 打印回执批次 ID
  tenantId: string          // 关联租户 ID
  requestId: string         // 前端回执批次号；同租户下唯一
  operatorId: string | null // 操作人 ID
  orderIds: any             // JSON: 本次提交的订单 ID 列表（服务端去重后持久化）
  totalCount: number        // 本批次去重后的订单总数
  successCount: number      // 成功累计打印次数的订单数
  remark: string | null     // 备注信息
  createdAt: string         // 创建时间
}
```

**约束说明：**

- `(tenantId, requestId)` 唯一索引
- 用于 `POST /orders/print-records` 的批次级幂等，不承担逐单打印审计明细

### 1.4 支付域

**payments 表**（收款流水）

```typescript
{
  id: string                // 流水号，如 "PAY-20260330-001"
  tenantId: string          // 关联租户 ID
  orderId: string           // 关联订单号
  customer: string          // 客户名称
  amount: number            // 收款金额（元）
  channel: string           // 支付通道编码，如 wx_jsapi | ali_h5 | direct | cash | other_paid
  fee: number               // 手续费（元）
  net: number               // 到账金额（元）
  status: PaymentRecordStatus // 流水状态
  paidAt: string            // 支付完成时间
  createdAt: string         // 创建时间
}
```

**payment_orders 表**（H5 支付单，对接网关用）

```typescript
{
  id: string                // 支付单号
  tenantId: string          // 关联租户 ID
  orderId: string           // 关联业务订单 ID
  amount: number            // 本次支付单金额
  status: PaymentOrderStatus // H5 支付状态
  paymentMethod: PaymentMethod | null // 用户选择的支付方式
  channel: PaymentChannel | null // 实际支付渠道
  statusMessage: string | null // 状态补充说明
  // 线下支付信息
  offlineRemark: string | null // 线下支付备注
  cashVerifyStatus: CashVerifyStatus | null // 现金核销状态
  offlineSubmittedAt: string | null // 线下支付提交时间
  cashVerifiedAt: string | null // 现金核销完成时间
  // 网关信息
  gatewayTradeNo: string | null  // 第三方支付单号
  lastInitiatedAt: string | null // 最近一次发起在线支付时间
  paidAt: string | null     // 实际支付完成时间
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**约束说明：**

- H5 支付状态统一采用 `unpaid / paying / pending_verification / paid / expired`
- 当状态为 `expired` 时，允许再次调用支付发起链路，刷新网关单信息并进入新一轮支付流程



### 1.5 计费域

**packages 表**（套餐定义）

```typescript
{
  id: string                // 套餐 ID
  name: string              // "基础版" | "标准版" | "旗舰版"
  price: string             // 价格描述，如 "¥4,999/年"
  rate: string              // 费率描述，如 "费率 4‰"
  strategy: string          // 策略说明
  features: string[]        // 套餐功能列表
  tenants: number           // 在用租户数（可计算）
  status: BillingPackageStatus // 套餐状态
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**contracts 表**

```typescript
{
  contractNo: string        // 如 "HT-202603-001"
  tenantId: string          // 关联租户 ID
  type: ContractType // 合同类型
  packageName: string       // 关联套餐名称
  contactName: string       // 联系人姓名
  phone: string             // 联系电话
  annualFee: string         // 年费金额
  rate: string              // 费率说明
  serviceStart: string      // 服务开始时间
  serviceEnd: string        // 服务结束时间
  status: ContractStatus // 合同状态
  signLink: string | null   // 电子签链接
  smsSent: boolean          // 是否已发送签署短信
  remark: string | null     // 备注信息
  terminateReason: string | null // 终止原因
  approvedAt: string | null // 审批通过时间
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**invoices 表**

```typescript
{
  billNo: string            // 如 "INV-001"
  tenantId: string          // 关联租户 ID
  amount: string            // 开票金额
  cycle: string             // 结算周期，如 "2026-03"
  status: InvoiceStatus // 发票状态
  taxRate: number | null    // 税率
  issuedAt: string | null   // 开票时间
  voidReason: string | null // 作废原因
  voidedAt: string | null   // 作废时间
  createdAt: string         // 创建时间
}
```

### 1.6 运维域

**notices 表**（系统公告）

```typescript
{
  id: string                // 公告 ID
  title: string             // 公告标题
  content: string           // 公告正文
  planVersion: string       // 套餐版本范围
  audience: string          // 发布范围
  timing: PublishTiming // 发布时间类型
  scheduledAt: string | null // 预约发布时间
  reminder: boolean         // 24小时二次提醒
  isDraft: boolean          // 是否草稿
  status: NoticeStatus // 公告状态
  publishAt: string | null  // 实际发布时间
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**notice_reads 表**（公告已读状态）

```typescript
{
  id: string                // 已读记录 ID
  noticeId: string          // 关联公告 ID
  tenantId: string          // 关联租户 ID
  userId: string            // 关联用户 ID
  isRead: boolean           // 是否已读
  readAt: string | null     // 已读时间
}
```

**tickets 表**

```typescript
{
  no: string                // 如 "TK-2301"
  tenantId: string          // 提单租户 ID
  issue: string             // 工单问题描述
  assignee: string          // 当前处理人
  status: TicketStatus // 工单状态
  resolution: string | null // 处理结论
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**ticket_replies 表**

```typescript
{
  id: string                // 回复记录 ID
  ticketNo: string          // 关联工单编号
  content: string           // 回复内容
  attachments: string[]     // 附件地址列表
  repliedBy: string         // 回复人
  repliedAt: string         // 回复时间
}
```

**audit_logs 表**

```typescript
{
  id: string                // 日志 ID
  actor: string             // 操作人
  action: string            // 操作名称
  target: string            // 操作对象
  targetType: AuditTargetType // 操作对象类型
  tenantId: string | null   // 关联租户 ID；平台操作可为空
  result: AuditResult // 执行结果
  time: string              // 操作时间
}
```

**alert_rules 表**

```typescript
{
  id: string                // 规则 ID
  name: string              // 规则名称
  trigger: string           // 触发条件描述
  channel: string           // 通知通道
  enabled: boolean          // 是否启用
  createdAt: string         // 创建时间
  updatedAt: string         // 更新时间
}
```

**security_policies 表**

```typescript
{
  id: string                // 策略 ID
  title: string             // 策略标题
  detail: string            // 策略说明
  enabled: boolean          // 是否启用
}
```

**ip_whitelist 表**

```typescript
{
  id: string                // 白名单记录 ID
  label: string             // 标识名称
  cidr: string              // 白名单网段
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

**system_configs 表**（平台默认配置源）

```typescript
{
  group: string             // "平台默认参数" | "邮件通道" | "短信通道"
  key: string               // 配置键
  value: string             // 配置值
  note: string              // 配置说明
}
```

**说明：**

- 在 `/settings/general` 场景中，`system_configs` 提供平台默认值来源
- 租户个性化覆盖值存放在 `tenant_general_settings`，最终对前端返回“平台默认 + 租户覆盖”的合并结果

**service_configs 表**

```typescript
{
  id: string                // 配置记录 ID
  name: string              // 配置名称
  category: string          // 配置分类
  key: string               // 配置键
  provider: string          // 服务提供方
  note: string              // 备注说明
}
```

**service_providers 表**（外部服务商）

```typescript
{
  id: string                // 服务商记录 ID
  name: string              // 服务商名称
  category: string          // "消息通道" | "资质审核" | "合同管理"
  contactName: string       // 联系人姓名
  contactPhone: string      // 联系电话
  status: ServiceProviderStatus // 接入状态
  score: string             // 综合评分
  updatedAt: string         // 最近更新时间
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
| 6 | tenant_general_settings | 租户通用配置覆盖层 | Tenant |
| 7 | printer_templates | 打印模板配置 | Tenant |
| 8 | orders | 订单 | Admin + Tenant + H5 |
| 9 | order_items | 订单行项目 | Admin + Tenant + H5 |
| 10 | import_templates | 导入模板 | Tenant |
| 11 | import_jobs | 异步导入任务 | Tenant |
| 12 | print_record_batches | 打印回执批次幂等 | Tenant |
| 13 | payments | 收款流水 | Admin + Tenant |
| 14 | payment_orders | H5 支付单 | H5 + Tenant（核销） |
| 15 | packages | 套餐定义 | Admin |
| 16 | contracts | 合同 | Admin |
| 17 | invoices | 账单 | Admin |
| 18 | notices | 系统公告 | Admin（写）+ Tenant（读） |
| 19 | notice_reads | 公告已读状态 | Tenant |
| 20 | tickets | 工单 | Admin |
| 21 | ticket_replies | 工单回复 | Admin |
| 22 | audit_logs | 操作日志 | Admin + Tenant |
| 23 | alert_rules | 告警规则 | Admin |
| 24 | security_policies | 安全策略 | Admin |
| 25 | ip_whitelist | IP 白名单 | Admin |
| 26 | period_policies | 周期策略 | Admin |
| 27 | system_configs | 平台默认配置源 | Admin |
| 28 | service_configs | 服务接入配置 | Admin |
| 29 | service_providers | 外部服务商 | Admin |
| — | **合计** | **29 张表** | — |
