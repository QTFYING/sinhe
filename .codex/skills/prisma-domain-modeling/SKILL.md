---
name: prisma-domain-modeling
description: 统一维护本项目的 Prisma 领域建模。新增或调整 `apps/api/prisma/schema.prisma`、唯一键、组合索引、多租户字段、金额字段、黑盒 JSON 配置字段时使用；尤其适用于把 `docs/prisma/data-model-reference.md` 同步成可执行 schema。
---

# Prisma 领域建模

先让数据模型自洽，再写业务代码。Prisma schema 必须服务于 API 文档，而不是反过来驱动接口设计。

## 入口约束

1. 先遵守仓库根目录 `AGENTS.md`。
2. 先确认当前建模属于哪一阶段，再决定是否进入 `schema.prisma` 改动。
3. 若 `design/api-implementation-plan.md` 已明确某域暂缓或冻结，不提前为该域扩展模型；若相关风险已登记，还需同步参考技术债台账。

## 建模顺序

1. 先读 `docs/prisma/data-model-reference.md`。
2. 回看对应 `docs/api/*.md`，确认字段是否真正被接口使用。
3. 设计模型、关系、唯一键、索引和软删除策略。
4. 校验模型命名与 `contracts`、`enums` 是否一致。

## 建模规则

- 多租户业务表优先显式带 `tenantId`。
- 对外标识、幂等键、映射关系要有物理唯一约束。
- 金额字段统一使用 `Decimal`。
- 黑盒配置统一用 `Json`，并在文档中声明服务端不解析内部结构。
- 若状态闭集已在 `enums` 定义，schema 中的枚举或字符串字段语义必须保持一致。

## 本项目重点

- `orders.qrCodeToken` 必须可唯一定位 H5 路由。
- 打印配置持久化维度是 `tenantId + importTemplateId`。
- 打印回执批次幂等维度是 `tenantId + requestId`。
- 支付尝试、支付流水、订单实收金额之间必须能相互追溯。

## 禁止事项

- 不沿用文档已废弃的旧字段名做“兼容”。
- 不在 schema 中保留无文档归属的历史字段。
- 不让 `docs/archived/logic_diagram.md` 里的旧模型覆盖当前建模。

## 完成标准

- schema 字段名与 API 文档一致。
- 主键、唯一键、索引能支撑主要查询与幂等需求。
- 生成的 Prisma Client 足够支撑后续模块实现。

