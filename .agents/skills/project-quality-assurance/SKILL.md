---
name: Project Quality Assurance
description: 经销商订单收款平台落地的核心技能与质量保证规范，强制校验多租户与财务红线。
---

# 经销商订单收款平台 - 质量保证与核心技能 (Project Quality Assurance)

这套技能与规范用于指导本项目的落地，确保系统的**高可用性、数据隔离安全性、财务严谨性以及极致的 C 端体验**。在进行该项目开发时，必须严格遵守以下法则：

## 一、 财务安全与多租户隔离把控能力 (最核心防线)
这是 SaaS 平台和订单收款系统的命脉，决不允许出问题。
1. **多租户隔离强校验 (Multi-tenant Isolation)**：
   - 绝不能仅仅依赖开发者的自觉。需要配置 **Prisma Client Extensions (或 Middleware)**，在底层的查询拦截层强制校验并自动注入 `tenantId`，一旦检测到遗漏直接抛出异常，从根源拦截“越权查询”或“串数据”的灾难。
2. **高精度数字与金额计算 (Financial Mathematics)**：
   - 掌握并强制要求使用高精度库（如封装在 `shared-utils` 中的工具）进行金额运算。数据库与传输全程使用字符串格式（如 `"1580.00"`）。
   - 建立**资金对账心智**：强制校验恒等式 `totalAmount = paidAmount + discountAmount`，打破该等式的写入操作直接被拒绝，且 `totalAmount` 永远禁止 UPDATE。
3. **高并发与分布式竞态控制 (Concurrency Control)**：
   - 熟练使用 **Redis 分布式锁**，处理发卡/扫码瞬间的高并发，防止超卖或重复支付。
   - 掌握 **Webhook 幂等性设计**，利用数据库的唯一索引（如 `channelTradeNo`）安全优雅地处理第三方支付回调的重复入账问题。

## 二、 后端核心开发与架构能力 (NestJS + Prisma)
后端团队必须具备严谨的分层思想和严格类型约束。
1. **NestJS 严格分层模式 (DI & IOC)**：
   - 严格划分 Controller (仅路由与出入参，不含业务逻辑) 与 Service (核心业务逻辑全在此)。禁止跨层调用。
   - 熟练运用 Guards (守卫) 处理鉴权与多租户 Token 解析（`tenantId` 必须从 JWT Payload 注入）。
2. **Class-Validator 边界防御**：
   - 深入理解 DTO 校验，使用 `class-validator`。将一切不合法的参数（如前端传入的 `tenantId` 或 `amount`）在进入 Controller 之前拦截。
3. **日志与审计 (Audit Logging)**：
   - 所有关键操作流转（如下单、支付、改价等）必须写入 `OrderLifecycleLog`，尤其是改价，必须记录 before/after 状态快照。

## 三、 前端极致分离能力 (React + Preact)
1. **TanStack Query + Zustand 状态管理哲学**：
   - PC前端 (admin/tenant) 必须清晰区分 服务端状态（TanStack Query）和 客户端 UI 状态（Zustand）。禁止用 useState 管理服务端数据。
2. **H5 性能极客优化引擎 (Performance Tuning)**：
   - C端扫码页首屏渲染目标 < 1秒，禁止引入 React/Vue 等重框架，强制使用更轻量的 Preact 或原生手写。严格按状态机（未支付/支付中/已支付/已过期）渲染页面，不做额外分支。
3. **浏览器原生 API 的深度使用**：
   - 纯依靠浏览器原生 `@media print` 以及隐藏 iframe 实现小票打印，不做 Electron。
   - 本地使用 `SheetJS` 在前端浏览器解析 Excel 导入订单，不传物理文件到服务端。

## 四、 Monorepo 工程化管理能力 (Turborepo + pnpm)
1. **前后端类型共享**：
   - `packages/shared-types` 作为唯一类型基准源，前后端 DTO 与枚举（如 PayStatusEnum, UserRoleEnum）强一致，禁止在各自项目中重复定义。
2. **角色与越权防护**：
   - 绝不搞复杂的动态自建角色菜单，角色枚举硬编码（如 老板、操作员、财务、浏览者）作为条件渲染依据。

## 五、 质量保证体系 (QA System)
1. 把所有 "禁止事项" 转化为自动化约束代码与 PR 拦截，从物理架构层面禁止不安全的代码进入主干（如禁止物理删除财务流水只能软删）。
2. 任何违反上述安全红线、租户隔离原则的代码，均视为无效代码逻辑。
