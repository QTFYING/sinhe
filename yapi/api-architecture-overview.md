# 收单吧 SaaS 平台 — API 架构总览

> 本文档面向服务端团队，梳理三端（Admin / Tenant / H5）的完整 API 需求、跨项目关联、数据模型和端点清单。
> 确认日期：2026-04-03

---

## 一、业务全景

```
┌─────────────────────────────────────────────────────────────────┐
│                      收单吧 SaaS 平台                            │
│                                                                 │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐              │
│  │  Admin   │      │  Tenant  │      │   H5     │              │
│  │ 平台运营  │      │ 商户SaaS │      │ 客户支付  │              │
│  │          │      │          │      │          │              │
│  │ 管所有人  │─────▶│ 管自己的  │─────▶│ 客户付款  │              │
│  └──────────┘      └──────────┘      └──────────┘              │
│       │                  │                 │                    │
│       ▼                  ▼                 ▼                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   统一后端服务                            │    │
│  │  Auth · Tenant · User · Order · Payment · Agent         │    │
│  │  Analytics · Billing · Security · Notification · Ticket │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 核心业务链路

```
平台开通租户 → 租户入驻配置 → 录入/导入订单 → 生成收款码 → 客户扫码付款
     │              │              │              │              │
   Admin          Tenant         Tenant         Tenant          H5
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  审核资质      配置团队角色    管理订单生命周期   打印发货      支付→核销→对账
```

---

## 二、三端 API 关联矩阵

三个前端共享同一个后端，很多**资源是同一张表**，只是**视角和权限不同**：

| 后端资源 | Admin 视角 | Tenant 视角 | H5 视角 |
|---------|-----------|------------|---------|
| **Auth** | 平台账号登录 | 租户账号登录 | 无需登录（orderNo 鉴权） |
| **Tenant** | CRUD + 审核 + 冻结 + 续费（全量） | 查看自己的租户信息（只读） | — |
| **User** | 跨租户管理所有用户 | 仅管理本租户下用户 | — |
| **Order** | 跨租户查看/审计所有订单 | 本租户订单 CRUD + 导入导出 + 打印 | 单个订单只读 |
| **Payment** | 跨租户收款流水汇总 | 本租户收款 + 现金核销 | 发起支付 |
| **Agent** | 跨租户查看服务商（监管视角） | 本租户服务商管理 + 结算 | — |
| **Analytics** | 平台级聚合指标 | 本租户经营数据 | — |
| **Billing** | 套餐/合同/账单管理（运营） | 查看自己的套餐和账单（只读） | — |
| **Security** | 角色模板 + 审计日志 + 安全策略 | — | — |
| **Role** | 平台+租户角色模板管理 | 本租户角色+权限配置 | — |
| **Notice** | 创建/发布公告 | 接收/阅读公告 | — |
| **Ticket** | 分派/管理工单 | 提交/查看工单 | — |
| **Config** | 全局配置管理 | — | — |

### 关键设计原则

1. **同一资源、不同前缀**：Admin 走 `/platform/*` 或直接走资源路径获取跨租户数据；Tenant 走相同资源路径但后端自动按 tenantId 过滤；H5 走 `/pay/*` 获取单个订单
2. **后端通过 Token 中的 `tenantId` 自动隔离数据**：Tenant 端不需要传 tenantId，后端自动注入
3. **H5 无需登录**：通过 orderNo 做资源级鉴权（订单链接即凭证）

---

## 三、数据模型（服务端建表参考）

### 3.1 用户与权限域

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

### 3.2 租户域

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
  reviewedAt: string | null
}
```

### 3.3 订单域

**orders 表**

```typescript
{
  id: string                // 如 "PLT-20260325-001"
  tenantId: string          // 所属租户
  customer: string          // 客户名称
  summary: string           // 商品摘要
  amount: number            // 订单金额（元）
  paid: number              // 已收金额（元）
  status: 'pending' | 'partial' | 'paid' | 'expired' | 'credit'
  payType: '现款' | '账期'
  prints: number            // 打印次数
  creditDays: number | null // 账期天数
  creditDueDate: string | null
  date: string              // 订单日期
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

### 3.4 支付域

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

### 3.5 服务商域

**agents 表**

```typescript
{
  id: string
  tenantId: string
  name: string              // 服务商名称
  region: string            // 所属区域
  merchants: number         // 名下商户数
  gmv: number               // 流水金额
  rate: number              // 佣金率（%）
  commission: number        // 佣金金额
  status: 'active' | 'pending' | 'paused'
  createdAt: string
  updatedAt: string
}
```

**agent_settlements 表**（结算记录）

```typescript
{
  id: string
  agentId: string
  tenantId: string
  amount: number            // 结算金额
  period: string            // 结算周期
  settledAt: string
}
```

### 3.6 计费域

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
  status: '履约中' | '待续约' | '待签署' | '待归档'
  signLink: string | null
  smsSent: boolean
  createdAt: string
}
```

**invoices 表**

```typescript
{
  billNo: string            // 如 "INV-001"
  tenantId: string
  amount: string
  cycle: string             // 结算周期，如 "2026-03"
  status: '已开票' | '待开票' | '对账中'
  issuedAt: string | null
  createdAt: string
}
```

### 3.7 运维域

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
  status: '已发布' | '草稿'
  publishAt: string | null
  createdAt: string
  updatedAt: string
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
  createdAt: string
  updatedAt: string
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
  status: '已接入' | '试运行'
  score: string
}
```

### 建表汇总

| # | 表名 | 说明 | 关联的前端 |
|---|------|------|-----------|
| 1 | users | 用户账号 | Admin + Tenant |
| 2 | roles | 角色模板 | Admin + Tenant |
| 3 | permissions | 权限树 | Admin + Tenant |
| 4 | tenants | 租户 | Admin + Tenant |
| 5 | tenant_certifications | 资质审核 | Admin |
| 6 | orders | 订单 | Admin + Tenant + H5 |
| 7 | order_items | 订单行项目 | Tenant + H5 |
| 8 | payments | 收款流水 | Admin + Tenant |
| 9 | payment_orders | H5 支付单 | H5 + Tenant（核销） |
| 10 | agents | 服务商 | Admin + Tenant |
| 11 | agent_settlements | 结算记录 | Tenant |
| 12 | packages | 套餐定义 | Admin |
| 13 | contracts | 合同 | Admin |
| 14 | invoices | 账单 | Admin |
| 15 | notices | 系统公告 | Admin（写）+ Tenant（读） |
| 16 | tickets | 工单 | Admin + Tenant |
| 17 | audit_logs | 操作日志 | Admin |
| 18 | alert_rules | 告警规则 | Admin |
| 19 | security_policies | 安全策略 | Admin |
| 20 | ip_whitelist | IP 白名单 | Admin |
| 21 | period_policies | 周期策略 | Admin |
| 22 | system_configs | 系统配置 | Admin |
| 23 | service_configs | 服务接入配置 | Admin |
| 24 | service_providers | 外部服务商 | Admin |
| — | **合计** | **24 张表** | — |

---

## 四、端点清单

### 4.1 H5 端（客户支付）— 5 个端点

> 鉴权方式：无需登录，通过 orderNo 做资源级鉴权
> 路径前缀：`/pay`

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 1 | GET | `/pay/orders/{orderNo}` | 获取订单支付详情 | payment_orders + orders + order_items |
| 2 | POST | `/pay/orders/{orderNo}/confirm` | 发起在线支付（返回支付渠道参数） | payment_orders |
| 3 | POST | `/pay/orders/{orderNo}/offline-payment` | 线下支付登记（现金/其他已付） | payment_orders |
| 4 | GET | `/pay/orders/{orderNo}/status` | 轮询支付状态 | payment_orders |
| 5 | POST | `/pay/orders/{orderNo}/wx-jsapi` | 获取微信 JSAPI 支付参数（可选） | payment_orders |

**已确认的设计决策：**
- 路径统一 RESTful 风格 `/pay/orders/{orderNo}`
- `cash_verify`（现金核销）已移至 Tenant 端
- 在线支付拆分多步：confirm 返回支付渠道参数 → 前端唤起 SDK → status 轮询等待回调
- mock 环境下 confirm 返回 `channel: 'direct'` 直接完成，兼容测试

**支付时序：**

```
H5 前端                    后端                     支付网关
  │                        │                        │
  │  POST /confirm         │                        │
  │───────────────────────▶│                        │
  │  { channel, params }   │                        │
  │◀───────────────────────│                        │
  │                        │                        │
  │  唤起 SDK ─────────────────────────────────────▶│
  │                        │   异步回调              │
  │                        │◀───────────────────────│
  │                        │   更新 payment_orders   │
  │  GET /status (轮询)    │                        │
  │───────────────────────▶│                        │
  │  { status: 'paid' }   │                        │
  │◀───────────────────────│                        │
```

---

### 4.2 Tenant 端（商户 SaaS）— 47 个端点

> 鉴权方式：业务请求走 Bearer Access Token；Refresh Token 存于 HttpOnly Cookie，后端通过 token 中的 tenantId 自动隔离数据
> 角色：owner（老板）/ clerk（打单员）/ finance（财务）/ agent（服务商）

#### 模块 A：认证（Auth）— 4 个端点

| # | Method | Path | 说明 | 鉴权 | 关联表 |
|---|--------|------|------|------|--------|
| A1 | POST | `/auth/login` | 登录 | 免鉴权 | users |
| A2 | POST | `/auth/refresh` | 刷新令牌 | 免鉴权 | — |
| A3 | POST | `/auth/logout` | 登出 | 免鉴权 | — |
| A4 | GET | `/auth/me` | 当前用户信息 | 需鉴权 | users |

> 三端共用同一套 Auth，后端通过 user.tenantId 区分平台用户 / 租户用户。
> 登录仅返回 accessToken + user；`/auth/refresh` 与 `/auth/logout` 从 HttpOnly Refresh Cookie 读取会话。

#### 模块 B：订单管理（Orders）— 11 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| B1 | GET | `/orders` | 订单列表（分页+筛选） | all | orders |
| B2 | GET | `/orders/{id}` | 订单详情 | all | orders + order_items |
| B3 | POST | `/orders` | 创建订单 | owner, clerk | orders |
| B4 | PUT | `/orders/{id}` | 更新订单 | owner, clerk | orders |
| B5 | DELETE | `/orders/{id}` | 删除订单 | owner | orders |
| B6 | POST | `/orders/import` | Excel 导入（一步完成） | owner, clerk | orders |
| B7 | GET | `/orders/export` | 导出 Excel | owner, finance | orders |
| B8 | POST | `/orders/{id}/print` | 标记已打印 + 递增计数 | owner, clerk | orders |
| B9 | POST | `/orders/batch/print` | 批量打印标记 | owner, clerk | orders |
| B10 | POST | `/orders/{id}/remind` | 发送催款提醒 | owner, finance | orders |
| B11 | GET | `/orders/import/templates` | 获取导入模板列表 | owner, clerk | — (前端 localStorage) |

**B6 导入接口详细说明（已确认决策）：**
- Content-Type: `multipart/form-data`
- 字段映射由前端本地处理（XLSX.js 解析 + localStorage 模板）
- 请求参数：`file`（Excel）+ `mappings`（JSON 字段映射）+ `duplicateStrategy`（skip/overwrite）
- 响应：`{ importedCount, skippedCount, errorCount, errors[] }`

**订单列表筛选参数：**

```typescript
{
  page: number
  pageSize: number
  keyword?: string         // 搜索订单号、客户名
  status?: OrderStatus     // pending | partial | paid | expired | credit
  payType?: '现款' | '账期'
  dateFrom?: string        // YYYY-MM-DD
  dateTo?: string          // YYYY-MM-DD
}
```

#### 模块 C：支付与核销（Payment）— 3 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| C1 | GET | `/payments` | 本租户收款流水列表 | owner, finance | payments |
| C2 | GET | `/payments/summary` | 收款汇总统计 | owner, finance | payments |
| C3 | POST | `/orders/{id}/verify-cash` | 现金核销 | finance | payment_orders |

> C3 是从 H5 Payment 模块移过来的（已确认决策），由 Tenant 财务角色调用。

#### 模块 D：财务对账（Finance）— 3 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| D1 | GET | `/finance/summary` | 财务汇总（应收/已收/费率/净额） | owner, finance | orders + payments |
| D2 | GET | `/finance/reconciliation` | 对账明细列表 | owner, finance | orders + payments |
| D3 | GET | `/finance/reconciliation/export` | 导出对账单 | owner, finance | orders + payments |

#### 模块 E：账期管理（Credit）— 2 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| E1 | GET | `/orders/credit` | 账期订单列表 | owner, finance | orders |
| E2 | POST | `/orders/{id}/mark-received` | 标记回款 | owner, finance | orders + payments |

#### 模块 F：服务商管理（Agents）— 6 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| F1 | GET | `/agents` | 服务商列表 | owner, agent | agents |
| F2 | GET | `/agents/{id}` | 服务商详情 | owner, agent | agents |
| F3 | POST | `/agents` | 创建服务商 | owner | agents |
| F4 | PUT | `/agents/{id}` | 更新服务商 | owner | agents |
| F5 | POST | `/agents/{id}/settle` | 结算佣金 | owner | agents + agent_settlements |
| F6 | GET | `/agents/{id}/settlements` | 结算历史记录 | owner, agent | agent_settlements |

#### 模块 G：数据分析（Analytics）— 4 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| G1 | GET | `/analytics/daily-trend` | 日趋势 | all | orders + payments |
| G2 | GET | `/analytics/monthly-trend` | 月趋势 | all | orders + payments |
| G3 | GET | `/analytics/payments/live` | 实时收款动态 | all | payments |
| G4 | GET | `/analytics/dashboard` | 仪表盘聚合数据 | all | orders + payments + agents |

#### 模块 H：系统设置（Settings）— 12 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| H1 | GET | `/settings/roles` | 角色列表 | owner | roles |
| H2 | POST | `/settings/roles` | 创建自定义角色 | owner | roles |
| H3 | PUT | `/settings/roles/{id}` | 更新角色权限 | owner | roles |
| H4 | DELETE | `/settings/roles/{id}` | 删除自定义角色 | owner | roles |
| H5 | GET | `/settings/permissions` | 权限树 | owner | permissions |
| H6 | GET | `/settings/users` | 用户列表 | owner | users |
| H7 | POST | `/settings/users` | 创建用户 | owner | users |
| H8 | PUT | `/settings/users/{id}` | 更新用户 | owner | users |
| H9 | DELETE | `/settings/users/{id}` | 删除用户 | owner | users |
| H10 | PUT | `/settings/users/{id}/status` | 启用/禁用用户 | owner | users |
| H11 | GET | `/settings/general` | 获取通用配置（企业信息+通知） | owner | system_configs |
| H12 | PUT | `/settings/general` | 保存通用配置 | owner | system_configs |

#### 模块 I：通知（Notifications）— 2 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| I1 | GET | `/notifications` | 接收的平台公告列表 | all | notices |
| I2 | POST | `/notifications/{id}/read` | 标记已读 | all | notices（读取状态表） |

#### Tenant 端点汇总

| 模块 | 端点数 | 主要关联表 |
|------|--------|-----------|
| Auth | 4 | users |
| Orders | 11 | orders, order_items |
| Payment & 核销 | 3 | payments, payment_orders |
| Finance | 3 | orders, payments |
| Credit | 2 | orders, payments |
| Agents | 6 | agents, agent_settlements |
| Analytics | 4 | orders, payments |
| Settings | 12 | roles, permissions, users, system_configs |
| Notifications | 2 | notices |
| **合计** | **47** | — |

---

### 4.3 Admin 端（平台运营）— 72 个端点

> 鉴权方式：业务请求走 Bearer Access Token；Refresh Token 存于 HttpOnly Cookie；tenantId = null 表示平台用户
> 平台用户可跨租户查看和管理数据

#### 模块 1：认证（Auth）— 3 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 1.1 | POST | `/auth/login` | 平台账号登录 | users |
| 1.2 | POST | `/auth/refresh` | 刷新令牌 | — |
| 1.3 | POST | `/auth/logout` | 登出 | — |

#### 模块 2：控制台（Console）— 1 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 2.1 | GET | `/platform/console` | 侧边栏上下文（产品名、角色、操作人） | users |

#### 模块 3：仪表盘（Dashboard）— 5 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 3.1 | GET | `/platform/metrics` | 核心指标卡片 | tenants, orders, payments |
| 3.2 | GET | `/platform/todos` | 运营待办 | tenants, tickets |
| 3.3 | GET | `/platform/tenant-health` | 租户健康度 | tenants, users |
| 3.4 | GET | `/platform/risk-events` | 登录风险事件 | audit_logs, users |
| 3.5 | GET | `/platform/overview` | 数据总览（增长趋势+续费风险） | tenants, orders |

#### 模块 4：租户中心（Tenant Center）— 10 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 4.1 | GET | `/tenants` | 租户列表（分页+搜索+状态筛选+排序） | tenants |
| 4.2 | POST | `/tenants` | 创建租户（初始状态 onboarding） | tenants |
| 4.3 | POST | `/tenants/{id}/audit` | 审核（通过/驳回） | tenants |
| 4.4 | POST | `/tenants/batch/audit` | 批量审核 | tenants |
| 4.5 | POST | `/tenants/{id}/renew` | 续费（可变更套餐） | tenants, packages |
| 4.6 | POST | `/tenants/{id}/freeze` | 冻结/解冻 | tenants |
| 4.7 | POST | `/tenants/batch/freeze` | 批量冻结 | tenants |
| 4.8 | GET | `/tenants/members` | 组织架构成员列表（跨租户） | users, tenants |
| 4.9 | GET | `/tenants/certifications` | 资质审核队列 | tenant_certifications |
| 4.10 | POST | `/tenants/certifications/{id}/review` | 审核资质材料 | tenant_certifications |

#### 模块 5：用户管理（Users）— 6 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 5.1 | GET | `/users` | 用户列表（跨租户，支持搜索/筛选） | users |
| 5.2 | POST | `/users` | 创建用户 | users |
| 5.3 | PUT | `/users/{id}` | 更新用户 | users |
| 5.4 | DELETE | `/users/{id}` | 删除用户 | users |
| 5.5 | POST | `/users/{id}/status` | 变更状态（启用/禁用/锁定） | users |
| 5.6 | POST | `/users/{id}/reset-password` | 重置密码 | users |

#### 模块 6：订单管理（Orders）— 5 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 6.1 | GET | `/orders` | 订单列表（跨租户） | orders |
| 6.2 | POST | `/orders` | 手动创建 | orders |
| 6.3 | POST | `/orders/import` | Excel 导入（一步完成，同 Tenant） | orders |
| 6.4 | GET | `/orders/export` | 导出 Excel | orders |
| 6.5 | POST | `/orders/{id}/remind` | 催款通知 | orders |

> 已确认决策：移除原文档的 `/orders/import/confirm`，Admin 与 Tenant 统一一步导入。

#### 模块 7：收款记录（Payments）— 2 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 7.1 | GET | `/payments` | 收款流水（跨租户） | payments |
| 7.2 | GET | `/payments/summary` | 汇总统计 | payments |

#### 模块 8：财务对账（Reconciliation）— 3 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 8.1 | GET | `/reconciliation/summary` | 对账汇总指标 | orders, payments |
| 8.2 | GET | `/reconciliation/daily` | 日维度明细 | orders, payments |
| 8.3 | GET | `/reconciliation/export` | 导出对账单 | orders, payments |

#### 模块 9：套餐计费（Billing - Packages）— 4 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 9.1 | GET | `/billing/packages` | 套餐列表 | packages |
| 9.2 | POST | `/billing/packages` | 创建套餐 | packages |
| 9.3 | PUT | `/billing/packages/{id}` | 更新套餐 | packages |
| 9.4 | DELETE | `/billing/packages/{id}` | 删除套餐 | packages |

> 路径已从 `/packages` 统一为 `/billing/packages`。

#### 模块 10：合同管理（Billing - Contracts）— 2 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 10.1 | GET | `/billing/contracts` | 合同列表 | contracts |
| 10.2 | POST | `/billing/contracts` | 发起合同 | contracts |

#### 模块 11：账单发票（Billing - Invoices）— 1 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 11.1 | GET | `/billing/invoices` | 账单列表 | invoices |

#### 模块 12：服务商管理（Service Providers）— 1 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 12.1 | GET | `/service-providers` | 平台级服务商列表（只读监管） | service_providers |

#### 模块 13：系统公告（Notices）— 3 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 13.1 | GET | `/notices` | 公告列表 | notices |
| 13.2 | POST | `/notices` | 创建/发布公告 | notices |
| 13.3 | PUT | `/notices/{id}` | 更新公告 | notices |

#### 模块 14：工单管理（Tickets）— 2 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 14.1 | GET | `/tickets` | 工单列表 | tickets |
| 14.2 | GET | `/tickets/export` | 导出工单 | tickets |

#### 模块 15：角色管理（Security - Roles）— 4 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 15.1 | GET | `/security/roles` | 角色模板列表 | roles |
| 15.2 | POST | `/security/roles` | 创建角色模板 | roles |
| 15.3 | PUT | `/security/roles/{id}` | 更新角色 | roles |
| 15.4 | DELETE | `/security/roles/{id}` | 删除角色 | roles |

#### 模块 16：操作日志（Security - Audit Logs）— 1 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 16.1 | GET | `/security/audit-logs` | 操作审计日志（支持搜索+日期筛选） | audit_logs |

#### 模块 17：安全设置（Security - Settings）— 8 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 17.1 | GET | `/security/policies` | 安全策略列表 | security_policies |
| 17.2 | PUT | `/security/policies/{id}` | 切换策略启用状态 | security_policies |
| 17.3 | GET | `/security/ip-whitelist` | IP 白名单列表 | ip_whitelist |
| 17.4 | POST | `/security/ip-whitelist` | 新增白名单 | ip_whitelist |
| 17.5 | PUT | `/security/ip-whitelist/{id}` | 修改白名单 | ip_whitelist |
| 17.6 | DELETE | `/security/ip-whitelist/{id}` | 删除白名单 | ip_whitelist |
| 17.7 | GET | `/security/period-policies` | 周期策略 | period_policies |
| 17.8 | PUT | `/security/period-policies` | 保存周期策略 | period_policies |

#### 模块 18：告警规则（Ops - Alert Rules）— 5 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 18.1 | GET | `/ops/alert-rules` | 告警规则列表 | alert_rules |
| 18.2 | POST | `/ops/alert-rules` | 创建规则 | alert_rules |
| 18.3 | PUT | `/ops/alert-rules/{id}` | 更新规则 | alert_rules |
| 18.4 | POST | `/ops/alert-rules/{id}/toggle` | 切换启用状态 | alert_rules |
| 18.5 | DELETE | `/ops/alert-rules/{id}` | 删除规则 | alert_rules |

> 路径已从 `/ops-monitor/rules` 统一为 `/ops/alert-rules`。

#### 模块 19：系统配置（Ops - System Config）— 5 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 19.1 | GET | `/ops/system-configs` | 全局配置列表 | system_configs |
| 19.2 | GET | `/ops/service-configs` | 服务接入配置列表 | service_configs |
| 19.3 | POST | `/ops/service-configs` | 创建服务配置 | service_configs |
| 19.4 | PUT | `/ops/service-configs/{id}` | 更新服务配置 | service_configs |
| 19.5 | DELETE | `/ops/service-configs/{id}` | 删除服务配置 | service_configs |

#### Admin 端点汇总

| 模块 | 端点数 | 主要关联表 |
|------|--------|-----------|
| Auth | 3 | users |
| Console | 1 | users |
| Dashboard | 5 | tenants, orders, payments, audit_logs |
| Tenant Center | 10 | tenants, tenant_certifications |
| Users | 6 | users |
| Orders | 5 | orders |
| Payments | 2 | payments |
| Reconciliation | 3 | orders, payments |
| Billing (Packages) | 4 | packages |
| Billing (Contracts) | 2 | contracts |
| Billing (Invoices) | 1 | invoices |
| Service Providers | 1 | service_providers |
| Notices | 3 | notices |
| Tickets | 2 | tickets |
| Security (Roles) | 4 | roles |
| Security (Audit) | 1 | audit_logs |
| Security (Settings) | 8 | security_policies, ip_whitelist, period_policies |
| Ops (Alert Rules) | 5 | alert_rules |
| Ops (System Config) | 5 | system_configs, service_configs |
| **合计** | **71** | — |

---

## 五、全局汇总

### 端点统计

| 项目 | 端点数 | 鉴权方式 |
|------|--------|---------|
| H5 | 5 | orderNo 资源鉴权（免登录） |
| Tenant | 47 | Bearer Token（tenantId 自动隔离） |
| Admin | 71 | Bearer Token（tenantId=null，跨租户） |
| **合计** | **123** | — |

### 建表统计

| 域 | 表数 | 表名 |
|----|------|------|
| 用户与权限 | 3 | users, roles, permissions |
| 租户 | 2 | tenants, tenant_certifications |
| 订单 | 2 | orders, order_items |
| 支付 | 2 | payments, payment_orders |
| 服务商 | 2 | agents, agent_settlements |
| 计费 | 3 | packages, contracts, invoices |
| 运维 | 8 | notices, tickets, audit_logs, alert_rules, security_policies, ip_whitelist, period_policies, system_configs + service_configs |
| 外部服务 | 2 | service_providers, service_configs |
| **合计** | **24** | — |

### 已确认的关键设计决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | H5 路径风格 | 统一 RESTful `/pay/orders/{orderNo}` |
| 2 | 现金核销归属 | 移到 Tenant 端 `POST /orders/{id}/verify-cash` |
| 3 | 在线支付流程 | 多步：confirm 返回渠道参数 → status 轮询 → wx-jsapi/ali-trade 可选端点 |
| 4 | 订单导入 | 一步完成 `POST /orders/import`，字段映射前端处理 |

> 详细决策背景见 `docs/api-design-decisions.md`
