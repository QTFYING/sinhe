# 收单吧 SaaS 平台 — API 架构总览

> 本文档面向前端团队，梳理三端（Admin / Tenant / H5）的 API 能力、跨项目关联和端点清单。
> 确认日期：2026-04-07
> 统一枚举命名与取值参见 **[../enums/enum-manual.md](../enums/enum-manual.md)**。

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
│  │  Auth · Tenant · User · Order · Payment                 │    │
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

## 二、全局统一约定

### 2.1 Base URL

```text
https://api.platform.com/api/v1
```

### 2.2 访问方式

| 接口类型 | 访问方式 |
|---|---|
| 后台接口（Admin / Tenant） | `Authorization: Bearer <access_token>`（JWT） |
| C端收款页接口 | 无 JWT，通过 URL 中的 `qrCodeToken` 路由到对应订单 H5 页面 |
| Lakala Webhook 回调 | 无 JWT，后端校验拉卡拉签名 |

### 2.3 统一响应格式

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

### 2.4 分页约定（Query 参数）

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `page` | `number` | `1` | 页码，从 1 开始 |
| `pageSize` | `number` | `20` | 每页条数，最大 100 |

### 2.5 业务错误码表

| code | 含义 |
|---|---|
| `0` | 成功 |
| `1001` | 订单已支付，禁止重复操作 |
| `1002` | 二维码已过期 |
| `1003` | 支付中，禁止并发发起 |
| `4001` | 未登录或 Token 已失效 |
| `4003` | 无权限访问该资源 |
| `4004` | 资源不存在 |

### 2.6 时区约定

所有时间均以 **ISO 8601 UTC 格式** 传输（含 `Z` 后缀），前端展示统一转换为当地时区。

### 2.7 前端共享契约落点

- 枚举事实源统一维护在 `packages/types/src/enums/`
- 请求、响应和资源结构统一维护在 `packages/types/src/contracts/`
- 通用分页与响应包装等共享结构统一维护在 `packages/types/src/common/`

---

## 三、三端 API 关联矩阵

三个前端共享同一个后端，很多**资源是同一张表**，只是**视角和权限不同**：

| 后端资源 | Admin 视角 | Tenant 视角 | H5 视角 |
|---------|-----------|------------|---------|
| **Auth** | 平台账号登录 + 会话刷新 + 当前用户信息 | 租户账号登录 + 会话刷新 + 当前用户信息 | 无需登录（通过 `qrCodeToken` 打开订单 H5 页面） |
| **Tenant** | CRUD + 审核 + 冻结 + 续费（全量） | 提交资质材料 + 查询资质状态 | — |
| **User** | 跨租户管理所有用户 | 仅管理本租户下用户 | — |
| **Order** | 跨租户查看/审计所有订单，不承担导入、打印和催款动作 | 本租户订单 CRUD + 订单批量导入 + 打印 + 账期管理 | 单个订单只读 |
| **Payment** | 跨租户收款流水汇总 | 本租户收款 + 现金核销 + 财务对账 | 发起支付 |
| **Analytics** | 平台级聚合指标 | 本租户经营数据 | — |
| **Billing** | 套餐 / 合同 / 发票管理（运营） | —（当前版本未开放独立计费页） | — |
| **Security** | 角色模板 + 审计日志 + 安全策略 | — | — |
| **Settings** | 全局配置 / 服务接入配置 | 通用配置 + 打印模板 + 租户审计日志 | — |
| **Role** | 平台+租户角色模板管理 | 本租户角色+权限配置 | — |
| **Notice** | 创建 / 发布 / 删除公告 | 接收 / 阅读公告 | — |
| **Ticket** | 分派 / 回复 / 关闭工单 | —（当前版本未开放工单页） | — |

### 关键设计原则

