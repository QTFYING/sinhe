# Tenant 商户 SaaS 端 — API 接口契约文档

> 本文档为 Tenant（商户端）前后端接口契约依据，覆盖全部业务模块。
> 生成日期：2026-04-07

---

## 目录

1. [通用约定](#一通用约定)
2. [认证模块 Auth](#二认证模块-auth4-个端点)
3. [订单模块 Orders](#三订单模块-orders14-个端点)
4. [支付与核销 Payment](#四支付与核销-payment3-个端点)
5. [财务对账 Finance](#五财务对账-finance3-个端点)
6. [账期管理 Credit](#六账期管理-credit2-个端点)
7. [服务商模块 Agents](#七服务商模块-agents6-个端点)
8. [数据分析 Analytics](#八数据分析-analytics4-个端点)
9. [系统设置 Settings](#九系统设置-settings15-个端点)
10. [通知 Notifications](#十通知-notifications2-个端点)
11. [资质提交 Certification](#十一资质提交-certification2-个端点)
12. [数据流转架构](#十二数据流转架构)
13. [跨项目关联](#十三跨项目关联)

---

## 一、通用约定

> [!NOTE]
> **全局规范指引**
> 关于统一下发的 `code/data/message` 响应体包装、分页参数的请求与返回体指引、全局 `Http Status` 错误码机制以及环境拦截要求，本档内剔除重复声明，请直接翻阅架构大本营字典 **[api-architecture-overview.md](file:///d:/Sinhe/api/docs/api/api-architecture-overview.md)** 的第二章。

### 1.6 角色定义

```typescript
type Role = 'TENANT_OWNER' | 'TENANT_OPERATOR' | 'TENANT_FINANCE' | 'TENANT_VIEWER'
```

| 角色 | 中文名 | 说明 |
|------|--------|------|
| `TENANT_OWNER` | 老板 | 全部权限，包含员工配置与财务全览 |
| `TENANT_OPERATOR` | 打单员 | 处理订单导入、打印、发货及催款操作 |
| `TENANT_FINANCE` | 财务 | 负责现金线下核销、对账单审计处理 |
| `TENANT_VIEWER` | 访客 | 只读，用于审计与只读查看流水 |

---

## 二、认证模块 Auth（4 个端点）

> 源码：`features/auth/` + `@sinhe/shared/api/modules/auth`
> 三端（Admin / Tenant / H5）共用同一套 Auth，后端通过 `user.tenantId` 区分身份。

### 2.1 登录

- **POST** `/auth/login`
- **是否鉴权**：否（`skipAuth: true`）

**请求参数：**

```typescript
{
  username: string   // 登录账号
  password: string   // 密码
}
```

**响应 data：**

```typescript
{
  accessToken: string
  expiresIn: number          // 令牌有效期（秒）
  user: {
    id: string
    username: string
    realName: string
    role: Role
    tenantId: string | null  // 租户用户有值，平台用户为 null
  }
}
```

**Cookie：**

- 响应头通过 `Set-Cookie` 下发 `refreshToken`
- Cookie 属性：`HttpOnly`、`SameSite=Lax`
- HTTPS 场景优先使用 `__Host-refreshToken` + `Secure`

**前端标准化映射：**

```typescript
{
  token: string              // accessToken
  role: Role                 // 校验后的角色
  name: string               // realName || name || username
  source: 'mock' | 'remote' // 数据来源标记
}
```

### 2.2 刷新令牌

- **POST** `/auth/refresh`
- **是否鉴权**：否（`skipAuth: true`）
- **描述**：令牌过期前 5 分钟自动触发；401 时也会静默刷新一次并重放原请求

**请求参数：** 无 Body，服务端从 HttpOnly Refresh Cookie 读取 refreshToken

**响应 data：**

```typescript
{
  accessToken: string
  expiresIn: number
}
```

**Cookie：**

- 成功刷新后会轮换 refreshToken
- 响应头重新写入新的 HttpOnly Refresh Cookie

### 2.3 登出

- **POST** `/auth/logout`
- **是否鉴权**：否（跳过 401 处理）
- **描述**：服务端清理当前 refresh session，并清空 Refresh Cookie；若请求带有 accessToken，会一并加入黑名单

**请求参数：** 无 Body

**响应 data：** `null`

### 2.4 获取当前用户信息

- **GET** `/auth/me`
- **是否鉴权**：是

**响应 data：**

```typescript
{
  id: string
  username: string
  realName: string
  role: Role
  tenantId: string | null
}
```

---

## 三、订单模块 Orders（14 个端点）

> 源码：`features/orders/` + `@sinhe/shared/api/modules/order`
> 后端自动按当前用户的 tenantId 过滤，仅返回本租户数据。

### 类型定义

```typescript
type OrderStatus = 'pending' | 'partial' | 'paid' | 'expired' | 'credit'
type PayType = '现款' | '账期'

interface TenantOrder {
  id: string                   // 如 "PLT-20260325-001"
  customer: string             // 客户名称
  summary: string              // 商品摘要
  amount: number               // 订单金额（元）
  paid: number                 // 已收金额（元）
  status: OrderStatus          // 收款状态
  payType: PayType             // 付款方式
  prints: number               // 打印次数
  date: string                 // 下单时间
  voided: boolean              // 是否已作废（防物理删除）
  voidReason?: string          // 作废原因
  voidedAt?: string            // 作废时间
}
```

### 3.1 获取订单列表

- **GET** `/orders`
- **角色**：all

**请求参数（Query）：**

```typescript
{
  page?: number                // 默认 1
  pageSize?: number            // 默认 200
  keyword?: string             // 搜索订单号、客户名
  status?: OrderStatus         // 状态筛选
  payType?: PayType            // 付款方式筛选
  dateFrom?: string            // 开始日期 YYYY-MM-DD
  dateTo?: string              // 结束日期 YYYY-MM-DD
}
```

**响应 data：**

```typescript
{
  list: TenantOrder[]
  total: number
  page: number
  pageSize: number
}
```

### 3.2 获取单个订单

- **GET** `/orders/{id}`
- **角色**：all

**响应 data：** `TenantOrder`

### 3.3 创建订单

- **POST** `/orders`
- **角色**：owner, clerk

**请求参数：**

```typescript
{
  customer: string             // 客户名称（必填）
  summary?: string             // 商品摘要
  amount: number               // 订单金额（必填）
  paid?: number                // 已收金额，默认 0
  status?: OrderStatus         // 默认 'pending'
  payType?: PayType            // 默认 '现款'
  date?: string                // 不传则取当前时间
}
```

**响应 data：** `TenantOrder`

### 3.4 更新订单

- **PUT** `/orders/{id}`
- **角色**：owner, clerk

**请求参数：** `Partial<TenantOrder>`

**响应 data：** `TenantOrder`

### 3.5 作废订单

- **POST** `/orders/{id}/void`
- **角色**：owner, clerk
- **描述**：通过提供作废原因安全终结订单生命周期。一旦作废全链路生效不可逆。

**请求参数：**

```typescript
{
  voidReason: string // 作废理由（必填）
}
```

**响应 data：** `TenantOrder`

### 3.6 导入-数据预检校验

- **POST** `/import/preview`
- **角色**：owner, clerk
- **描述**：纯内存试算校验字段与格式合法性，不下发单据。
- **关联表**：无

### 3.7 异步正式导入

- **POST** `/orders/import`
- **角色**：owner, clerk
- **描述**：提交完整合法的数据推向后端处理队列
- **关联表**：orders

**响应 data：**

```typescript
{
  jobId: string
  submittedCount: number
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
}
```

### 3.8 轮询导入进度

- **GET** `/orders/import/jobs/{jobId}`
- **角色**：owner, clerk
- **描述**：用于轮询长耗时任务的执行成功率与返回报告
- **关联表**：import_jobs


### 3.9 标记已打印

- **POST** `/orders/{id}/print`
- **角色**：owner, clerk
- **描述**：标记单个订单为已打印，递增 prints 计数

**请求参数：** 无

**响应 data：**

```typescript
{
  id: string
  prints: number               // 更新后的打印次数
}
```

### 3.10 批量打印标记

- **POST** `/orders/batch/print`
- **角色**：owner, clerk
- **描述**：批量标记多个订单为已打印

**请求参数：**

```typescript
{
  ids: string[]                // 订单 ID 列表
}
```

**响应 data：**

```typescript
{
  successCount: number
}
```

### 3.11 发送催款提醒

- **POST** `/orders/{id}/remind`
- **角色**：owner, finance
- **描述**：对待收款/已逾期订单发送催款通知

**请求参数：**

```typescript
{
  channels?: string[]          // 通知渠道：["sms", "wechat"]，默认 ["sms"]
}
```

**响应 data：**

```typescript
{
  sent: boolean
  channels: string[]           // 实际发送的渠道
}
```

### 3.12 导入-获取模板列表

- **GET** `/import/templates`
- **角色**：owner, clerk
- **描述**：获取当前租户可用的 Excel 导入模板
- **关联表**：import_templates

### 3.13 导入-创建模板

- **POST** `/import/templates`
- **角色**：owner, clerk
- **关联表**：import_templates

### 3.14 导入-更新模板

- **PUT** `/import/templates/{id}`
- **角色**：owner, clerk
- **关联表**：import_templates

---

## 四、支付与核销 Payment（3 个端点）

> 此模块是 Tenant 与 H5 的核心关联点。客户在 H5 支付后，Tenant 端查看流水并核销。

### 类型定义

```typescript
interface PaymentRecord {
  id: string                   // 流水号，如 "PAY-20260330-001"
  orderId: string              // 关联订单号
  customer: string             // 客户名称
  amount: number               // 收款金额（元）
  channel: string              // 支付通道：微信支付 | 支付宝 | 现金 | 其他
  fee: number                  // 手续费（元）
  net: number                  // 到账金额（元）= amount - fee
  status: 'success' | 'partial' | 'pending'
  paidAt: string               // 收款时间
}
```

### 4.1 获取收款流水列表

- **GET** `/payments`
- **角色**：owner, finance

**请求参数（Query）：**

```typescript
{
  page?: number
  pageSize?: number
  keyword?: string             // 搜索订单号、客户
  channel?: string             // 支付通道筛选
}
```

**响应 data：**

```typescript
{
  list: PaymentRecord[]
  total: number
  page: number
  pageSize: number
}
```

### 4.2 获取收款汇总统计

- **GET** `/payments/summary`
- **角色**：owner, finance

**响应 data：**

```typescript
{
  totalAmount: number          // 今日收款总额（元）
  totalFee: number             // 手续费合计（元）
  totalNet: number             // 实际到账（元）
  totalCount: number           // 流水总笔数
  abnormalCount: number        // 异常流水笔数
}
```

### 4.3 现金核销

- **POST** `/orders/{id}/verify-cash`
- **角色**：finance
- **描述**：对 H5 端提交的现金支付订单进行核销确认，状态从 `pending_verification` 变为 `paid`

**请求参数：** 无

**响应 data：**

```typescript
{
  orderId: string
  status: 'paid'
  verifiedAt: string           // 核销时间
}
```

**业务规则：**
- 仅 `pending_verification` 状态的订单可以核销
- 核销后，H5 端再次打开该订单页面将看到"订单已完成"
- 同时在 payments 表生成一条 channel=现金 的收款记录

**数据流：**

```
H5 客户选择"现金支付" → payment_orders.status = pending_verification
                                    ↓
Tenant 财务 POST /orders/{id}/verify-cash
                                    ↓
              payment_orders.status = paid + payments 新增一条记录
                                    ↓
              H5 客户再次打开页面 → 看到"订单已完成"
```

---

## 五、财务对账 Finance（3 个端点）

> 源码：`features/finance/`
> 提供本租户维度的财务汇总和对账明细。

### 5.1 获取财务汇总

- **GET** `/finance/summary`
- **角色**：owner, finance

**响应 data：**

```typescript
{
  totalReceivable: number      // 本期应收总额（元）
  totalReceived: number        // 已收金额（元）
  totalFee: number             // 手续费合计（元），费率约 0.25%
  totalNet: number             // 净到账（元）= totalReceived - totalFee
  collectionRate: number       // 回款率（%）= totalReceived / totalReceivable × 100
  creditOrderCount: number     // 账期订单数
  orderCount: number           // 订单总数
}
```

### 5.2 获取对账明细

- **GET** `/finance/reconciliation`
- **角色**：owner, finance

**请求参数（Query）：**

```typescript
{
  page?: number
  pageSize?: number
}
```

**响应 data：**

```typescript
{
  list: Array<{
    orderId: string            // 订单号
    customer: string           // 客户名称
    amount: number             // 订单金额（元）
    net: number                // 到账金额（元）
    fee: number                // 手续费（元）
    channel: string            // 支付通道，如 "拉卡拉"
    paidAt: string             // 到账时间
    status: '已核销' | '待核销' | '异常'
  }>
  total: number
  page: number
  pageSize: number
}
```

### 5.3 导出对账单

- **GET** `/finance/reconciliation/export`
- **角色**：owner, finance
- **Content-Type**：`application/octet-stream`

**响应**：Excel 文件流

---

## 六、账期管理 Credit（2 个端点）

> 源码：`features/finance/`（信用管理子页面）
> 管理 payType=账期 的订单，跟踪到期和逾期情况。

### 6.1 获取账期订单列表

- **GET** `/orders/credit`
- **角色**：owner, finance

**请求参数（Query）：**

```typescript
{
  page?: number
  pageSize?: number
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                 // 订单号
    customer: string           // 客户名称
    amount: number             // 订单金额（元）
    date: string               // 下单日期
    creditDays: number         // 账期天数，如 30
    dueDate: string            // 到期日期
    creditStatus: 'normal' | 'soon' | 'today' | 'overdue'
  }>
  total: number
  page: number
  pageSize: number
}
```

**状态说明：**

| creditStatus | 中文 | 颜色 | 规则 |
|-------------|------|------|------|
| `overdue` | 逾期 | 红 | 超过 dueDate |
| `today` | 今日到期 | 橙 | dueDate = 今天 |
| `soon` | 即将到期 | 蓝 | dueDate 在未来 7 天内 |
| `normal` | 正常 | 灰 | dueDate 在 7 天之后 |

### 6.2 标记回款

- **POST** `/orders/{id}/mark-received`
- **角色**：owner, finance
- **描述**：将账期订单标记为已收款

**请求参数：**

```typescript
{
  amount?: number              // 回款金额（可选，不传则全额回款）
  remark?: string              // 备注
}
```

**响应 data：**

```typescript
{
  orderId: string
  status: OrderStatus          // 全额回款→'paid'，部分回款→'partial'
  paid: number                 // 更新后的已收金额
}
```

---



---

## 七、数据分析 Analytics（4 个端点）

> 源码：`features/analytics/` + `@sinhe/shared/api/modules/analytics`
> 全部数据自动按当前租户过滤。

### 类型定义

```typescript
interface DailyTrend {
  day: string                  // 格式 'MM-DD'
  应收: number                 // 应收金额（元）
  实收: number                 // 实收金额（元）
}

interface MonthlyTrend {
  month: string                // 格式 'M月'
  应收: number
  实收: number
}

interface LiveFeedEntry {
  time: string                 // 格式 'HH:mm'
  customer: string             // 客户名称
  amount: number               // 支付金额（元）
  status: string               // 支付状态：paid | partial | pending
}
```

### 8.1 获取日趋势

- **GET** `/analytics/daily-trend`
- **角色**：all
- **描述**：近 7 天的日维度应收/实收趋势

**响应 data：** `DailyTrend[]`

### 8.2 获取月趋势

- **GET** `/analytics/monthly-trend`
- **角色**：all
- **描述**：近 N 个月的月维度应收/实收趋势

**响应 data：** `MonthlyTrend[]`

### 8.3 获取实时收款动态

- **GET** `/analytics/payments/live`
- **角色**：all
- **描述**：今日实时收款流水列表

**响应 data：** `LiveFeedEntry[]`

### 8.4 获取仪表盘聚合数据

- **GET** `/analytics/dashboard`
- **角色**：all
- **描述**：首页仪表盘所需的聚合数据，一次请求返回，减少多接口拼装

**响应 data：**

```typescript
{
  // 今日收款概览
  todayReceivable: number      // 今日应收（元）
  todayReceived: number        // 今日已收（元）
  todayPending: number         // 今日待收（元）
  collectionRate: number       // 回款率（%）

  // 待办数量
  pendingPrintCount: number    // 待打印订单数
  creditDueSoonCount: number   // 本周到期账期数
  partialPaymentCount: number  // 待确认部分付款数

  // 角色定制标题
  roleTitle: string            // 根据角色返回不同标题
  // owner → "今日收款总览"
  // clerk → "今日打单任务"
  // finance → "财务对账中心"
  // agent → "我的业绩总览"
}
```

---

## 八、系统设置 Settings（12 个端点）

> 源码：`features/settings/` + `@sinhe/shared/api/modules/settings`
> 仅 owner 角色可访问（系统设置页面整体受角色控制）。

### 类型定义

```typescript
interface TenantSettingsUser {
  id: string
  name: string                 // 姓名
  account: string              // 登录账号
  role: Role                   // 可多角色时为主角色
  phone: string                // 手机号
  status: 'active' | 'disabled'
  lastLogin: string            // 最后登录时间，如 "2026-03-25 11:30"
}

interface TenantRoleAccount {
  id: string
  name: string                 // 角色名称
  description?: string         // 角色描述
  permissions: string[]        // 权限 ID 列表
  isSystem: boolean            // 是否系统内置角色
  userCount: number            // 关联用户数
}

interface PermissionNode {
  id: string
  label: string                // 权限名称
  children?: PermissionNode[]  // 子权限
}

interface TenantGeneralSettings {
  // 企业信息
  companyName: string          // 企业名称
  contactPerson: string        // 联系人
  contactPhone: string         // 联系电话
  address: string              // 企业地址
  licenseNo: string            // 营业执照号

  // 通知设置
  qrCodeExpiry: number         // 收款码有效期（天）：30 | 60 | 90
  notifySeller: boolean        // 收款成功通知业务员
  notifyOwner: boolean         // 收款成功通知老板
  notifyFinance: boolean       // 收款成功通知财务
  creditRemindDays: number     // 账期到期提醒提前天数：1 | 3 | 5 | 7 | 14
  dailyReportPush: boolean     // 每日收款日报推送（18:00）
}
```

### 8.1 获取角色列表

- **GET** `/settings/roles`
- **角色**：owner
- **描述**：一期使用固化角色，本接口仅提供供UI展示的基础配置字典。

**响应 data：** `TenantRoleAccount[]`

### 8.2 获取权限树

- **GET** `/settings/permissions`
- **角色**：owner
- **描述**：返回完整硬编码的权限树结构，仅供展示使用，一期无动态分配权。

**响应 data：** `PermissionNode[]`

**权限树结构示例：**

```
- 首页（查看收款总览、实时收款动态）
- 订单管理（查看订单列表、导入订单、打印订单）
- 打印中心（查看打印队列、执行打印）
- 财务报表（查看收款报表、对账明细、账期管理、导出报表）
- 系统设置（基础设置、打印机设置、角色管理、用户管理）
```

### 8.3 获取用户列表

- **GET** `/settings/users`
- **角色**：owner

**响应 data：** `TenantSettingsUser[]`

### 8.4 创建用户

- **POST** `/settings/users`
- **角色**：owner

**请求参数：**

```typescript
{
  name: string                 // 姓名（必填）
  phone: string                // 手机号 / 登录账号（必填）
  role: Role                   // 角色（必填）
  password?: string            // 密码，默认 "123456"
}
```

**响应 data：** `TenantSettingsUser`

**校验规则：**
- `phone` 在本租户内唯一（作为登录账号）
- 新建用户初始状态为 `active`

### 8.5 更新用户

- **PUT** `/settings/users/{id}`
- **角色**：owner

**请求参数：** `Partial<TenantSettingsUser>`

**响应 data：** `TenantSettingsUser`

### 8.6 删除用户

- **DELETE** `/settings/users/{id}`
- **角色**：owner

**响应 data：** `null`

**校验规则：**
- owner 角色用户不可删除自己
- 实际为软删除

### 8.7 启用/禁用用户

- **PUT** `/settings/users/{id}/status`
- **角色**：owner
- **描述**：切换用户的启用/禁用状态

**请求参数：**

```typescript
{
  status: 'active' | 'disabled'
}
```

**响应 data：** `TenantSettingsUser`

### 8.8 获取通用配置

- **GET** `/settings/general`
- **角色**：owner
- **描述**：获取企业信息 + 通知设置

**响应 data：** `TenantGeneralSettings`

### 8.9 保存通用配置

- **PUT** `/settings/general`
- **角色**：owner

**请求参数：** `Partial<TenantGeneralSettings>`

**响应 data：** `TenantGeneralSettings`

### 8.10 获取打印配置

- **GET** `/settings/printer`
- **角色**：owner
- **描述**：获取打印模板、纸张规格、字段布局等配置

**响应 data：**

```typescript
{
  templates: Array<{
    id: number
    name: string               // 模板名称
    paperWidth: number         // 纸张宽度 (mm)
    paperHeight: number        // 纸张高度 (mm)
    fields: PrintFieldConfig[] // 字段布局列表
    isDefault: boolean         // 是否为默认模板
  }>
  activeTemplateId: number     // 当前激活模板 ID
}
```

```typescript
interface PrintFieldConfig {
  id: string
  key: string                  // 字段标识（如 "orderNo", "customerName"）
  label: string                // 字段显示名
  x: number                   // X 坐标 (mm)
  y: number                   // Y 坐标 (mm)
  w: number                   // 宽度 (mm)
  h: number                   // 高度 (mm)
  fontSize: number             // 字号
  bold: boolean
  align: 'left' | 'center' | 'right'
  showLabel: boolean           // 是否显示字段标签
}
```

### 8.11 保存打印配置

- **PUT** `/settings/printer`
- **角色**：owner
- **描述**：保存完整打印配置（模板、字段布局、纸张规格）

**请求参数：** 同 8.10 响应 data 结构

**响应 data：** 同 8.10 响应 data 结构

### 8.12 获取操作日志

- **GET** `/settings/audit-logs`
- **角色**：owner
- **描述**：查看本租户操作日志（tenantId 自动隔离）

**请求参数（Query）：**

```typescript
{
  page: number
  pageSize: number
  startDate?: string           // 筛选起始日期 YYYY-MM-DD
  endDate?: string             // 筛选结束日期 YYYY-MM-DD
  operator?: string            // 操作人姓名（模糊搜索）
}
```

```typescript
interface AuditLogRecord {
  id: string
  action: string               // 操作描述，如 "导入订单"、"修改角色权限"
  operator: string             // 操作人
  ip: string                   // 操作 IP
  createdAt: string            // 操作时间
}
```

**响应 data：**

```typescript
{
  list: AuditLogRecord[]
  total: number
}
```

---

## 九、通知 Notifications（2 个端点）

> Tenant 是公告的**接收方**，Admin 是发布方。

### 类型定义

```typescript
interface NotificationRecord {
  id: string
  title: string
  content: string
  publishAt: string
  isRead: boolean
}
```

### 9.1 获取平台公告列表

- **GET** `/notifications`
- **角色**：all
- **描述**：获取平台发布的、当前租户可见的公告列表

**请求参数（Query）：**

```typescript
{
  page?: number
  pageSize?: number
}
```

**响应 data：**

```typescript
{
  list: NotificationRecord[]
  total: number
  page: number
  pageSize: number
}
```

### 9.2 标记公告已读

- **POST** `/notifications/{id}/read`
- **角色**：all

**请求参数：** 无

**响应 data：** `null`

---

## 十、资质提交 Certification（2 个端点）

> Tenant 提交资质材料，Admin 在 `/tenants/certifications/{id}/review` 进行审核。

### 类型定义

```typescript
type QualificationStatus = 'pending' | 'approved' | 'rejected'

interface QualificationSubmitRequest {
  licenseUrl: string
  legalPerson: string
  legalIdCard: string
  contactPhone: string
  remark?: string
}

interface QualificationStatusResult {
  certId: string | null
  status: QualificationStatus | null
  submittedAt: string | null
  reviewedAt: string | null
  reviewComment?: string | null
  rejectReason: string | null
}
```

### 10.1 提交资质材料

- **POST** `/tenants/certification`
- **描述**：提交当前租户的资质认证材料
- **关联表**：tenant_certifications

**请求参数：** `QualificationSubmitRequest`

**响应 data：**

```typescript
{
  certId: string               // 认证记录 ID
  status: 'pending'            // 提交后状态为待审核
  submittedAt: string
}
```

### 10.2 查询资质状态

- **GET** `/tenants/certification`
- **描述**：查询当前租户的资质认证状态
- **关联表**：tenant_certifications

**响应 data：**

**响应 data：** `QualificationStatusResult`

---

## 十一、数据流转架构

```
┌─────────────┐
│  UI 组件    │  pages/ + features/*/components/
└──────┬──────┘
       │
┌──────▼──────┐
│  Hook       │  use-auth / use-orders / use-agents / use-analytics ...
│  (ahooks)   │  useRequest 封装，自动管理 loading/error/data
└──────┬──────┘
       │
┌──────▼──────┐
│  Repository │  auth.repository / order.repository / agent.repository ...
│             │  统一返回 { data: T, source: 'mock' | 'remote' }
└──────┬──────┘
       │
┌──────▼──────┐
│  Mapper     │  auth.mapper / order.mapper / agent.mapper ...
│             │  API 响应 → 前端类型标准化
└──────┬──────┘
       │
┌──────▼──────┐
│  API Module │  @sinhe/shared/api/modules/*
│             │  axios 请求封装，统一拦截器
└──────┬──────┘
       │
┌──────▼──────┐
│  Request    │  @sinhe/shared/api/request
│  拦截器     │  ├─ 请求：注入 Authorization / X-Proxy-Env
│             │  └─ 响应：校验 code === 0，处理 401/403
└─────────────┘
```

### Token 生命周期

1. **登录成功** → 响应体返回 `accessToken`，前端仅保存在内存；响应头通过 `Set-Cookie` 写入 HttpOnly Refresh Cookie
2. **每次业务请求** → 请求拦截器从内存读取 accessToken，并注入 `Authorization` 头
3. **页面刷新后恢复会话** → 启动期调用 `POST /auth/refresh`，依赖 Cookie 换取新的 accessToken
4. **Token 刷新** → 过期前 5 分钟自动调用 `POST /auth/refresh`，成功后重排下一次刷新
5. **401/403** → 先静默刷新一次并重试；仍失败时触发 `auth:unauthorized`，清理本地会话并跳转登录

### 数据来源检测

- **环境键**: `localStorage['sinhe-proxy-env']`
  - `'me'` → Mock 数据（默认）
  - 其他值 → 远程接口
- 每个 Hook 返回值均包含 `source: 'mock' | 'remote'` 字段，用于 UI 显示数据来源

---

## 十二、跨项目关联

### 与 H5 端的关联

| Tenant 操作 | 关联的 H5 端行为 |
|-------------|-----------------|
| 创建订单 → 生成收款码链接 | H5 通过 qrCodeToken 打开支付页面 |
| 财务核销 `POST /orders/{id}/verify-cash` | H5 端现金支付订单状态从 `pending_verification` → `paid` |
| 收款流水 `GET /payments` | 包含 H5 在线支付成功后生成的记录 |

### 与 Admin 端的关联

| Tenant 数据 | Admin 端可见性 |
|-------------|---------------|
| 本租户订单 | Admin `GET /orders` 跨租户汇总中可见 |
| 本租户收款 | Admin `GET /payments` 跨租户流水中可见 |
| 本租户服务商 | Admin `GET /service-providers` 监管视角中可见 |
| 本租户用户 | Admin `GET /users` 跨租户用户列表中可见 |
| 接收 Admin 发布的公告 | Admin `POST /notices` 创建的公告推送到 Tenant |

---

## 接口汇总

| 模块 | 接口数 | 方法分布 |
|------|--------|---------|
| 认证 Auth | 4 | POST ×3, GET ×1 |
| 订单 Orders | 14 | GET ×4, POST ×8, PUT ×2 |
| 支付与核销 Payment | 3 | GET ×2, POST ×1 |
| 财务对账 Finance | 3 | GET ×3 |
| 账期管理 Credit | 2 | GET ×1, POST ×1 |
| 数据分析 Analytics | 4 | GET ×4 |
| 系统设置 Settings | 12 | GET ×6, POST ×1, PUT ×4, DELETE ×1 |
| 通知 Notifications | 2 | GET ×1, POST ×1 |
| 资质提交 Certification | 2 | GET ×1, POST ×1 |
| **合计** | **46** | GET ×23, POST ×16, PUT ×6, DELETE ×1 |

| 关联数据库表 | 说明 |
|-------------|------|
| users | 用户管理（本租户） |
| roles | 角色管理（本租户） |
| permissions | 权限树 |
| orders | 订单（本租户） |
| order_items | 订单行项目 |
| payments | 收款流水（本租户） |
| payment_orders | H5 支付单（核销关联） |
| system_configs | 通用配置 |
| notices | 平台公告（读取） |
| tenant_certifications | 资质认证记录 |
