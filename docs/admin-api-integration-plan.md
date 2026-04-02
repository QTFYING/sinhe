# Admin OS 管理平台 API 联调计划

> 编制日期：2026-04-02
> 涉及仓库：`api/`（后端 NestJS）、`web/packages/admin/`（前端 React）、`web/packages/shared/`（共享 API 层）

---

## 一、现状分析

### 1.1 后端已实现控制器

| 控制器 | 路由前缀 | 接口 | 鉴权 |
|--------|----------|------|------|
| AuthController | `/auth` | `POST /login`、`POST /refresh`、`POST /logout` | login 无需鉴权；refresh 无需鉴权；logout 需 JWT |
| TenantController | `/tenant` | `POST /`（创建）、`GET /me` | JWT + Roles（OS_SUPER_ADMIN / 租户角色） |
| OrderController | `/orders` | `GET /`（列表）、`GET /:id`、`PATCH /:id/discount` | JWT + Roles |
| ImportController | `/orders` | `POST /import` | JWT + Roles |
| ManualPaidController | `/orders` | `POST /:id/manual-paid` | JWT + Roles |
| PayController | `/pay` | `GET /:token`、`POST /:token/initiate`、`GET /:token/status` | 无（凭 qrCodeToken） |
| PaymentWebhookController | `/payment` | `POST /webhook/lakala` | 无（Webhook） |
| PrintController | `/print` | `POST /jobs` | JWT + Roles |
| ReportController | `/report` | `GET /summary` | JWT + Roles |
| NotificationController | `/notifications` | `GET /unread-count`、`GET /`、`PATCH /:id/read`、`POST /read-all` | JWT + Roles |

### 1.2 前端 API 模块（shared/src/api/modules/）

共 12 个模块：authApi、platformApi、tenantApi、userApi、orderApi、agentApi、analyticsApi、billingApi、securityApi、settingsApi、paymentApi、monitorApi。

### 1.3 前端页面与 API 调用关系

| 路由 | 页面 | 已调用的 API |
|------|------|-------------|
| `/login` | 登录 | `authApi.login` |
| `/dashboard/overview` | 运营看板 | `platformApi.getMetrics` / `getTodos` / `getTenantHealth` / `getRiskEvents` |
| `/dashboard/flowchart` | 平台流程图 | 无 API 调用 |
| `/tenant-center/tenants` | 租户管理 | `tenantApi.getList` / `getById`、`userApi.getList` |
| `/tenant-center/organization` | 组织架构 | `tenantApi.getList`、`userApi.getList` |
| `/tenant-center/certification` | 认证审核 | `tenantApi.getList` |
| `/billing/packages` | 套餐计费 | `billingApi.getPackages` |
| `/billing/contracts` | 合同管理 | `billingApi.getContracts` |
| `/billing/invoices` | 发票管理 | `billingApi.getInvoices` |
| `/operations/notices` | 公告管理 | 待确认 |
| `/operations/tickets` | 工单管理 | 待确认 |
| `/security/roles` | 角色管理 | `securityApi.getRoles` |
| `/security/users` | 用户管理 | `userApi.getList`、`tenantApi.getList`、`securityApi.getAuditLogs` / `getRoles` |
| `/security/logs` | 操作日志 | `securityApi.getAuditLogs` |
| `/security/settings` | 安全设置 | `securityApi.getSettings` |
| `/ops-monitor/rules` | 告警规则 | `monitorApi.getRules` |
| `/ops-monitor/system-config` | 系统配置 | `monitorApi.getConfig` |

### 1.4 现有 Mock 文件

`web/packages/admin/mock/` 下已有 6 个 mock：auth、billing、platform、security、tenant、user。

---

## 二、差距矩阵

下表列出前端已定义但后端尚未实现的接口，以及路由不匹配的情况。