1. **同一资源、不同前缀**：Admin 走 `/platform/*` 或直接走资源路径获取跨租户数据；Tenant 走相同资源路径但后端自动按 tenantId 过滤；H5 走 `/pay/*` 获取单个订单
2. **后端通过 Token 中的 `tenantId` 自动隔离数据**：Tenant 端不需要传 tenantId，后端自动注入
3. **H5 页面公开访问**：`qrCodeToken` 来源于 `orders.qrCodeToken`，仅作为订单级公开路由标识，用于打开 `/pay/:token` 对应页面，不承载收货人身份鉴权

---

## 四、端点清单

### 4.1 H5 端（客户支付）— 4 个端点

> 访问方式：无需登录，通过 URL 中的 `qrCodeToken` 打开对应订单 H5 页面
> 路径前缀：`/pay`

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 1 | GET | `/pay/:token` | 获取订单支付详情 | payment_orders + orders + order_items |
| 2 | POST | `/pay/:token/initiate` | 发起在线支付（跳转收银台） | payment_orders |
| 3 | POST | `/pay/:token/offline-payment` | 线下支付登记（现金待核销） | payment_orders |
| 4 | GET | `/pay/:token/status` | 轮询支付状态 | payment_orders |

**已确认的设计决策：**
- `qrCodeToken` 来源于 `orders.qrCodeToken`；前端按固定路由规则 `/pay/:token` 生成送货单二维码
- 采用 5 态状态机：`unpaid` | `paying` | `pending_verification` | `paid` | `expired`
- `payment_orders` 在 `expired` 状态下允许重新发起支付
- 现金链路闭环：H5 `offline-payment` 登记待核销，Tenant 侧 `cash-verifications` 财务核销
- 在线支付仅在用户点击支付后触发，依赖后端的 `initiate` 动态返回 `cashierUrl` 与轮询 `status`
- Webhook 依赖系统底层 `POST /payment/webhook/lakala`（不计入前端直接可见端点）

**支付时序：**

```
H5 前端                    后端                     支付网关
  │                        │                        │
  │  POST /pay/:token/initiate                       │
  │───────────────────────▶│                        │
  │  返回 cashierUrl       │                        │
  │◀───────────────────────│                        │
  │                        │                        │
  │  跳转 cashierUrl ──────────────────────────────▶│
  │                        │   异步回调              │
  │                        │◀───────────────────────│
  │                        │   更新 payment_orders   │
  │  GET /pay/:token/status │                        │
  │───────────────────────▶│                        │
  │  { status: 'paid' }    │                        │
  │◀───────────────────────│                        │
```

---

### 4.2 Tenant 端（商户 SaaS）— 47 个端点

> 鉴权方式：业务请求走 Bearer Access Token；Refresh Token 存于 HttpOnly Cookie，后端通过 token 中的 tenantId 自动隔离数据
> 角色（固定枚举）：TENANT_OWNER / TENANT_OPERATOR / TENANT_FINANCE / TENANT_VIEWER

#### 模块 A：认证（Auth）— 4 个端点

| # | Method | Path | 说明 | 鉴权 | 关联表 |
|---|--------|------|------|------|--------|
| A1 | POST | `/auth/login` | 登录 | 免鉴权 | users |
| A2 | POST | `/auth/refresh` | 刷新令牌 | 免鉴权 | — |
| A3 | POST | `/auth/logout` | 登出 | 免鉴权 | — |
| A4 | GET | `/auth/me` | 当前用户信息 | 需鉴权 | users |

> 三端共用同一套 Auth，后端通过 user.tenantId 区分平台用户 / 租户用户。
> 登录仅返回 accessToken + user；`/auth/refresh` 与 `/auth/logout` 从 HttpOnly Refresh Cookie 读取会话。

