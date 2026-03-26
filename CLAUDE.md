# 经销商订单收款平台 — Claude Code 项目指引

## 项目概述

多租户 SaaS 架构的经销商订单收款平台，串联「Excel导入 → 打印发货单 → 买家扫码付款 → 财务报表」全链路。三端分离：OS运营管理台、Tenant经销商工作台、C端买家扫码收款H5。

## Monorepo 结构

```
project-root/
├── apps/
│   ├── api/          # 后端（NestJS + Prisma）
│   ├── admin/        # OS运营平台（React + Ant Design）
│   ├── tenant/       # 租户工作台（React + Ant Design）
│   └── pay-h5/       # 买家扫码收款页（Preact / 原生）
├── packages/
│   ├── shared-types/ # 前后端共享 TS 类型与 DTO
│   ├── shared-utils/ # 纯函数工具（金额、日期、Token）
│   └── shared-ui/    # admin + tenant 复用 UI 组件
├── docs/             # 设计文档（只读参考，不产出代码）
├── CLAUDE.md
├── pnpm-workspace.yaml
└── turbo.json
```

## 技术栈

| 层 | 技术 |
|---|---|
| 后端框架 | NestJS + TypeScript（严格模式） |
| ORM | Prisma（schema 见 `docs/prisma.md`） |
| 数据库 | PostgreSQL |
| 缓存/队列 | Redis + BullMQ |
| PC前端 | React 18 + Vite + Ant Design 5.x + Zustand + TanStack Query |
| C端H5 | Preact（或原生 HTML/CSS/JS），禁止引入重量级依赖 |
| 工程化 | pnpm Workspace + Turborepo |

## 后端开发规范（apps/api）

### NestJS 模块结构

每个业务模块统一四层结构，禁止跨层调用：

```
module/
├── module.ts
├── controller.ts   # 仅处理 HTTP 入参/出参，不含业务逻辑
├── service.ts      # 全部业务逻辑在此
└── dto/            # class-validator 校验 DTO
```

### 多租户强隔离（最重要约束）

- **所有** Prisma 查询必须带 `where: { tenantId }` 条件，tenantId 从 JWT payload 中注入，禁止从请求体获取
- OS 账号（tenantId = null）在 Guard 层单独处理，拥有全局视野
- 禁止在 Service 层直接信任前端传入的 tenantId

```typescript
// ✅ 正确
findMany({ where: { tenantId: ctx.tenantId, payStatus } })

// ❌ 错误
findMany({ where: { tenantId: body.tenantId } })
```

### 金额处理

- `totalAmount` 生单后**永远不得 UPDATE**，改价只写 `discountAmount`
- 金额字段使用 Prisma `Decimal` 类型，传输和存储均为字符串（如 `"1580.00"`），禁止 JavaScript 浮点运算
- 恒等式：`totalAmount = paidAmount + discountAmount`，每次写入前后端均需校验

### 支付安全

- 发起支付时后端通过 Redis 分布式锁防并发，key 格式：`pay:lock:{orderId}`
- Webhook 回调通过 `channelTradeNo` 唯一约束防重复入账，catch unique constraint 后静默跳过
- 支付金额由后端服务端定格，接口不接受前端传入的金额参数

### 操作日志

关键操作必须写入 `OrderLifecycleLog`，覆盖以下事件：
`ORDER_CREATED` / `ORDER_PRINTED` / `PAYMENT_INITIATED` / `PAYMENT_SUCCESS_WEBHOOK` / `PAYMENT_SUCCESS_POLLING` / `PAYMENT_MANUAL_MARKUP` / `PRICE_ADJUSTED` / `DELIVERY_STATUS_UPDATED` / `ORDER_REFUNDED` / `QR_CODE_EXPIRED`

改价事件必须记录 before/after 快照：
```typescript
snapshot: { before: { discountAmount: "0.00" }, after: { discountAmount: "100.00" } }
```

### API 响应格式

所有接口统一返回（Webhook 接口除外）：
```json
{ "code": 0, "message": "ok", "data": {} }
```

错误码见 `docs/API.md §1.6`，禁止自行新增错误码。

## 前端开发规范（apps/admin / apps/tenant）

### 状态管理

- 服务端数据：**TanStack Query**（缓存、loading、错误状态）
- 客户端 UI 状态：**Zustand**（轻量，仅存必须全局共享的状态）
- 禁止用 useState 管理服务端数据

### 权限控制

角色枚举硬编码，前端按角色做条件渲染，**不弹出菜单 Tree 选择器**：

| 角色 | 可访问模块 |
|---|---|
| TENANT_OWNER | 全部 |
| TENANT_OPERATOR | 导入、订单管理、打印中心 |
| TENANT_FINANCE | 财务报表（只读）、站内信 |
| TENANT_VIEWER | 订单列表（只读）、财务报表（只读） |

### 金额展示

金额字段为字符串，展示时用 `shared-utils` 中的格式化函数，禁止直接 `parseFloat`。

### Excel 导入

使用 SheetJS 在浏览器端解析，**不上传原始文件到服务端**，仅提交解析后的 JSON。

## C端收款页规范（apps/pay-h5）

- 首屏渲染目标 < 1秒，禁止引入 React/Vue 等重框架
- 禁止在 H5 页面传入金额参数到后端
- 四态页面：`UNPAID` / `PAYING` / `PAID` / `EXPIRED`，严格按状态机渲染，不做额外分支

## 打印方案

**仅使用浏览器 `@media print` + 隐藏 iframe**，不做 Electron 客户端。
后端 `POST /print/jobs` 返回打印数据，前端直接触发浏览器打印对话框。

## 类型共享规范（packages/shared-types）

- Prisma 生成的模型类型从此包统一导出
- 所有 API 请求/响应 DTO 在此定义，前后端共用，禁止各自重复定义
- 全局枚举（PayStatusEnum、DeliveryStatusEnum、UserRoleEnum 等）在此维护

## 禁止事项

- **禁止** 在任何 Prisma 查询中省略 `tenantId` 过滤（除 OS 模块）
- **禁止** UPDATE `biz_order.totalAmount` 字段
- **禁止** 在 Controller 层写业务逻辑
- **禁止** 在 C端 H5 引入 React/Vue/Angular 等重框架
- **禁止** 硬编码密钥、数据库连接串等敏感配置（使用环境变量）
- **禁止** 物理删除财务相关表数据（订单、支付流水使用软删除）
- **禁止** 动态自建角色，角色枚举硬编码为 6 个固定值
- **禁止** 为假设的未来需求预先设计抽象层

## 司机边界说明

司机**不在系统内**，无账号、无登录、无任何 API 交互。订单表以 `deliveryPersonName` 字符串字段记录送货人姓名，不建立外键关联。

## Git 提交规范

使用 Commitlint 约定格式：
```
feat(order): 新增手工标记已支付接口
fix(payment): 修复 Webhook 重复入账问题
chore(prisma): 更新 schema 添加 customFields 字段
```

类型：`feat` / `fix` / `refactor` / `test` / `docs` / `chore`，scope 对应模块名。

## 关键设计文档

编码前请阅读：
- `docs/prisma.md` — 完整数据库 Schema，直接可用
- `docs/API.md` — V1.2 接口规范，含请求/响应示例
- `docs/plan_solution.md` — 架构与技术选型决策
- `docs/logic_diagram.md` — 业务逻辑全局思维导图