| 前端调用路径 | 后端现状 | 差距类型 |
|-------------|---------|---------|
| `GET /auth/me` | 无 | **后端缺失** |
| `GET /tenants`（分页列表） | 仅 `GET /tenant/me`（单租户） | **路由+功能不匹配** |
| `GET /tenants/:id` | 无 | **后端缺失** |
| `POST /tenants` | `POST /tenant`（路由不同） | **路由差异**（`/tenants` vs `/tenant`） |
| `PUT /tenants/:id` | 无 | **后端缺失** |
| `POST /tenants/:id/certification` | 无 | **后端缺失** |
| `GET /users`（分页列表） | 无 | **后端缺失** |
| `GET /users/:id` | 无 | **后端缺失** |
| `POST /users` | 无 | **后端缺失** |
| `PUT /users/:id` | 无 | **后端缺失** |
| `DELETE /users/:id` | 无 | **后端缺失** |
| `GET /platform/console` | 无 | **后端缺失** |
| `GET /platform/metrics` | 无 | **后端缺失** |
| `GET /platform/todos` | 无 | **后端缺失** |
| `GET /platform/tenant-health` | 无 | **后端缺失** |
| `GET /platform/risk-events` | 无 | **后端缺失** |
| `GET /security/roles` | 无 | **后端缺失** |
| `GET /security/audit-logs` | 无 | **后端缺失** |
| `GET /security/settings` | 无 | **后端缺失** |
| `GET /billing/packages` | 无 | **后端缺失** |
| `GET /billing/contracts` | 无 | **后端缺失** |
| `GET /billing/invoices` | 无 | **后端缺失** |
| `GET /analytics/daily-trend` | 无 | **后端缺失** |
| `GET /analytics/monthly-trend` | 无 | **后端缺失** |
| `GET /analytics/payments/live` | 无 | **后端缺失** |
| `GET /ops-monitor/alerts` | 无 | **后端缺失** |
| `GET /ops-monitor/rules` | 无 | **后端缺失** |
| `GET /ops-monitor/config` | 无 | **后端缺失** |

---

## 三、分阶段联调计划

### Phase 0 — 基础联通（阻塞项，最先完成）

**目标**：登录流程跑通、请求管道联通、Token 续期可用。

| 编号 | 任务 | 端 | 详情 |
|------|------|-----|------|
| 0-1 | Vite proxy 指向后端 | 前端 | `vite.config.ts` 中 `/api` proxy target 设为 `http://localhost:3000` |
| 0-2 | CORS 放通 | 后端 | 确认 `main.ts` 中 CORS 允许 `localhost:5001` |
| 0-3 | 登录接口对齐 | 双端 | 确认 `POST /auth/login` 返回 `{ code: 0, data: { token, refreshToken, user } }`，前端 auth-store 保存完整信息 |
| 0-4 | 新增 `/auth/me` | 后端 | 返回当前用户 profile（id, username, role, tenantId 等） |
| 0-5 | Token 自动续期 | 前端 | 请求拦截器检测 401 后调用 `POST /auth/refresh`，成功则重发原请求 |
| 0-6 | 联调验证 | 双端 | 登录 → 获取 me → 进入 Dashboard → 退出，全链路手动走通 |

### Phase 1 — 用户与安全模块

**目标**：用户管理页 + 角色管理页 + 操作日志页对接真实数据。

| 编号 | 后端接口 | 方法 | 说明 |
|------|---------|------|------|
| 1-1 | `/users` | GET | 分页 + 筛选（keyword, tenantId, role, status） |
| 1-2 | `/users/:id` | GET | 用户详情 |
| 1-3 | `/users` | POST | 创建用户（校验账号唯一性） |
| 1-4 | `/users/:id` | PUT | 编辑用户 |
| 1-5 | `/users/:id` | DELETE | 软删除 |
| 1-6 | `/users/:id/status` | PATCH | 启用/停用/锁定 |
| 1-7 | `/users/:id/reset-password` | POST | 重置密码 |
| 1-8 | `/security/roles` | GET | 返回角色模板列表（含权限项） |
| 1-9 | `/security/audit-logs` | GET | 操作审计日志（分页） |

**前端改动**：
- `security-store.ts`：CRUD 方法从纯本地 Zustand 操作改为调用真实 API，成功后刷新本地状态
- `user-management.tsx`：接入 API 返回的分页数据，移除本地 mock 逻辑
- `security-ops-pages.tsx`：角色列表、审计日志接入真实数据

### Phase 2 — 租户中心

**目标**：租户列表、详情、创建、编辑、认证审核全部对接。

| 编号 | 后端接口 | 方法 | 说明 |
|------|---------|------|------|
| 2-1 | `/tenants` | GET | OS 全局租户列表（分页 + 筛选） |
| 2-2 | `/tenants/:id` | GET | 租户详情 |
| 2-3 | `/tenants` | POST | 创建租户（原 `POST /tenant` 路由统一迁移） |
| 2-4 | `/tenants/:id` | PUT | 编辑租户 |
| 2-5 | `/tenants/:id/certification` | POST | 提交/审核认证材料 |

**后端路由对齐**：将现有 `TenantController` 路由前缀从 `/tenant` 改为 `/tenants`，保持 RESTful 复数风格统一。

**前端改动**：
- `overview-tenant-pages.tsx`：租户管理、组织架构、认证审核页面接入真实 API
- `shared/api/modules/tenant.ts`：确认路径与后端一致

### Phase 3 — 运营看板（Dashboard）

**目标**：Dashboard 从 mock 数据切换到真实聚合数据。