#### 模块 B：订单管理（Orders）— 14 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| B1 | GET | `/orders` | 订单列表（分页+筛选） | all | orders |
| B2 | GET | `/orders/{id}` | 订单详情 | all | orders + order_items |
| B3 | POST | `/orders` | 创建订单 | TENANT_OWNER, TENANT_OPERATOR | orders |
| B4 | PUT | `/orders/{id}` | 更新订单 | TENANT_OWNER, TENANT_OPERATOR | orders |
| B5 | PATCH | `/orders/{id}` | 更新订单作废状态 | TENANT_OWNER | orders |
| B6 | GET | `/import/default-template` | 获取系统默认映射模板 | TENANT_OWNER, TENANT_OPERATOR | — |
| B7 | GET | `/import/templates` | 导入-获取模板列表 | TENANT_OWNER, TENANT_OPERATOR | import_templates |
| B8 | POST | `/import/templates` | 导入-创建模板 | TENANT_OWNER, TENANT_OPERATOR | import_templates |
| B9 | PUT | `/import/templates/:id` | 导入-更新模板 | TENANT_OWNER, TENANT_OPERATOR | import_templates |
| B10 | POST | `/import/preview` | 导入-订单级预检 | TENANT_OWNER, TENANT_OPERATOR | — |
| B11 | POST | `/orders/import` | 异步正式导入 | TENANT_OWNER, TENANT_OPERATOR | orders + import_jobs |
| B12 | GET | `/orders/import/jobs/:jobId` | 查询导入任务进度 | TENANT_OWNER, TENANT_OPERATOR | import_jobs |
| B13 | POST | `/orders/print-records` | 打印成功回执（单个/批量） | TENANT_OWNER, TENANT_OPERATOR | orders + print_record_batches |
| B14 | POST | `/orders/{id}/reminders` | 创建催款提醒记录 | TENANT_OWNER, TENANT_FINANCE | orders |

**导入接口详细说明（已确认决策）：**
- 完整链路为：`GET /import/default-template` → `GET/POST/PUT /import/templates` → `POST /import/preview` → `POST /orders/import` → `GET /orders/import/jobs/:jobId`
- 模板结构统一为 `{ defaultFields, customerFields }`，不再使用旧三段式 `sourceColumns / fields / mappings`
- `defaultFields` 固定 7 项：`sourceOrderNo / customer / customerPhone / customerAddress / totalAmount / orderTime / payType`
- `customerFields` 与默认字段结构一致，但由服务端生成 `customerKey1...N`，且 `isRequired=false`
- 前端 SheetJS 解析 Excel 后，必须先按模板把数据回填成标准订单数组，再调用 `/import/preview`
- `/import/preview` 请求体采用 `{ templateId, orders }`，直接提交订单级标准结构，不再上传原始 `rows`
- 订单级标准结构中的动态字段值统一命名为 `customerFieldValues`，不再使用 `customerValues`
- `/orders/import` 只接收 `{ previewId, conflictPolicy? }`，不再支持直传 `orders / rows / templateId`
- `/import/preview` 同步执行，目标是快速反馈；`/orders/import` 异步执行，正式入队后交由 `import-worker` 处理
- `previewId` 为正式导入唯一凭证，且成功创建 `jobId` 后一次性消费
- 使用 `/orders/import/jobs/:jobId` 轮询正式导入进度，结果需包含 `previewId / overwrittenCount / conflictDetails`
- 创建订单与正式导入成功时，同步生成 `orders.qrCodeToken`
- `POST /orders/print-records` 建议携带 `requestId`，按 `tenantId + requestId` 实现批次级幂等

**订单列表筛选参数：**

```typescript
{
  page: number
  pageSize: number
  keyword?: string         // 搜索订单号、ERP源单号、客户名、客户电话、客户地址
  status?: OrderStatus     // pending | partial | paid | expired | credit
  payType?: OrderPayType   // 结算方式：cash | credit
  templateId?: string      // 按导入模板类型过滤订单
  dateFrom?: string        // YYYY-MM-DD
  dateTo?: string          // YYYY-MM-DD
}
```

#### 模块 C：支付与核销（Payment）— 3 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| C1 | GET | `/payments` | 本租户收款流水列表 | TENANT_OWNER, TENANT_FINANCE | payments |
| C2 | GET | `/payments/summary` | 收款汇总统计 | TENANT_OWNER, TENANT_FINANCE | payments |
| C3 | POST | `/orders/{id}/cash-verifications` | 创建现金核销记录 | TENANT_FINANCE | payment_orders + payments + orders |

