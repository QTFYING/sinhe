---
name: nestjs-module-delivery
description: 按本项目既定契约落地 NestJS 业务模块。新增或重构 `apps/api/src/*` 模块、controller、service、dto、模块依赖关系时使用；尤其适用于把稳定的 API 文档和 contracts 转成可编码的后端模块实现。
---

# NestJS 模块落地

先固化模块边界，再写接口逻辑，避免把控制器、业务状态机和 Prisma 查询揉在一起。

## 适用对象

- `auth`
- `order`
- `payment`
- `import`
- `print`
- `tenant`
- `admin` 侧业务模块

## 实施顺序

1. 读取对应 `docs/api/*.md` 和 `packages/types/src/contracts/*`。
2. 定义 controller 端点、入参和出参。
3. 设计 service 的业务职责和状态流转。
4. 将持久化读写收敛到 Prisma 调用层。
5. 补齐守卫、租户作用域和异常映射。

## 分层规则

- controller：只处理 HTTP 契约、参数校验、响应组装。
- service：只处理业务语义、状态流转、幂等规则和事务边界。
- Prisma 调用：只做数据查询与持久化，不承载复杂业务判断。
- 公共能力：金额计算、租户作用域、异常码、审计事件应抽公共层。

## 强约束

- 不直接把前端页面视图模型写死在 service 中。
- 不允许 controller 直接散落业务判断。
- 不允许 service 继续沿用文档已废弃的旧字段名。
- 需要事务的链路必须显式用 Prisma transaction 包裹。
- 需要幂等的接口只在真正有业务风险的地方实现，不泛滥上锁。

## 交付检查

- 模块输入输出与 contracts 一致。
- 业务状态机只在 service 收口。
- 租户接口默认按 token 中的 `tenantId` 隔离。
- 管理端跨租户接口不会错误复用租户侧作用域。