| 编号 | 后端接口 | 方法 | 数据来源 |
|------|---------|------|---------|
| 3-1 | `/platform/console` | GET | 系统配置 + 当前登录用户角色/租户 |
| 3-2 | `/platform/metrics` | GET | 聚合统计：在营租户数、活跃账号数、本月订单数、本月收款额 |
| 3-3 | `/platform/todos` | GET | 待办事项：待开通租户、待激活账号、待审核认证等 |
| 3-4 | `/platform/tenant-health` | GET | 租户健康度：账号覆盖率、异常数、负责人 |
| 3-5 | `/platform/risk-events` | GET | 登录风险事件：异地登录、连续失败、长期未登录 |

**后端建议**：新增 `PlatformController`（`/platform`），仅限 OS 角色访问，数据从 Prisma 聚合查询获取。

**前端改动**：
- `dashboard.tsx`：已使用 `useRequest(platformApi.xxx)`，无需结构改动，mock 关闭即可
- `console-store.ts`：`fetchConsoleInfo` 已对接 `platformApi.getConsoleInfo`

### Phase 4 — 计费与运营

**目标**：套餐、合同、发票、公告、工单页面对接。

| 编号 | 后端接口 | 方法 | 说明 |
|------|---------|------|------|
| 4-1 | `/billing/packages` | GET | 套餐计划列表 |
| 4-2 | `/billing/contracts` | GET | 合同列表 |
| 4-3 | `/billing/invoices` | GET | 发票列表 |
| 4-4 | `/operations/notices` | GET/POST | 平台公告 CRUD |
| 4-5 | `/operations/tickets` | GET/POST | 工单 CRUD |

**后端建议**：新增 `BillingController`（`/billing`）和 `OperationsController`（`/operations`），仅限 OS 角色访问。

### Phase 5 — 数据分析与监控

**目标**：趋势分析和运维监控页面对接。

| 编号 | 后端接口 | 方法 | 说明 |
|------|---------|------|------|
| 5-1 | `/analytics/daily-trend` | GET | 每日收款趋势 |
| 5-2 | `/analytics/monthly-trend` | GET | 月度收款趋势 |
| 5-3 | `/analytics/payments/live` | GET | 实时支付流水 |
| 5-4 | `/ops-monitor/alerts` | GET | 告警列表 |
| 5-5 | `/ops-monitor/rules` | GET | 告警规则配置 |
| 5-6 | `/ops-monitor/config` | GET | 系统运维配置 |

**后端建议**：新增 `AnalyticsController`（`/analytics`）和 `OpsMonitorController`（`/ops-monitor`）。

---

## 四、各阶段依赖与并行关系

```
Phase 0（基础联通）
   │
   ├──→ Phase 1（用户与安全）──→ 可独立完成
   ├──→ Phase 2（租户中心）──→ 可独立完成
   ├──→ Phase 3（运营看板）──→ 依赖 Phase 1 + 2 的部分数据
   │
   └──→ Phase 4（计费运营）──→ 可独立完成
         Phase 5（分析监控）──→ 可独立完成
```

Phase 0 是阻塞项。完成后 Phase 1、2、4、5 可并行推进；Phase 3 的聚合数据依赖 Phase 1/2 的基础表，建议稍后。

---

## 五、工作量概览

| Phase | 后端新增接口 | 前端改动文件 | 优先级 |
|-------|------------|------------|--------|
| Phase 0 | 1 个 | 3 个 | P0 |
| Phase 1 | 9 个 | 3 个 | P1 |
| Phase 2 | 5 个（含路由迁移） | 2 个 | P1 |
| Phase 3 | 5 个 | 2 个 | P2 |
| Phase 4 | 5 个 | 2 个 | P2 |
| Phase 5 | 6 个 | 待确认 | P3 |
| **合计** | **~31 个接口** | **~12 个文件** | — |

---

## 六、联调约定

### 6.1 API 响应格式

所有接口统一返回（与 `CLAUDE.md` 一致）：

```json
{ "code": 0, "message": "ok", "data": {} }
```

错误码见 `docs/API.md §1.6`。

### 6.2 分页约定

分页接口统一 query 参数：

```
GET /xxx?page=1&pageSize=20&keyword=xxx
```

返回格式：

```json
{
  "code": 0,
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### 6.3 鉴权约定

- 所有 OS 管理接口需 JWT + `OS_SUPER_ADMIN` / `OS_ADMIN` 角色
- Token 通过 `Authorization: Bearer <accessToken>` 传递
- 401 时前端自动尝试 refresh，失败则跳转登录页

### 6.4 Mock 切换

前端通过 `vite-plugin-mock-dev-server` 提供 mock。联调阶段逐模块关闭 mock，确认后端接口可用后删除对应 mock 文件。