> 引入 5 态状态机后，H5 扫码离线支付变为 `pending_verification`。C3 用于财务手动确认资金到账。

#### 模块 D：财务对账（Finance）— 3 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| D1 | GET | `/finance/summary` | 财务汇总（应收/已收/费率/净额） | TENANT_OWNER, TENANT_FINANCE | orders + payments |
| D2 | GET | `/finance/reconciliation` | 对账明细列表 | TENANT_OWNER, TENANT_FINANCE | orders + payments |
| D3 | GET | `/finance/reconciliation/export` | 导出对账单 | TENANT_OWNER, TENANT_FINANCE | orders + payments |

#### 模块 E：账期管理（Credit）— 2 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| E1 | GET | `/orders/credit` | 账期订单列表 | TENANT_OWNER, TENANT_FINANCE | orders |
| E2 | POST | `/orders/{id}/receipts` | 创建回款记录 | TENANT_OWNER, TENANT_FINANCE | orders + payments |


#### 模块 G：数据分析（Analytics）— 4 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| G1 | GET | `/analytics/daily-trend` | 日趋势 | all | orders + payments |
| G2 | GET | `/analytics/monthly-trend` | 月趋势 | all | orders + payments |
| G3 | GET | `/analytics/payments/live` | 实时收款动态 | all | payments |
| G4 | GET | `/analytics/dashboard` | 仪表盘聚合数据 | all | orders + payments |

#### 模块 H：系统设置（Settings）— 13 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| H1 | GET | `/settings/roles` | 角色只读占位 | TENANT_OWNER | roles |
| H2 | GET | `/settings/permissions` | 权限树只读占位 | TENANT_OWNER | permissions |
| H3 | GET | `/settings/users` | 用户列表 | TENANT_OWNER | users |
| H4 | POST | `/settings/users` | 创建用户 | TENANT_OWNER | users |
| H5 | PUT | `/settings/users/{id}` | 更新用户 | TENANT_OWNER | users |
| H6 | DELETE | `/settings/users/{id}` | 删除用户 | TENANT_OWNER | users |
| H7 | PATCH | `/settings/users/{id}` | 更新用户状态 | TENANT_OWNER | users |
| H8 | GET | `/settings/general` | 获取通用配置（企业信息+通知） | TENANT_OWNER | system_configs + tenant_general_settings |
| H9 | PUT | `/settings/general` | 保存通用配置 | TENANT_OWNER | system_configs + tenant_general_settings |
| H10 | GET | `/settings/printing` | 获取打印配置列表 | TENANT_OWNER | printer_templates, import_templates |
| H11 | GET | `/settings/printing/{importTemplateId}` | 获取单张映射模板的打印配置 | TENANT_OWNER | printer_templates, import_templates |
| H12 | PUT | `/settings/printing/{importTemplateId}` | 保存单张映射模板的打印配置 | TENANT_OWNER | printer_templates |
| H13 | GET | `/settings/audit-logs` | 获取本租户操作日志 | TENANT_OWNER | audit_logs |

**Settings 已确认决策：**
- `/settings/general` 采用“平台默认 + 租户覆盖”两层模型；GET 返回合并结果，PUT 仅更新租户覆盖层
- `/settings/printing*` 以 `tenantId + importTemplateId` 为持久化维度；若无自定义配置，则前端回退本地默认模板

#### 模块 I：通知（Notifications）— 2 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| I1 | GET | `/notifications` | 接收的平台公告列表 | all | notices + notice_reads |
| I2 | POST | `/notifications/{id}/read-records` | 创建已读记录 | all | notice_reads |

#### 模块 J：资质提交（Certification）— 2 个端点

| # | Method | Path | 说明 | 角色 | 关联表 |
|---|--------|------|------|------|--------|
| J1 | POST | `/tenants/certification` | 提交当前租户资质材料 | TENANT_OWNER | tenant_certifications |
| J2 | GET | `/tenants/certification` | 查询当前租户资质状态 | TENANT_OWNER | tenant_certifications |

