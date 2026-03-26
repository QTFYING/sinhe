# 经销商订单收款平台 - 落地计划 (Implementation Plan)

这个计划涵盖了项目从 0 到 1 的所有核心演进步骤，强烈建议按顺序逐一打勾推进。

## 第1步：工程骨架 + 共享包 (前置依赖)
- [ ] 初始化 Monorepo (`pnpm-workspace.yaml`, `turbo.json`, `.gitignore`)
- [ ] 基础 TypeScript 配置 (`tsconfig.base.json`)
- [ ] 初始化包 - `packages/shared-types` (从 Prisma Schema 提取枚举与前后端共用 DTO)
- [ ] 初始化包 - `packages/shared-utils` (封装金额计算、日期格式化等高复用纯函数)
- [ ] 初始化包 - `packages/shared-ui` (空壳骨架，待抽离 Ant Design 组件)

## 第2步：数据库 + 后端核心模块 (`apps/api`)
- [ ] 设计并生成 `schema.prisma` 与 Prisma 迁移基线
- [ ] 配置 `docker-compose.yml` (PostgreSQL + Redis)，启动本地环境
- [ ] 搭建 `apps/api` 基础框架 (配置全局异常过滤、Prisma Client、Redis 锁实例)
- [ ] `Auth` 模块 (JWT 发放与鉴权守护)
- [ ] `Tenant` 模块 (多租户管理，包含 OS 特权接口)
- [ ] `Order` 模块 (订单核心流转、价格拆分、历史变更快照记录)
- [ ] `Import` 模块 (结构化导入的 DTO 对接与数据防重入库)
- [ ] `Payment` 模块 (分布式防重入账、扫码并发锁)
- [ ] `Print` 模块 (打印数据的批量抓取映射)
- [ ] `Report` / `Notification` 模块 (财务聚合查询、站内信)

## 第3步：前端逐端落地
- [ ] `apps/tenant` 经销商工作台 (高优：使用 React + TanStack Query + Zustand)
- [ ] `apps/admin` OS运营平台 (次优：复用 Tenant 中 80% 的查询封装与表格逻辑)
- [ ] `apps/pay-h5` C端买家页 (极速：使用 Preact 渲染四态支付流转)
