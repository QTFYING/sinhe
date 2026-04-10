# Admin 平台运营后台 — API 接口契约文档

> 本文档为 Admin（平台运营后台）前后端接口契约依据，覆盖全部业务模块。
> 生成日期：2026-04-07

---

## 目录

1. [通用约定](#一通用约定)
2. [认证 Auth](#二认证-auth4-个端点)
3. [控制台 Console](#三控制台-console1-个端点)
4. [仪表盘 Dashboard](#四仪表盘-dashboard5-个端点)
5. [租户中心 Tenant Center](#五租户中心-tenant-center10-个端点)
6. [用户管理 Users](#六用户管理-users6-个端点)
7. [订单管理 Orders](#七订单管理-orders2-个端点)
8. [收款记录 Payments](#八收款记录-payments2-个端点)
9. [财务对账 Reconciliation](#九财务对账-reconciliation3-个端点)
10. [套餐计费 Billing - Packages](#十套餐计费-billing---packages4-个端点)
11. [合同管理 Billing - Contracts](#十一合同管理-billing---contracts5-个端点)
12. [账单发票 Billing - Invoices](#十二账单发票-billing---invoices3-个端点)
13. [服务商管理 Service Providers](#十三服务商管理-service-providers4-个端点)
14. [系统公告 Notices](#十四系统公告-notices4-个端点)
15. [工单管理 Tickets](#十五工单管理-tickets5-个端点)
16. [角色管理 Security - Roles](#十六角色管理-security---roles4-个端点)
17. [操作日志 Security - Audit Logs](#十七操作日志-security---audit-logs1-个端点)
18. [安全设置 Security - Settings](#十八安全设置-security---settings8-个端点)
19. [告警规则 Ops - Alert Rules](#十九告警规则-ops---alert-rules5-个端点)
20. [系统配置 Ops - System Config](#二十系统配置-ops---system-config5-个端点)
21. [跨项目关联](#二十一跨项目关联)

---

## 一、通用约定

> [!NOTE]
> **全局规范指引**
> 关于统一下发的 `code/data/message` 响应体包装、分页参数的详细数据结构、金额传输要求与全局 `Http Status` 错误码等基础要素，在此单据内不再赘言，敬请直接调阅大本营总纲 **[api-architecture-overview.md]** 全局规范板块。
> 枚举命名与取值统一参见 **[../enums/enum-manual.md](../enums/enum-manual.md)**，本档优先引用统一枚举名。

### 路径前缀规范

| 前缀 | 域 | 说明 |
|------|-----|------|
| `/auth/*` | 认证 | 三端共用 |
| `/platform/*` | 平台 | Admin 专属聚合数据（仪表盘、控制台） |
| `/tenants/*` | 租户 | 租户生命周期管理 |
| `/users/*` | 用户 | 跨租户用户管理 |
| `/orders/*` | 订单 | 跨租户订单管理 |
| `/payments/*` | 收款 | 跨租户收款流水 |
| `/reconciliation/*` | 对账 | 财务对账 |
| `/billing/*` | 计费 | 套餐、合同、账单 |
| `/security/*` | 安全 | 角色、审计日志、安全策略 |
| `/ops/*` | 运维 | 告警规则、系统配置 |
| `/notices/*` | 公告 | 系统公告管理 |
| `/tickets/*` | 工单 | 工单管理 |
| `/service-providers/*` | 服务商 | 外部服务商监管 |

---

## 二、认证 Auth（4 个端点）

> 与 Tenant 端共用同一套 Auth。平台用户 `tenantId = null`。

### 2.1 登录

- **POST** `/auth/login`
- **是否鉴权**：否（`skipAuth: true`）

**请求参数：**

```typescript
{
  username: string       // 平台账号
  password: string       // 密码
}
```

**响应 data：**

```typescript
{
  accessToken: string          // 访问令牌
  expiresIn: number           // 令牌有效期（秒）
  user: {
    id: string                // 用户 ID
    username: string          // 登录账号
    realName: string          // 用户姓名
    role: string              // 当前角色
    tenantId: string | null   // 平台账号为 null
  }
}
```

**Cookie：**

- 响应头通过 `Set-Cookie` 下发 `refreshToken`
- Cookie 属性：`HttpOnly`、`SameSite=Lax`
- HTTPS 场景优先使用 `__Host-refreshToken` + `Secure`

### 2.2 刷新令牌

- **POST** `/auth/refresh`
- **是否鉴权**：否（`skipAuth: true`）
- **描述**：令牌过期前 5 分钟自动触发；401 时也会静默刷新一次并重放原请求

**请求参数：** 无 Body，服务端从 HttpOnly Refresh Cookie 读取 refreshToken

**响应 data：**

```typescript
{
  accessToken: string         // 新的访问令牌
  expiresIn: number           // 新令牌有效期（秒）
}
```

**Cookie：**

- 成功刷新后会轮换 refreshToken
- 响应头重新写入新的 HttpOnly Refresh Cookie

### 2.3 退出登录

- **POST** `/auth/logout`
- **是否鉴权**：否（`skipAuth: true`）
- **描述**：服务端清理当前 refresh session，并清空 Refresh Cookie；若请求带有 accessToken，会一并加入黑名单

**请求参数：** 无 Body

**响应 data：** `null`

### 2.4 获取当前用户信息

- **GET** `/auth/me`
- **是否鉴权**：是

**响应 data：**

```typescript
{
  id: string                  // 当前用户 ID
  username: string            // 登录账号
  realName: string            // 用户姓名
  role: string                // 当前角色
  tenantId: string | null     // 平台账号为 null
}
```

---

## 三、控制台 Console（1 个端点）

### 3.1 获取控制台上下文

- **GET** `/platform/console`
- **描述**：获取当前登录用户的控制台元数据，用于侧边栏展示
- **关联表**：users

**响应 data：**

```typescript
{
  productName: string        // "收单吧"
  suiteName: string          // "平台运营后台"
  scopeLabel: string         // "平台视角"
  operator: string           // 当前操作人姓名
  role: string               // 当前角色名称
  currentTenant: string      // 当前租户名称，平台用户为 "—"
}
```

---

## 四、仪表盘 Dashboard（5 个端点）

### 4.1 获取平台核心指标

- **GET** `/platform/metrics`
- **描述**：仪表盘顶部的核心指标卡片数据
- **关联表**：tenants, orders, payments

**响应 data：**

```typescript
Array<{
  label: string             // 指标名称，如 "租户开通进度"
  value: string             // 指标值，如 "2 个待上线"
  helper: string            // 辅助说明
  tone: string              // 色调标识: "blue" | "emerald" | "amber" | "rose"
}>
```

### 4.2 获取平台待办事项

- **GET** `/platform/todos`
- **描述**：运营待办列表
- **关联表**：tenants, tickets

**响应 data：**

```typescript
Array<{
  title: string             // 待办标题
  detail: string            // 详细描述
  owner: string             // 负责人
  priority: string          // 优先级标识
}>
```

### 4.3 获取租户健康度

- **GET** `/platform/tenant-health`
- **描述**：租户健康度看板数据，用于表格展示
- **关联表**：tenants, users

**响应 data：**

```typescript
Array<{
  tenant: string            // 租户名称
  health: number            // 健康度百分比 0-100
  userCoverage: string      // 账号覆盖情况描述
  exception: string         // 异常提示
  owner: string             // 负责人
}>
```

### 4.4 获取登录风险事件

- **GET** `/platform/risk-events`
- **描述**：近期安全风险告警
- **关联表**：audit_logs, users

**响应 data：**

```typescript
Array<{
  account: string           // 涉事账号
  tenant: string            // 所属租户
  event: string             // 事件描述
  time: string              // 发生时间
  level: '高' | '中' | '低'
}>
```

### 4.5 获取平台数据总览

- **GET** `/platform/overview`
- **描述**：平台数据总览页的汇总数据（租户增长趋势、续费风险等）
- **关联表**：tenants, orders

**响应 data：**

```typescript
{
  totalFlow: number              // 平台总流水（元）
  totalTenants: number           // 租户总数
  newTenantsThisMonth: number    // 本月新增租户数
  healthScore: number            // 平台健康度

  growth: {
    newTenants: number           // 新增租户
    trialToFormal: number        // 试用转正式
    churnWarning: number         // 流失预警数
    dailyTrend: number[]         // 近 7 日每日新增租户数
  }

  renewalRisks: Array<{
    tenantName: string           // 租户名称
    dueInDays: number            // 距到期天数
    owner: string                // 负责人
  }>
}
```

---

## 五、租户中心 Tenant Center（10 个端点）

### 类型定义

```typescript
type TenantStatus = 'active' | 'onboarding' | 'attention' | 'paused'
type TenantSortField = 'name' | 'packageName' | 'status' | 'dueInDays'
type SortOrder = 'asc' | 'desc'
type ReviewAction = 'approve' | 'reject'
type FreezeAction = 'freeze' | 'unfreeze'

interface TenantRecord {
  id: string                   // 如 "TEN-001"
  name: string                 // 租户名称
  packageName: string          // 套餐名称: "基础版" | "标准版" | "旗舰版"
  admin: string                // 管理员姓名，未分配时为 "待分配"
  region: string               // 地区
  channels: string[]           // 支付通道列表
  merchants: number            // 商户数
  users: number                // 账号数
  monthlyFlow: number          // 本月流水（元）
  dueInDays: number            // 距到期天数，0 表示已到期
  lastActiveAt: string         // 最近活跃时间
  status: TenantStatus           // 租户状态
}
```

### 5.1 获取租户列表

- **GET** `/tenants`
- **关联表**：tenants

**请求参数（Query）：**

```typescript
{
  page: number                   // 页码
  pageSize: number               // 每页条数
  keyword?: string            // 搜索关键词（匹配租户名称、ID、管理员）
  status?: TenantStatus       // 状态筛选
  sortBy?: TenantSortField // 排序字段
  sortOrder?: SortOrder   // 排序方向
}
```

**响应 data：**

```typescript

{
  list: Array<{
    id: string                  // 租户 ID
    name: string                // 租户名称
    packageName: string         // 套餐名称
    admin: string               // 管理员姓名
    region: string              // 地区
    channels: string[]          // 支付通道列表
    merchants: number           // 商户数
    users: number               // 账号数
    monthlyFlow: number         // 本月流水（元）
    dueInDays: number           // 距到期天数
    lastActiveAt: string        // 最近活跃时间
    status: TenantStatus        // 租户状态
  }>
  total: number                 // 租户总数
}
```

### 5.2 创建租户

- **POST** `/tenants`
- **描述**：新建租户，初始状态为 `onboarding`（待审核）
- **关联表**：tenants

**请求参数：**

```typescript
{
  name: string                 // 租户名称（必填）
  packageName: string          // 套餐版本（必填）
  admin: string                // 管理员姓名（必填）
  region: string               // 地区（必填）
  channel: string              // 初始支付通道（必填）
  dueInDays: number            // 初始有效天数（必填）
}
```

**响应 data：**

```typescript
{
  id: string                   // 租户 ID
  name: string                 // 租户名称
  packageName: string          // 套餐名称
  admin: string                // 管理员姓名
  region: string               // 地区
  channels: string[]           // 已开通支付通道列表
  merchants: number            // 商户数
  users: number                // 账号数
  monthlyFlow: number          // 本月流水（元）
  dueInDays: number            // 距到期天数
  lastActiveAt: string         // 最近活跃时间
  status: TenantStatus         // 租户状态
}
```

### 5.3 审核租户

- **POST** `/tenants/{id}/audit`
- **描述**：对待审核租户进行审批（通过 / 驳回）
- **关联表**：tenants

**请求参数：**

```typescript
{
  action: ReviewAction         // 审核动作
  reviewNote?: string          // 审核备注（通过时可选）
  rejectReason?: string        // 驳回原因（驳回时必填）
}
```

**响应 data：**

```typescript
{
  id: string                   // 租户 ID
  name: string                 // 租户名称
  packageName: string          // 套餐名称
  admin: string                // 管理员姓名
  region: string               // 地区
  channels: string[]           // 已开通支付通道列表
  merchants: number            // 商户数
  users: number                // 账号数
  monthlyFlow: number          // 本月流水（元）
  dueInDays: number            // 距到期天数
  lastActiveAt: string         // 最近活跃时间
  status: TenantStatus         // 租户状态
}
```

**业务规则：**
- `approve` → 状态变为 `active`
- `reject` → 状态保持 `onboarding`，记录驳回原因

### 5.4 批量审核租户

- **POST** `/tenants/batch/audit`
- **描述**：批量通过多个待审核租户
- **关联表**：tenants

**请求参数：**

```typescript
{
  ids: string[]                // 租户 ID 列表
  action: 'approve'            // 批量审核动作
  reviewNote?: string          // 审核备注
}
```

**响应 data：**

```typescript
{
  successCount: number         // 成功处理数量
  failedIds: string[]          // 失败租户 ID 列表
}
```

### 5.5 租户续费

- **POST** `/tenants/{id}/renew`
- **描述**：为租户续费，可变更套餐
- **关联表**：tenants, packages

**请求参数：**

```typescript
{
  packageName: string          // 续费套餐
  days: number                 // 续费天数: 30 | 90 | 180 | 365
  amount: number               // 续费金额（元）
  paymentMethod: 'bank_transfer' | 'wechat_pay' | 'alipay' | 'offline_remittance' // 支付方式
}
```

**响应 data：**

```typescript
{
  id: string                   // 租户 ID
  name: string                 // 租户名称
  packageName: string          // 套餐名称
  admin: string                // 管理员姓名
  region: string               // 地区
  channels: string[]           // 已开通支付通道列表
  merchants: number            // 商户数
  users: number                // 账号数
  monthlyFlow: number          // 本月流水（元）
  dueInDays: number            // 距到期天数
  lastActiveAt: string         // 最近活跃时间
  status: TenantStatus         // 租户状态
}
```

### 5.6 冻结 / 解冻租户

- **POST** `/tenants/{id}/freeze`
- **关联表**：tenants

**请求参数：**

```typescript
{
  action: FreezeAction         // 冻结动作
  reason?: string              // 冻结原因（冻结时必填）
}
```

**响应 data：**

```typescript
{
  id: string                   // 租户 ID
  name: string                 // 租户名称
  packageName: string          // 套餐名称
  admin: string                // 管理员姓名
  region: string               // 地区
  channels: string[]           // 已开通支付通道列表
  merchants: number            // 商户数
  users: number                // 账号数
  monthlyFlow: number          // 本月流水（元）
  dueInDays: number            // 距到期天数
  lastActiveAt: string         // 最近活跃时间
  status: TenantStatus         // 租户状态
}
```

**业务规则：**
- `freeze` → 状态变为 `paused`
- `unfreeze` → 状态恢复为 `active`

### 5.7 批量冻结租户

- **POST** `/tenants/batch/freeze`
- **关联表**：tenants

**请求参数：**

```typescript
{
  ids: string[]                // 租户 ID 列表
  reason: string               // 冻结原因
}
```

**响应 data：**

```typescript
{
  successCount: number         // 成功处理数量
  failedIds: string[]          // 失败租户 ID 列表
}
```

### 5.8 获取组织架构成员列表

- **GET** `/tenants/members`
- **描述**：跨租户查看所有成员
- **关联表**：users, tenants

**请求参数（Query）：**

```typescript
{
  page: number                 // 页码
  pageSize: number             // 每页条数
  tenantType?: TenantSide      // 成员所属侧筛选
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                 // 用户 ID
    name: string               // 姓名
    account: string            // 登录账号
    tenant: string             // 所属租户
    tenantType: TenantSide     // 用户所属侧
    role: string               // 当前角色
    status: UserStatus         // 账号状态
    scope: string              // 数据范围
  }>
  total: number                // 成员总数
}
```

### 5.9 获取资质审核队列

- **GET** `/tenants/certifications`
- **关联表**：tenant_certifications
- **说明**：该队列仅展示仍在审核流中的记录，即 `pending_initial_review / pending_secondary_review / pending_confirmation`。

**响应 data：**

```typescript
Array<{
  id: string                   // 资质记录 ID
  tenant: string               // 租户名称
  type: string                 // "企业实名认证" | "经营资质补充" | "法人身份证更新"
  submitAt: string             // 提交时间
  status: TenantCertificationStatus // 当前审核状态
}>
```

### 5.10 审核资质材料

- **POST** `/tenants/certifications/{id}/review`
- **关联表**：tenant_certifications
- **说明**：该接口推进资质审核状态流转；`approve` 表示推进到下一审核节点或最终通过，`reject` 表示驳回。

**请求参数：**

```typescript
{
  action: ReviewAction         // 审核动作
  comment?: string             // 审核备注
}
```

**响应 data：**

```typescript
{
  id: string                   // 资质记录 ID
  tenant: string               // 租户名称
  type: string                 // 资质类型
  submitAt: string             // 提交时间
  previousStatus: TenantCertificationStatus // 审核前状态
  status: TenantCertificationStatus         // 审核后状态
  comment?: string             // 审核备注
  reviewedAt: string           // 审核完成时间
}
```

**状态流转规则：**

- `pending_initial_review` + `approve` -> `pending_secondary_review`
- `pending_secondary_review` + `approve` -> `pending_confirmation`
- `pending_confirmation` + `approve` -> `approved`
- 任一待处理状态 + `reject` -> `rejected`

---

## 六、用户管理 Users（6 个端点）

### 类型定义

```typescript
type TenantSide = 'platform' | 'tenant'
type UserStatus = 'active' | 'invited' | 'locked' | 'disabled'
type UserCreateStatus = 'active' | 'invited'
type TenantCertificationStatus =
  | 'pending_initial_review'
  | 'pending_secondary_review'
  | 'pending_confirmation'
  | 'approved'
  | 'rejected'

interface UserRecord {
  id: string                   // 如 "USR-001"
  name: string                 // 姓名
  account: string              // 登录账号
  phone: string                // 手机号
  tenantType: TenantSide       // 用户所属侧
  tenant: string               // 所属租户
  role: string                 // 当前角色
  scope: string                // 数据范围描述
  status: UserStatus           // 账号状态
  loginAt: string              // 最后登录时间
  requiresPasswordReset: boolean // 是否要求下次登录强制改密
}
```

### 6.1 获取用户列表

- **GET** `/users`
- **描述**：分页查询平台及租户用户，支持多维度搜索
- **关联表**：users

**请求参数（Query）：**

```typescript
{
  page: number                 // 页码
  pageSize: number             // 每页条数
  keyword?: string             // 搜索关键词（匹配姓名、账号、手机号）
  tenant?: string              // 按租户筛选
  role?: string                // 按角色筛选
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                 // 用户 ID
    name: string               // 姓名
    account: string            // 登录账号
    phone: string              // 手机号
    tenantType: TenantSide     // 用户所属侧
    tenant: string             // 所属租户
    role: string               // 当前角色
    scope: string              // 数据范围描述
    status: UserStatus         // 账号状态
    loginAt: string            // 最后登录时间
    requiresPasswordReset: boolean // 是否要求下次登录强制改密
  }>
  total: number                // 用户总数
}
```

### 6.2 创建用户

- **POST** `/users`
- **关联表**：users

**请求参数：**

```typescript
{
  name: string                 // 姓名（必填）
  account: string              // 登录账号（必填，全局唯一）
  phone: string                // 手机号（必填）
  tenantType: TenantSide       // 用户所属侧
  tenant: string               // 所属租户名称
  role: string                 // 角色名称
  scope: string                // 数据范围
  status: UserCreateStatus     // 初始状态
}
```

**响应 data：**

```typescript
{
  id: string                   // 用户 ID
  name: string                 // 姓名
  account: string              // 登录账号
  phone: string                // 手机号
  tenantType: TenantSide       // 用户所属侧
  tenant: string               // 所属租户名称
  role: string                 // 角色名称
  scope: string                // 数据范围
  status: UserStatus           // 账号状态
  loginAt: string              // 最后登录时间
  requiresPasswordReset: boolean // 是否要求下次登录强制改密
}
```

**校验规则：**
- `account` 全局唯一
- `name`、`account`、`phone` 不可为空

### 6.3 更新用户

- **PUT** `/users/{id}`
- **关联表**：users

**请求参数：**

```typescript
{
  name?: string                // 姓名
  account?: string             // 登录账号
  phone?: string               // 手机号
  tenantType?: TenantSide      // 用户所属侧
  tenant?: string              // 所属租户名称
  role?: string                // 角色名称
  scope?: string               // 数据范围
  status?: UserStatus           // 账号状态
}
```

**响应 data：**

```typescript
{
  id: string                   // 用户 ID
  name: string                 // 姓名
  account: string              // 登录账号
  phone: string                // 手机号
  tenantType: TenantSide       // 用户所属侧
  tenant: string               // 所属租户名称
  role: string                 // 角色名称
  scope: string                // 数据范围
  status: UserStatus           // 账号状态
  loginAt: string              // 最后登录时间
  requiresPasswordReset: boolean // 是否要求下次登录强制改密
}
```

### 6.4 删除用户

- **DELETE** `/users/{id}`
- **关联表**：users

**响应 data：** `null`

### 6.5 变更用户状态

- **POST** `/users/{id}/status`
- **描述**：启用、禁用、锁定、解锁用户
- **关联表**：users

**请求参数：**

```typescript
{
  status: UserStatus           // 目标账号状态
}
```

**响应 data：**

```typescript
{
  id: string                   // 用户 ID
  name: string                 // 姓名
  account: string              // 登录账号
  phone: string                // 手机号
  tenantType: TenantSide       // 用户所属侧
  tenant: string               // 所属租户名称
  role: string                 // 角色名称
  scope: string                // 数据范围
  status: UserStatus           // 账号状态
  loginAt: string              // 最后登录时间
  requiresPasswordReset: boolean // 是否要求下次登录强制改密
}
```

### 6.6 重置用户密码

- **POST** `/users/{id}/reset-password`
- **描述**：管理员重置用户密码，用户下次登录需修改密码
- **关联表**：users

**请求参数：** 无（或可选指定临时密码）

**响应 data：**

```typescript
{
  requiresPasswordReset: true
}
```

---

## 七、订单管理 Orders（2 个端点）

> Admin 看到的是**跨租户**的订单数据，与 Tenant 的 `/orders` 共用同一资源路径，后端通过 token 区分权限范围。
> Admin 端仅提供查单与审计能力，不提供创建、导入、轮询、催款等运营动作。
> `qrCodeToken` 来源于 `orders.qrCodeToken`；Admin 仅查看该 H5 公开入口字段，不负责生成或管理。

### 类型定义

```typescript
type OrderStatus = 'pending' | 'partial' | 'paid' | 'expired' | 'credit'
type OrderPayType = 'cash' | 'credit'

interface AdminOrder {
  id: string                   // 如 "ORD-20260330-001"
  tenant: string               // 所属租户
  sourceOrderNo?: string       // 由 Excel 导入的原始 ERP 订单号
  groupKey?: string            // 用于防重的辅键
  mappingTemplateId?: string   // 关联的导入模板
  qrCodeToken?: string         // 订单级 H5 公开路由标识，仅供查看与排障
  customer: string             // 客户名称
  lineItems: any[]             // 商品明细 (对应 OrderItem 结构)
  customFieldValues?: Record<string, string> // 模板动态映射的自定义字段
  amount: number               // 订单金额（元）
  paid: number                 // 已收金额（元）
  status: OrderStatus          // 收款状态
  payType: OrderPayType        // 现款 | 账期
  date: string                 // 订单日期 YYYY-MM-DD
  voided: boolean              // 是否已作废（防物理删除）
  voidReason?: string          // 作废原因
  voidedAt?: string            // 作废时间
}
```

**状态说明：**

| status | 中文 | 说明 |
|--------|------|------|
| paid | 已收款 | 全额到账 |
| partial | 部分收款 | 部分到账 |
| pending | 待收款 | 尚未收款 |
| expired | 已逾期 | 超期未收 |
| credit | 账期单 | 按账期结算 |

### 7.1 获取订单列表

- **GET** `/orders`
- **关联表**：orders

**请求参数（Query）：**

```typescript
{
  page: number                 // 页码
  pageSize: number             // 每页条数
  keyword?: string             // 搜索订单号、客户、租户
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                 // 订单 ID
    tenant: string             // 所属租户
    sourceOrderNo?: string     // 原始 ERP 订单号
    groupKey?: string          // 防重辅键
    mappingTemplateId?: string // 导入模板 ID
    qrCodeToken?: string       // 订单级 H5 公开路由标识
    customer: string           // 客户名称
    lineItems: Array<{
      itemId?: string          // 行项目 ID
      skuId?: string | null    // 商品主数据 ID
      skuName: string          // 商品名称
      skuSpec?: string         // 商品规格
      unit: string             // 单位
      quantity: number         // 数量
      unitPrice: number        // 单价
      lineAmount: number       // 行金额
    }>
    customFieldValues?: Record<string, string> // 动态自定义字段
    amount: number             // 订单金额（元）
    paid: number               // 已收金额（元）
    status: OrderStatus        // 收款状态
    payType: OrderPayType      // 付款方式
    date: string               // 下单日期
    voided: boolean            // 是否已作废
    voidReason?: string        // 作废原因
    voidedAt?: string          // 作废时间
  }>
  total: number                // 订单总数
}
```

### 7.2 获取订单详情

- **GET** `/orders/{id}`
- **描述**：查看单个订单的聚合详情、商品明细、`qrCodeToken` 与审计所需字段
- **关联表**：orders

**响应 data：**

```typescript
{
  id: string                   // 订单 ID
  tenant: string               // 所属租户
  sourceOrderNo?: string       // 原始 ERP 订单号
  groupKey?: string            // 防重辅键
  mappingTemplateId?: string   // 导入模板 ID
  qrCodeToken?: string         // 订单级 H5 公开路由标识，仅查看不生成
  customer: string             // 客户名称
  lineItems: Array<{
    itemId?: string            // 行项目 ID
    skuId?: string | null      // 商品主数据 ID
    skuName: string            // 商品名称
    skuSpec?: string           // 商品规格
    unit: string               // 单位
    quantity: number           // 数量
    unitPrice: number          // 单价（元）
    lineAmount: number         // 行金额（元）
  }>
  customFieldValues?: Record<string, string> // 动态自定义字段
  amount: number               // 订单金额（元）
  paid: number                 // 已收金额（元）
  status: OrderStatus          // 收款状态
  payType: OrderPayType        // 现款 | 账期
  date: string                 // 订单日期
  voided: boolean              // 是否已作废
  voidReason?: string          // 作废原因
  voidedAt?: string            // 作废时间
}
```

---

## 八、收款记录 Payments（2 个端点）

> 平台视角的跨租户收款流水汇总。

### 类型定义

```typescript
type PaymentRecordStatus = 'success' | 'partial' | 'pending' | 'failed'

interface PaymentRecord {
  id: string                   // 流水号，如 "PAY-20260330-001"
  tenant: string               // 所属租户
  orderId: string              // 关联订单号
  customer: string             // 客户名称
  amount: number               // 收款金额（元）
  channel: string              // 支付通道编码，如 wx_jsapi | ali_h5 | direct | cash | other_paid
  fee: number                  // 手续费（元）
  net: number                  // 到账金额（元）
  time: string                 // 收款时间
  status: PaymentRecordStatus   // 流水状态
}
```

### 8.1 获取收款流水列表

- **GET** `/payments`
- **关联表**：payments

**请求参数（Query）：**

```typescript
{
  page: number
  pageSize: number
  keyword?: string             // 搜索订单号、客户、租户
  channel?: string             // 支付通道筛选
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                  // 流水 ID
    tenant: string              // 所属租户
    orderId: string             // 关联订单号
    customer: string            // 客户名称
    amount: number              // 收款金额（元）
    channel: string             // 支付通道
    fee: number                 // 手续费（元）
    net: number                 // 到账金额（元）
    time: string                // 收款时间
    status: PaymentRecordStatus   // 流水状态
  }>
  total: number                 // 流水总数
}
```

### 8.2 获取收款汇总统计

- **GET** `/payments/summary`
- **描述**：收款页面顶部统计卡片数据
- **关联表**：payments

**响应 data：**

```typescript
{
  totalAmount: number          // 今日收款总额
  totalFee: number             // 手续费合计
  totalNet: number             // 实际到账
  abnormalCount: number        // 异常流水笔数
  totalCount: number           // 流水总笔数
}
```

---

## 九、财务对账 Reconciliation（3 个端点）

### 类型定义

```typescript
type AdminReconciliationStatus = 'reconciling' | 'verified' | 'partial_unverified' | 'overdue_unpaid'
```

### 9.1 获取对账汇总

- **GET** `/reconciliation/summary`
- **描述**：对账页面顶部统计指标
- **关联表**：orders, payments

**响应 data：**

```typescript
{
  totalReceivable: number      // 本月应收总额
  totalReceived: number        // 已到账
  totalPending: number         // 待收款
  totalOverdue: number         // 已逾期
  progressPercent: number      // 回款进度百分比
}
```

### 9.2 获取对账明细列表

- **GET** `/reconciliation/daily`
- **描述**：按日/按租户的对账明细
- **关联表**：orders, payments

**请求参数（Query）：**

```typescript
{
  page: number
  pageSize: number
}
```

**响应 data：**

```typescript
{
  list: Array<{
    date: string               // 日期 YYYY-MM-DD
    tenant: string             // 租户名称
    orders: number             // 订单数
    amount: number             // 应收金额
    received: number           // 已到账
    pending: number            // 未到账
    status: AdminReconciliationStatus // 对账状态
  }>
  total: number
}
```

### 9.3 导出对账单

- **GET** `/reconciliation/export`
- **Content-Type**：`application/octet-stream`
- **关联表**：orders, payments

**响应**：Excel 文件流

---

## 十、套餐计费 Billing - Packages（4 个端点）

### 类型定义

```typescript
type BillingPackageStatus = 'active' | 'draft' | 'archived'

interface PackagePlan {
  id: string
  name: string                 // "基础版" | "标准版" | "旗舰版"
  price: string                // 价格描述，如 "¥4,999/年"
  rate: string                 // 费率描述，如 "费率 4‰"
  tenants: number              // 在用租户数
  strategy: string             // 策略说明
  orderTrend: string           // 订单趋势
  features: string[]           // 套餐内容列表
  status: BillingPackageStatus // 套餐状态
}
```

### 10.1 获取套餐列表

- **GET** `/billing/packages`
- **关联表**：packages

**响应 data：**

```typescript
Array<{
  id: string
  name: string                 // 套餐名称
  price: string                // 价格描述
  rate: string                 // 费率描述
  tenants: number              // 在用租户数
  strategy: string             // 策略说明
  orderTrend: string           // 订单趋势描述
  features: string[]           // 套餐内容列表
  status: BillingPackageStatus // 套餐状态
}>
```

### 10.2 创建套餐

- **POST** `/billing/packages`
- **关联表**：packages

**请求参数：**

```typescript
{
  name: string                 // 必填
  price: string                // 必填
  rate: string                 // 必填
  strategy: string             // 必填
  features: string[]           // 至少一项
}
```

**响应 data：**

```typescript
{
  id: string
  name: string
  price: string
  rate: string
  tenants: number
  strategy: string
  orderTrend: string
  features: string[]
  status: BillingPackageStatus
}
```

### 10.3 更新套餐

- **PUT** `/billing/packages/{id}`
- **关联表**：packages

**请求参数：**

```typescript
{
  name?: string
  price?: string
  rate?: string
  strategy?: string
  features?: string[]
}
```

**响应 data：**

```typescript
{
  id: string
  name: string
  price: string
  rate: string
  tenants: number
  strategy: string
  orderTrend: string
  features: string[]
  status: BillingPackageStatus
}
```

### 10.4 删除套餐

- **DELETE** `/billing/packages/{id}`
- **描述**：删除套餐定义（不影响已签约租户）
- **关联表**：packages

**响应 data：** `null`

---

## 十一、合同管理 Billing - Contracts（5 个端点）

### 类型定义

```typescript
type ContractType = 'electronic_signature' | 'archive_copy'
type ContractStatus = 'active' | 'pending_renewal' | 'pending_signing' | 'pending_archive' | 'terminated'

interface ContractRecord {
  contractNo: string           // 如 "HT-202603-001"
  tenant: string               // 签约租户
  type: ContractType
  expireAt: string             // 到期日期
  status: ContractStatus
  terminateReason?: string     // 已终止时返回
}
```

### 11.1 获取合同列表

- **GET** `/billing/contracts`
- **关联表**：contracts

**请求参数（Query）：**

```typescript
{
  page: number
  pageSize: number
}
```

**响应 data：**

```typescript
{
  list: Array<{
    contractNo: string          // 合同编号
    tenant: string              // 租户名称
    type: ContractType         // 合同类型
    expireAt: string            // 到期时间
    status: ContractStatus     // 合同状态
    terminateReason?: string    // 终止原因
  }>
  total: number                 // 合同总数
}
```

### 11.2 发起合同

- **POST** `/billing/contracts`
- **描述**：发起电子合同签署，系统生成合同编号并发送签署短信
- **关联表**：contracts

**请求参数：**

```typescript
{
  tenant: string               // 签约租户
  contactName: string          // 接收方联系人
  phone: string                // 接收方手机号
  packageName: string          // 签约套餐
  annualFee: string            // 年度服务费
  rate: string                 // 交易费率
  serviceStart: string         // 服务开始日期 YYYY-MM-DD
  serviceEnd: string           // 服务结束日期 YYYY-MM-DD
}
```

**响应 data：**

```typescript
{
  contractNo: string           // 生成的合同编号
  signLink: string             // 签署链接
  smsSent: boolean             // 短信是否已发送
}
```

**业务规则：**
- 合同编号格式: `HT-{serviceStart去横线}-{序号}`
- 选择套餐后自动填入对应费用和费率

### 11.3 更新合同

- **PUT** `/billing/contracts/{id}`
- **描述**：更新合同信息（仅 `pending_signing` / `pending_archive` 状态可修改）
- **关联表**：contracts

**请求参数：**

```typescript
{
  contactName?: string
  phone?: string
  packageName?: string
  annualFee?: string
  rate?: string
  serviceStart?: string
  serviceEnd?: string
}
```

**响应 data：**

```typescript
{
  contractNo: string
  tenant: string
  type: ContractType
  expireAt: string
  status: ContractStatus
  terminateReason?: string
}
```

**校验规则：**
- 仅 `pending_signing` 或 `pending_archive` 状态可修改
- `active` 状态禁止修改

### 11.4 审批合同

- **POST** `/billing/contracts/{id}/approve`
- **描述**：审批通过合同，状态流转为 `active`
- **关联表**：contracts

**请求参数：**

```typescript
{
  remark?: string              // 审批备注（可选）
}
```

**响应 data：**

```typescript
{
  contractNo: string
  tenant: string
  type: ContractType
  expireAt: string
  status: ContractStatus
  terminateReason?: string
}
```

**状态流转：** `pending_signing` → `active`

### 11.5 终止合同

- **POST** `/billing/contracts/{id}/terminate`
- **描述**：提前终止合同
- **关联表**：contracts

**请求参数：**

```typescript
{
  terminateReason: string      // 终止原因（必填）
}
```

**响应 data：**

```typescript
{
  contractNo: string
  tenant: string
  type: ContractType
  expireAt: string
  status: ContractStatus
  terminateReason?: string
}
```

**校验规则：**
- 仅 `active` 状态可终止

---

## 十二、账单发票 Billing - Invoices（3 个端点）

### 类型定义

```typescript
type InvoiceStatus = 'issued' | 'pending_issue' | 'reconciling' | 'voided'

interface InvoiceRecord {
  billNo: string               // 如 "INV-001"
  tenant: string
  amount: string
  cycle: string                // 结算周期，如 "2026-03"
  status: InvoiceStatus
}
```

### 12.1 获取账单列表

- **GET** `/billing/invoices`
- **关联表**：invoices

**请求参数（Query）：**

```typescript
{
  page: number
  pageSize: number
}
```

**响应 data：**

```typescript
{
  list: Array<{
    billNo: string              // 发票编号
    tenant: string              // 租户名称
    amount: string              // 开票金额
    cycle: string               // 结算周期
    status: InvoiceStatus      // 发票状态
  }>
  total: number                 // 发票总数
}
```

### 12.2 开具发票

- **POST** `/billing/invoices`
- **描述**：为指定结算周期开具发票
- **关联表**：invoices

**请求参数：**

```typescript
{
  tenant: string               // 开票租户
  cycle: string                // 结算周期，如 "2026-03"
  amount: string               // 开票金额
  taxRate?: number             // 税率，默认 0.06
}
```

**响应 data：**

```typescript
{
  billNo: string               // 生成的发票编号
  status: 'pending_issue'
}
```

**业务规则：**
- 创建开票记录后，初始状态为 `pending_issue`
- 只有在发票真正开具完成后，状态才会流转为 `issued`

### 12.3 作废发票

- **POST** `/billing/invoices/{id}/void`
- **描述**：作废已开具的发票
- **关联表**：invoices

**请求参数：**

```typescript
{
  voidReason: string           // 作废原因（必填）
}
```

**响应 data：** `null`

**校验规则：**
- 仅 `issued` 状态可作废
- 作废后状态变为 `voided`

---

## 十三、服务商管理 Service Providers（4 个端点）

> Admin 负责平台级服务商的接入管理，Tenant 端负责业务级服务商协作。

### 类型定义

```typescript
type ServiceProviderStatus = 'active' | 'trial'

interface ServiceProviderRecord {
  id: string                   // 服务商记录 ID
  name: string                 // 服务商名称
  category: string             // "消息通道" | "资质审核" | "合同管理"
  contactName: string          // 联系人姓名
  contactPhone: string         // 联系电话
  status: ServiceProviderStatus // 接入状态
  score: string                // 质量指标，如 "SLA 99.95%"
}
```

### 13.1 获取服务商列表

- **GET** `/service-providers`
- **关联表**：service_providers

**响应 data：**

```typescript
Array<{
  id: string                   // 服务商记录 ID
  name: string                 // 服务商名称
  category: string             // 服务商分类
  contactName: string          // 联系人姓名
  contactPhone: string         // 联系电话
  status: ServiceProviderStatus // 接入状态
  score: string                // 服务质量指标
}>
```

### 13.2 新增服务商

- **POST** `/service-providers`
- **描述**：接入新的平台级服务商
- **关联表**：service_providers

**请求参数：**

```typescript
{
  name: string                 // 服务商名称
  category: string             // "消息通道" | "资质审核" | "合同管理"
  contactName: string          // 对接联系人
  contactPhone: string         // 联系电话
  status?: ServiceProviderStatus // 默认 'trial'
}
```

**响应 data：**

```typescript
{
  id: string                   // 服务商记录 ID
  name: string                 // 服务商名称
  category: string             // 服务商分类
  contactName: string          // 联系人姓名
  contactPhone: string         // 联系电话
  status: ServiceProviderStatus // 接入状态
  score: string                // 服务质量指标
}
```

### 13.3 更新服务商

- **PUT** `/service-providers/{id}`
- **描述**：更新服务商信息或状态
- **关联表**：service_providers

**请求参数：**

```typescript
{
  name?: string                // 服务商名称
  category?: string            // 服务商分类
  contactName?: string         // 联系人姓名
  contactPhone?: string        // 联系电话
  status?: ServiceProviderStatus // 接入状态
}
```

**响应 data：**

```typescript
{
  id: string                   // 服务商记录 ID
  name: string                 // 服务商名称
  category: string             // 服务商分类
  contactName: string          // 联系人姓名
  contactPhone: string         // 联系电话
  status: ServiceProviderStatus // 接入状态
  score: string                // 服务质量指标
}
```

### 13.4 移除服务商

- **DELETE** `/service-providers/{id}`
- **描述**：移除已接入的服务商
- **关联表**：service_providers

**响应 data：** `null`

**校验规则：**
- `active` 且有活跃租户依赖时，禁止直接删除，需先下线

---

## 十四、系统公告 Notices（4 个端点）

> Admin 是公告的**发布方**，Tenant 是接收方。

### 类型定义

```typescript
type NoticeStatus = 'published' | 'draft' | 'offline'
type PublishTiming = 'immediate' | 'scheduled'

interface NoticeRecord {
  id: string
  title: string
  audience: string             // "全部租户" | "财务角色" | "平台与租户管理员"
  status: NoticeStatus
  publishAt: string
  content?: string
  planVersion?: string
  timing?: PublishTiming
  scheduledAt?: string
  reminder?: boolean
  isDraft?: boolean
}
```

### 14.1 获取公告列表

- **GET** `/notices`
- **关联表**：notices

**响应 data：**

```typescript
Array<{
  id: string
  title: string
  audience: string             // 发布范围
  status: NoticeStatus
  publishAt: string
  content?: string
  planVersion?: string
  timing?: PublishTiming
  scheduledAt?: string
  reminder?: boolean
  isDraft?: boolean
}>
```

### 14.2 创建公告

- **POST** `/notices`
- **描述**：创建新公告（可直接发布或存为草稿）
- **关联表**：notices

**请求参数：**

```typescript
{
  title: string                // 公告标题（必填）
  content: string              // 公告正文
  planVersion: string          // 套餐版本范围: "全部版本" | "基础版" | "标准版" | "专业版"
  audience: string             // 发布范围
  timing: PublishTiming
  scheduledAt?: string         // 定时发布时间（timing=scheduled 时必填）
  reminder: boolean            // 是否开启 24 小时二次提醒
  isDraft: boolean             // true=存草稿，false=发布
}
```

**响应 data：**

```typescript
{
  id: string
  title: string
  audience: string
  status: NoticeStatus
  publishAt: string
  content?: string
  planVersion?: string
  timing?: PublishTiming
  scheduledAt?: string
  reminder?: boolean
  isDraft?: boolean
}
```

### 14.3 更新公告

- **PUT** `/notices/{id}`
- **关联表**：notices

**请求参数：**

```typescript
{
  title?: string
  content?: string
  planVersion?: string
  audience?: string
  timing?: PublishTiming
  scheduledAt?: string
  reminder?: boolean
  isDraft?: boolean
}
```

**响应 data：**

```typescript
{
  id: string
  title: string
  audience: string
  status: NoticeStatus
  publishAt: string
  content?: string
  planVersion?: string
  timing?: PublishTiming
  scheduledAt?: string
  reminder?: boolean
  isDraft?: boolean
}
```

### 14.4 删除公告

- **DELETE** `/notices/{id}`
- **描述**：删除公告（仅草稿状态可直接删除，已发布需先下架）
- **关联表**：notices

**响应 data：** `null`

**校验规则：**
- 草稿状态可直接删除
- 已发布状态需先标记为下架（`status = 'offline'`）再删除

---

## 十五、工单管理 Tickets（5 个端点）

### 类型定义

```typescript
type TicketStatus = 'pending' | 'processing' | 'resolved'

interface TicketRecord {
  no: string                   // 如 "TK-2301"
  tenant: string
  issue: string
  assignee: string
  status: TicketStatus
}

interface TicketReplyResult {
  replyId: string
  content: string
  repliedBy: string
  repliedAt: string
}
```

### 15.1 获取工单列表

- **GET** `/tickets`
- **关联表**：tickets

**请求参数（Query）：**

```typescript
{
  page: number
  pageSize: number
}
```

**响应 data：**

```typescript
{
  list: Array<{
    no: string                  // 工单编号
    tenant: string              // 提单租户
    issue: string               // 问题描述
    assignee: string            // 当前处理人
    status: TicketStatus       // 工单状态
  }>
  total: number                 // 工单总数
}
```

### 15.2 导出工单

- **GET** `/tickets/export`
- **Content-Type**：`application/octet-stream`
- **关联表**：tickets

**响应**：Excel 文件流

### 15.3 回复工单

- **POST** `/tickets/{id}/reply`
- **描述**：平台运营人员回复工单
- **关联表**：tickets

**请求参数：**

```typescript
{
  content: string              // 回复内容（必填）
  attachments?: string[]       // 附件 URL 列表
}
```

**响应 data：**

```typescript
{
  replyId: string
  content: string
  repliedBy: string
  repliedAt: string
}
```

### 15.4 分配工单

- **PUT** `/tickets/{id}/assign`
- **描述**：将工单分配给指定处理人或处理组
- **关联表**：tickets

**请求参数：**

```typescript
{
  assignee: string             // 处理人/组名称
}
```

**响应 data：**

```typescript
{
  no: string
  tenant: string
  issue: string
  assignee: string
  status: TicketStatus
}
```

**状态流转：** `pending` → `processing`

### 15.5 关闭工单

- **POST** `/tickets/{id}/close`
- **描述**：关闭工单（标记为 `resolved`）
- **关联表**：tickets

**请求参数：**

```typescript
{
  resolution?: string          // 解决方案说明
}
```

**响应 data：**

```typescript
{
  no: string
  tenant: string
  issue: string
  assignee: string
  status: TicketStatus
}
```

**状态流转：** `processing` → `resolved`

---

## 十六、角色管理 Security - Roles（4 个端点）

### 类型定义

```typescript
type RoleSide = 'platform'

interface RoleTemplate {
  id: string
  name: string
  side: RoleSide               // 平台角色固定为 'platform'
  permissions: string[]
}
```

### 16.1 获取角色列表

- **GET** `/security/roles`
- **关联表**：roles

**响应 data：**

```typescript
Array<{
  id: string
  name: string
  side: RoleSide
  permissions: string[]
}>
```

### 16.2 创建角色

- **POST** `/security/roles`
- **关联表**：roles

**请求参数：**

```typescript
{
  name: string                 // 角色名称（必填，唯一）
  side: RoleSide               // 固定传 'platform'
  permissions: string[]        // 至少一项
}
```

**响应 data：**

```typescript
{
  id: string
  name: string
  side: RoleSide
  permissions: string[]
}
```

**校验规则：**
- `name` 不可与已有角色重名
- `permissions` 至少包含一项

### 16.3 更新角色

- **PUT** `/security/roles/{id}`
- **关联表**：roles

**请求参数：**

```typescript
{
  name?: string
  side?: RoleSide
  permissions?: string[]
}
```

**响应 data：**

```typescript
{
  id: string
  name: string
  side: RoleSide
  permissions: string[]
}
```

**校验规则：**
- 如果有用户关联此角色，则不允许变更 `side`
- 角色名变更时需级联更新关联用户的 role 字段

### 16.4 删除角色

- **DELETE** `/security/roles/{id}`
- **关联表**：roles

**响应 data：** `null`

**校验规则：**
- 如果有用户关联此角色，禁止删除，返回 code=409

---

## 十七、操作日志 Security - Audit Logs（1 个端点）

### 类型定义

```typescript
type AuditTargetType = 'account' | 'role' | 'tenant'
type AuditResult = 'success' | 'pending'
```

### 17.1 获取操作日志列表

- **GET** `/security/audit-logs`
- **描述**：查询平台操作审计日志，支持搜索和日期范围筛选
- **关联表**：audit_logs

**请求参数（Query）：**

```typescript
{
  page: number
  pageSize: number
  keyword?: string             // 搜索关键词（匹配操作名、操作人、租户）
  dateFrom?: string            // 开始日期 YYYY-MM-DD
  dateTo?: string              // 结束日期 YYYY-MM-DD
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string
    action: string             // 操作名称
    actor: string              // 操作人
    target: string             // 操作对象
    targetType: AuditTargetType
    tenant: string
    time: string
    result: AuditResult
  }>
  total: number
}
```

---

## 十八、安全设置 Security - Settings（8 个端点）

### 18.1 获取安全策略列表

- **GET** `/security/policies`
- **关联表**：security_policies

**响应 data：**

```typescript
Array<{
  id: string
  title: string
  detail: string
  enabled: boolean
}>
```

### 18.2 更新安全策略状态

- **PUT** `/security/policies/{id}`
- **关联表**：security_policies

**请求参数：**

```typescript
{
  enabled: boolean
}
```

**响应 data：**

```typescript
{
  id: string
  title: string
  detail: string
  enabled: boolean
}
```

### 18.3 获取 IP 白名单

- **GET** `/security/ip-whitelist`
- **关联表**：ip_whitelist

**响应 data：**

```typescript
Array<{
  id: string
  label: string                // 如 "总部办公网"
  cidr: string                 // 如 "10.0.1.0/24"
}>
```

### 18.4 新增 IP 白名单

- **POST** `/security/ip-whitelist`
- **关联表**：ip_whitelist

**请求参数：**

```typescript
{
  label: string                // 必填
  cidr: string                 // 必填，CIDR 格式
}
```

**响应 data：**

```typescript
{
  id: string
  label: string
  cidr: string
}
```

### 18.5 更新 IP 白名单

- **PUT** `/security/ip-whitelist/{id}`
- **关联表**：ip_whitelist

**请求参数：**

```typescript
{
  label?: string
  cidr?: string
}
```

**响应 data：**

```typescript
{
  id: string
  label: string
  cidr: string
}
```

### 18.6 删除 IP 白名单

- **DELETE** `/security/ip-whitelist/{id}`
- **关联表**：ip_whitelist

**响应 data：** `null`

### 18.7 获取安全周期策略

- **GET** `/security/period-policies`
- **关联表**：period_policies

**响应 data：**

```typescript
{
  sessionHours: number         // 会话有效时长（小时），默认 8
  passwordDays: number         // 密码过期周期（天），默认 90
  retentionDays: number        // 审计日志保留天数，默认 180
}
```

### 18.8 更新安全周期策略

- **PUT** `/security/period-policies`
- **关联表**：period_policies

**请求参数：**

```typescript
{
  sessionHours: number         // 会话有效时长（小时）
  passwordDays: number         // 密码过期周期（天）
  retentionDays: number        // 审计日志保留天数
}
```

**响应 data：**

```typescript
{
  sessionHours: number
  passwordDays: number
  retentionDays: number
}
```

---

## 十九、告警规则 Ops - Alert Rules（5 个端点）

### 类型定义

```typescript
interface AlertRule {
  id: string
  name: string                 // 如 "租户续费告警"
  trigger: string              // 触发条件，如 "到期前 15 天"
  channel: string              // 通知通道，如 "站内信 + 邮件"
  enabled: boolean
}
```

### 19.1 获取告警规则列表

- **GET** `/ops/alert-rules`
- **关联表**：alert_rules

**响应 data：**

```typescript
Array<{
  id: string
  name: string
  trigger: string
  channel: string
  enabled: boolean
}>
```

### 19.2 创建告警规则

- **POST** `/ops/alert-rules`
- **关联表**：alert_rules

**请求参数：**

```typescript
{
  name: string                 // 必填
  trigger: string              // 必填
  channel: string              // 必填
}
```

**响应 data：**

```typescript
{
  id: string
  name: string
  trigger: string
  channel: string
  enabled: boolean            // 创建成功后默认为 true
}
```

### 19.3 更新告警规则

- **PUT** `/ops/alert-rules/{id}`
- **关联表**：alert_rules

**请求参数：**

```typescript
{
  name?: string
  trigger?: string
  channel?: string
}
```

**响应 data：**

```typescript
{
  id: string
  name: string
  trigger: string
  channel: string
  enabled: boolean
}
```

### 19.4 切换告警规则状态

- **POST** `/ops/alert-rules/{id}/toggle`
- **关联表**：alert_rules

**请求参数：**

```typescript
{
  enabled: boolean
}
```

**响应 data：**

```typescript
{
  id: string
  name: string
  trigger: string
  channel: string
  enabled: boolean
}
```

### 19.5 删除告警规则

- **DELETE** `/ops/alert-rules/{id}`
- **关联表**：alert_rules

**响应 data：** `null`

---

## 二十、系统配置 Ops - System Config（5 个端点）

### 20.1 获取全局配置列表

- **GET** `/ops/system-configs`
- **关联表**：system_configs

**响应 data：**

```typescript
Array<{
  group: string                // "全局参数" | "邮件通道" | "短信通道"
  key: string                  // 如 "tenant_default_trial_days"
  value: string                // 配置值
  note: string                 // 配置说明
}>
```

### 20.2 获取服务接入配置列表

- **GET** `/ops/service-configs`
- **关联表**：service_configs

**响应 data：**

```typescript
Array<{
  id: string                   // 配置记录 ID
  name: string                 // 配置名称
  category: string             // "短信通道" | "电子签署"
  key: string                  // 配置键
  provider: string             // 服务提供方
  note: string                 // 备注说明
}>
```

### 20.3 创建服务接入配置

- **POST** `/ops/service-configs`
- **关联表**：service_configs

**请求参数：**

```typescript
{
  name: string                 // 必填
  category: string             // 必填
  key: string                  // 必填
  provider: string             // 必填
  note: string                 // 必填
}
```

**响应 data：**

```typescript
{
  id: string                   // 配置记录 ID
  name: string                 // 配置名称
  category: string             // 配置分类
  key: string                  // 配置键
  provider: string             // 服务提供方
  note: string                 // 备注说明
}
```

### 20.4 更新服务接入配置

- **PUT** `/ops/service-configs/{id}`
- **关联表**：service_configs

**请求参数：**

```typescript
{
  name?: string                // 配置名称
  category?: string            // 配置分类
  key?: string                 // 配置键
  provider?: string            // 服务提供方
  note?: string                // 备注说明
}
```

**响应 data：**

```typescript
{
  id: string                   // 配置记录 ID
  name: string                 // 配置名称
  category: string             // 配置分类
  key: string                  // 配置键
  provider: string             // 服务提供方
  note: string                 // 备注说明
}
```

### 20.5 删除服务接入配置

- **DELETE** `/ops/service-configs/{id}`
- **关联表**：service_configs

**响应 data：** `null`

---

## 二十一、跨项目关联

### 与 Tenant 端的关联

| Admin 操作 | 关联的 Tenant 端 |
|-----------|-----------------|
| 创建租户 + 审核通过 | Tenant 端可登录使用 |
| 冻结租户 | Tenant 端登录后提示被冻结 |
| 续费租户 | Tenant 端套餐和有效期更新 |
| 创建/管理用户 | Tenant 端用户列表同步更新 |
| 固定角色与权限树占位接口 | Tenant `GET /settings/roles`、`GET /settings/permissions` 只读返回固定枚举 |
| 发布公告 | Tenant 端 `GET /notifications` 接收 |
| 跨租户订单/流水查看 | 数据来源于各 Tenant 的订单和支付 |

### 与 H5 端的关联

| Admin 数据 | 关联的 H5 端 |
|-----------|-------------|
| `GET /orders/{id}` 订单详情 | 可查看 `qrCodeToken` 对应的订单公开入口，仅用于排障与核查 |
| `GET /payments` 收款流水 | 包含 H5 在线支付成功的记录 |
| `GET /reconciliation/daily` 对账明细 | 包含 H5 在线支付与现金核销产生的到账数据 |

### 数据隔离说明

Admin 与 Tenant 使用**相同的资源路径**（如 `/orders`、`/users`），后端通过 Token 中的身份信息区分：

| 调用方 | tenantId | 数据范围 |
|--------|----------|---------|
| Admin | `null` | 跨租户，返回所有数据 |
| Tenant | `TEN-xxx` | 仅返回该租户的数据 |

---

## 接口汇总

| 模块 | 接口数 | 方法分布 | 关联主要表 |
|------|--------|---------|-----------|
| 认证 Auth | 4 | GET ×1, POST ×3 | users |
| 控制台 Console | 1 | GET ×1 | users |
| 仪表盘 Dashboard | 5 | GET ×5 | tenants, orders, payments |
| 租户中心 Tenant Center | 9 | GET ×3, POST ×6 | tenants, tenant_certifications |
| 用户管理 Users | 6 | GET ×1, POST ×3, PUT ×1, DELETE ×1 | users |
| 订单管理 Orders | 2 | GET ×2 | orders |
| 收款记录 Payments | 2 | GET ×2 | payments |
| 财务对账 Reconciliation | 3 | GET ×3 | orders, payments |
| 套餐计费 Billing/Packages | 4 | GET ×1, POST ×1, PUT ×1, DELETE ×1 | packages |
| 合同管理 Billing/Contracts | 5 | GET ×1, POST ×3, PUT ×1 | contracts |
| 账单发票 Billing/Invoices | 3 | GET ×1, POST ×2 | invoices |
| 服务商管理 | 4 | GET ×1, POST ×1, PUT ×1, DELETE ×1 | service_providers |
| 系统公告 Notices | 4 | GET ×1, POST ×1, PUT ×1, DELETE ×1 | notices |
| 工单管理 Tickets | 5 | GET ×2, POST ×2, PUT ×1 | tickets |
| 角色管理 Security/Roles | 4 | GET ×1, POST ×1, PUT ×1, DELETE ×1 | roles |
| 操作日志 Security/Audit | 1 | GET ×1 | audit_logs |
| 安全设置 Security/Settings | 8 | GET ×4, POST ×1, PUT ×2, DELETE ×1 | security_policies, ip_whitelist, period_policies |
| 告警规则 Ops/Alert | 5 | GET ×1, POST ×2, PUT ×1, DELETE ×1 | alert_rules |
| 系统配置 Ops/Config | 5 | GET ×2, POST ×1, PUT ×1, DELETE ×1 | system_configs, service_configs |
| **合计** | **80** | GET ×34, POST ×27, PUT ×11, DELETE ×8 | — |

### 与原文档差异

| 变更项 | 说明 |
|-------|------|
| 移除打印出库模块（-2） | 打印是 Tenant 端操作，Admin 不打单 |
| Admin 订单域改为只读（-8） | 移除创建、导入、轮询、催款等动作，仅保留跨租户查单与详情审计 |
| 路径 `/packages` → `/billing/packages` | 计费域路径统一 |
| 路径 `/contracts` → `/billing/contracts` | 计费域路径统一 |
| 路径 `/ops/alert-rules` 统一 | 原代码中为 `/ops-monitor/rules`，统一规范 |
| 路径 `/ops/system-configs` 统一 | 原代码中为 `/ops-monitor/config`，统一规范 |
| 每个端点补充关联表 | 方便服务端对照建表 |