#### Tenant 端点汇总

| 模块 | 端点数 | 主要关联表 |
|------|--------|-----------|
| Auth | 4 | users |
| Orders | 14 | orders, order_items, import_templates, import_jobs, print_record_batches |
| Payment & 核销 | 3 | orders, payments, payment_orders |
| Finance | 3 | orders, payments |
| Credit | 2 | orders, payments |
| Analytics | 4 | orders, payments |
| Settings | 13 | roles, permissions, users, system_configs, tenant_general_settings, printer_templates, import_templates, audit_logs |
| Notifications | 2 | notices |
| Certification | 2 | tenant_certifications |
| **合计** | **47** | — |

---

### 4.3 Admin 端（平台运营）— 81 个端点

> 鉴权方式：业务请求走 Bearer Access Token；Refresh Token 存于 HttpOnly Cookie；tenantId = null 表示平台用户
> 平台用户可跨租户查看和管理数据

#### 模块 1：认证（Auth）— 4 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 1.1 | POST | `/auth/login` | 平台账号登录 | users |
| 1.2 | POST | `/auth/refresh` | 刷新令牌 | — |
| 1.3 | POST | `/auth/logout` | 登出 | — |
| 1.4 | GET | `/auth/me` | 获取当前用户信息 | users |

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
| 4.3 | POST | `/tenants/{id}/audit-decisions` | 创建审核决议 | tenants |
| 4.4 | POST | `/tenants/audit-batches` | 创建批量审核批次 | tenants |
| 4.5 | POST | `/tenants/{id}/renewals` | 创建续费记录 | tenants, packages |
| 4.6 | PATCH | `/tenants/{id}` | 更新租户状态 | tenants |
| 4.7 | POST | `/tenants/status-change-batches` | 创建批量状态变更批次 | tenants |
| 4.8 | GET | `/tenants/members` | 组织架构成员列表（跨租户） | users, tenants |
| 4.9 | GET | `/tenants/certifications` | 资质审核队列 | tenant_certifications |
| 4.10 | POST | `/tenants/certifications/{id}/review-decisions` | 创建资质审核决议 | tenant_certifications |

#### 模块 5：用户管理（Users）— 6 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 5.1 | GET | `/users` | 用户列表（跨租户，支持搜索/筛选） | users |
| 5.2 | POST | `/users` | 创建用户 | users |
| 5.3 | PUT | `/users/{id}` | 更新用户 | users |
| 5.4 | DELETE | `/users/{id}` | 删除用户 | users |
| 5.5 | PATCH | `/users/{id}` | 更新用户状态 | users |
| 5.6 | POST | `/users/{id}/password-resets` | 创建密码重置记录 | users |

#### 模块 6：订单管理（Orders）— 2 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 6.1 | GET | `/orders` | 订单列表（跨租户） | orders |
| 6.2 | GET | `/orders/{id}` | 订单详情（跨租户审计） | orders + order_items |

> 已确认决策：Admin 端订单域仅保留跨租户查单与详情审计能力，导入、轮询、催款等动作仅保留在 Tenant 端。

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

#### 模块 10：合同管理（Billing - Contracts）— 5 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 10.1 | GET | `/billing/contracts` | 合同列表 | contracts |
| 10.2 | POST | `/billing/contracts` | 发起合同 | contracts |
| 10.3 | PUT | `/billing/contracts/{id}` | 更新合同 | contracts |
| 10.4 | POST | `/billing/contracts/{id}/approvals` | 创建合同审批记录 | contracts |
| 10.5 | POST | `/billing/contracts/{id}/terminations` | 创建合同终止记录 | contracts |

#### 模块 11：账单发票（Billing - Invoices）— 3 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 11.1 | GET | `/billing/invoices` | 账单列表 | invoices |
| 11.2 | POST | `/billing/invoices` | 开具发票 | invoices |
| 11.3 | PATCH | `/billing/invoices/{id}` | 更新发票状态（作废） | invoices |

