---
name: nestjs-module-delivery
description: 按本项目既定契约落地 NestJS 业务模块。新增或重构 `apps/api/src/*` 模块、controller、service、dto、模块依赖关系时使用；尤其适用于把稳定的 API 文档和 contracts 转成可编码的后端模块实现。
---

# NestJS 模块落地

先对齐契约，再落 controller、service 与 Prisma 分层。

## 适用场景

- 新增或重构 `apps/api/src/*` 业务模块。
- 修改 controller、service、dto、模块依赖关系。

## 必做顺序

1. 先读对应 `docs/api/*.md` 和 `packages/types/src/contracts/*`。
2. 定义 controller 端点、入参和出参。
3. 在 service 收口业务语义、状态流转、事务和幂等。
4. 将数据查询与持久化收敛到 Prisma 调用层。
5. 补齐守卫、租户作用域、异常映射和必要的文档同步。

## 硬约束

- controller：只处理 HTTP 契约、参数校验、响应组装。
- service：只处理业务语义、状态流转、幂等规则和事务边界。
- Prisma 调用：只做数据查询与持久化，不承载复杂业务判断。
- 不允许 controller 直接散落业务判断。
- 不允许 service 继续沿用文档已废弃的旧字段名。
- 需要事务的链路必须显式用 Prisma transaction 包裹。
- 需要幂等的接口只在真正有业务风险的地方实现，不泛滥上锁。
- Tenant 侧默认按 token 中的 `tenantId` 隔离。

## 交付检查

- 模块输入输出与 contracts 一致。
- 业务状态机只在 service 收口。
- 管理端跨租户接口不会错误复用租户侧作用域。
