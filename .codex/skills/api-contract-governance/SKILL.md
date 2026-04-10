---
name: api-contract-governance
description: 统一维护本仓库的 API 文档、枚举、contracts 与数据模型参考。新增或调整接口、字段、状态机、闭集枚举、共享请求响应结构时使用；尤其适用于修改 `docs/api`、`packages/types/src/enums`、`packages/types/src/contracts`、`docs/enums/enum-manual.md`、`docs/prisma/data-model-reference.md` 的场景。
---

# API 契约治理

按单向事实源维护接口体系，禁止让实现代码或 `contracts` 反向定义文档。

## 事实源顺序

1. `docs/api/*.md`
   定义业务语义、字段含义、请求响应结构和状态流转。
2. `packages/types/src/enums`
   定义闭集值，是唯一枚举事实源。
3. `packages/types/src/contracts`
   投影文档与枚举，生成可复用的入参、出参和 DTO 类型。
4. `docs/prisma/data-model-reference.md`
   同步服务端建模结果，不定义另一套业务语义。

## 执行步骤

1. 先确认变更属于哪个业务域。
2. 先改 `docs/api`，把业务结构和字段解释写清楚。
3. 再改 `packages/types/src/enums`，统一闭集值和中文注释。
4. 再改 `packages/types/src/contracts`，只做类型投影。
5. 最后同步 `docs/enums/enum-manual.md` 与 `docs/prisma/data-model-reference.md`。

## 强约束

- 文档正文必须可独立阅读，不能只写“见某个类型名”。
- 枚举值必须使用稳定英文值，中文只允许出现在注释和文档说明中。
- `contracts` 默认不写中文字段注释，中文释义以 API 文档正文为准。
- `contracts` 不能发明文档里没有确认的字段、状态或流程。
- `docs/archived/logic_diagram.md` 只作历史背景参考，不能覆盖当前 API 文档。
- 禁止重建 `packages/types/src/types`。

## 重点检查

- 是否出现旧别名或旧状态值残留。
- 文档、枚举、contracts、data-model 是否仍然同名同义。
- 文档中首次出现的关键枚举，是否直接展开真实值和中文语义。
- `contracts` 是否出现早已废弃的旧字段。

## 完成标准

- 三份 API 子文档可直接供前端联调。
- 枚举只在 `enums` 定义一次。
- `contracts` 不再成为第一事实源。
- `data-model-reference` 与 API 文档不冲突。
