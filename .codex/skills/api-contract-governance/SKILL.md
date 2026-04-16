---
name: api-contract-governance
description: 统一维护本仓库的 API 文档、枚举、contracts 与数据模型参考。新增或调整接口、字段、状态机、闭集枚举、共享请求响应结构时使用；尤其适用于修改 `docs/api`、`packages/types/src/enums`、`packages/types/src/contracts`、`docs/enums/enum-manual.md`、`docs/prisma/data-model-reference.md` 的场景。
---

# API 契约治理

按单向事实源维护接口体系。

## 适用场景

- 新增或调整接口、字段、状态机、闭集枚举。
- 修改 `docs/api`、`packages/types/src/enums`、`packages/types/src/contracts`、`docs/prisma/data-model-reference.md`。

## 必做顺序

1. 先确认变更属于哪个业务域。
2. 先改 `docs/api`，把字段、状态和值的语义写清楚。
3. 再改 `packages/types/src/enums`，收口闭集值。
4. 再改 `packages/types/src/contracts`，只做结构投影。
5. 影响枚举或建模时，再同步 `docs/enums/enum-manual.md` 与 `docs/prisma/data-model-reference.md`。

## 硬约束

- 顺序固定为 `docs/api -> enums -> contracts -> data-model-reference`。
- 不得从 `contracts`、代码或 Swagger 反向定义 `docs/api`。
- 新字段、新状态、新接口必须先在 `docs/api` 落名。
- 文档正文必须可独立阅读，不能只写“见某个类型名”。
- 枚举值必须使用稳定英文值。
- `contracts` 不得发明文档未确认的字段、状态或流程。
- 禁止重建 `packages/types/src/types`。

## 完成标准

- `docs/api` 可直接供前端联调。
- 枚举只在 `packages/types/src/enums` 定义一次。
- `contracts`、枚举、建模参考与 API 文档同名同义。