#### 模块 12：服务商管理（Service Providers）— 4 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 12.1 | GET | `/service-providers` | 平台级服务商列表 | service_providers |
| 12.2 | POST | `/service-providers` | 新增服务商 | service_providers |
| 12.3 | PUT | `/service-providers/{id}` | 更新服务商 | service_providers |
| 12.4 | DELETE | `/service-providers/{id}` | 移除服务商 | service_providers |

#### 模块 13：系统公告（Notices）— 4 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 13.1 | GET | `/notices` | 公告列表 | notices |
| 13.2 | POST | `/notices` | 创建/发布公告 | notices |
| 13.3 | PUT | `/notices/{id}` | 更新公告 | notices |
| 13.4 | DELETE | `/notices/{id}` | 删除公告 | notices |

#### 模块 14：工单管理（Tickets）— 5 个端点

| # | Method | Path | 说明 | 关联表 |
|---|--------|------|------|--------|
| 14.1 | GET | `/tickets` | 工单列表 | tickets |
| 14.2 | GET | `/tickets/export` | 导出工单 | tickets |
| 14.3 | POST | `/tickets/{id}/replies` | 创建工单回复 | tickets + ticket_replies |
| 14.4 | POST | `/tickets/{id}/assignments` | 创建工单分配记录 | tickets |
| 14.5 | POST | `/tickets/{id}/closures` | 创建工单关闭记录 | tickets |

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
| 18.4 | PATCH | `/ops/alert-rules/{id}` | 更新规则启用状态 | alert_rules |
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
| Auth | 4 | users |
| Console | 1 | users |
| Dashboard | 5 | tenants, orders, payments, audit_logs |
| Tenant Center | 10 | tenants, tenant_certifications |
| Users | 6 | users |
| Orders | 2 | orders, order_items |
| Payments | 2 | payments |
| Reconciliation | 3 | orders, payments |
| Billing (Packages) | 4 | packages |
| Billing (Contracts) | 5 | contracts |
| Billing (Invoices) | 3 | invoices |
| Service Providers | 4 | service_providers |
| Notices | 4 | notices |
| Tickets | 5 | tickets |
| Security (Roles) | 4 | roles |
| Security (Audit) | 1 | audit_logs |
| Security (Settings) | 8 | security_policies, ip_whitelist, period_policies |
| Ops (Alert Rules) | 5 | alert_rules |
| Ops (System Config) | 5 | system_configs, service_configs |
| **合计** | **81** | — |

---

## 五、全局汇总

### 端点统计

| 项目 | 端点数 | 鉴权方式 |
|------|--------|---------|
| H5 | 4 | `qrCodeToken` 公开路由 |
| Tenant | 47 | Bearer Token（tenantId 自动隔离） |
| Admin | 81 | Bearer Token（tenantId=null，跨租户） |
| **合计** | **132** | — |

### 已确认的关键设计决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | H5 路由标识 | `qrCodeToken` 来源于 `orders.qrCodeToken`，前端按固定规则生成 `/pay/:token` 二维码链接 |
| 2 | H5 状态机 | 五态流转 `unpaid` -> `paying` -> `pending_verification` -> `paid` / `expired` |
| 3 | 物理删除防范 | 以 `PATCH /orders/{id}` 更新作废字段替代 `DELETE` 软作废，保留历史日志。 |
| 4 | 订单导入机制 | 使用服务器管理模板 + 预览步骤 + 异步导入，不直接传接实体 Excel 文件 |
| 5 | Tenant 安全权限 | 所有角色以固定代码写死。`settings/roles` 等全部为只读配置接口 |
| 6 | 通用配置模型 | `/settings/general` 采用“平台默认 + 租户覆盖”两层模型，GET 返回合并结果 |
| 7 | 打印配置模型 | `/settings/printing*` 只存黑盒 JSON，持久化维度为 `tenantId + importTemplateId` |
| 8 | 打印回执幂等 | `/orders/print-records` 按 `tenantId + requestId` 做批次级幂等 |
