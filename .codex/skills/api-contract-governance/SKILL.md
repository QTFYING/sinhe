---
name: api-contract-governance
description: 统一维护本仓库的枚举定义、API 契约和接口文档。修改 `packages/types/src/enums`、`packages/types/src/contracts`、`docs/api/*.md`、`docs/prisma/data-model-reference.md` 或 `docs/enums/enum-manual.md` 时使用，尤其适用于新增或调整状态机、闭集字段、共享请求结构和响应结构的场景。
---

# API 契约治理

保持仓库内只有一套共享契约体系：

- `enums` 是闭集字段的唯一事实源
- `contracts` 只承载请求、响应和资源结构
- `docs/api/*.md` 对前端直接可读
- `docs/prisma/data-model-reference.md` 只做服务端建模参考

## 执行顺序

1. 先确认变更范围
   如果改动涉及状态值、角色编码、支付方式、排序字段或其它闭集字段，先从 `packages/types/src/enums` 开始。

2. 先改 `enums`
   在 `packages/types/src/enums/*` 中维护 `XxxEnum` 和 `Xxx`。
   枚举值必须使用稳定英文值。
   每个枚举定义和每个枚举成员都必须补中文 JSDoc。
   禁止引入中文 wire value。

3. 再改 `contracts`
   在 `packages/types/src/contracts/*` 中维护请求、响应、查询和资源结构。
   枚举类型统一从 `../enums` 引入。
   `contracts` 不能重新定义枚举事实源。
   `contracts` 默认不写中文注释，字段中文释义以 4 份 API 文档正文为准。
   只有黑盒 JSON、兼容约束字段、或语义明显反直觉的字段，才允许补充极少量说明。

4. 再改 API 文档
   优先修改 `docs/api/*.md`，再改 `docs/prisma/data-model-reference.md`。
   API 文档正文必须可以独立阅读：
   首次出现关键枚举时，直接展开真实值。
   保留中文字段释义。
   删除空的类型定义块。
   不能只写“见 enum-manual”就结束。

5. 最后同步补充文档
   在 `enums` 和 API 文档定稿后，再同步 `docs/prisma/data-model-reference.md` 与 `docs/enums/enum-manual.md`。
   `data-model-reference.md` 不是第二事实源，不能维护一套冲突值。

## 强约束

- `packages/types/src/types` 禁止重建
- `packages/types/src/contracts` 禁止成为第二枚举源
- 新增枚举值必须是英文稳定值
- 中文只允许出现在注释、表格说明和文档正文，不允许出现在契约值中
- 如果一个枚举变了，至少要联动检查：
  `packages/types/src/enums/*`
  `packages/types/src/contracts/*`
  `docs/api/*.md`
- 如果文档里出现 `PaymentOrderStatus` 这类类型名，附近正文仍要写清真实值和业务语义

## 一致性检查

改完后优先做定向搜索，重点检查：

- 旧别名是否残留，例如 `PayType`、`H5PayOrderStatus`、`PaymentMethodType`、`PackageStatus`
- `src/types` 路径是否被重新引用
- 文档里是否残留大写旧状态值或中文状态值
- 枚举成员是否漏了中文注释

推荐用 `rg`：

```powershell
rg -n "PayType|H5PayOrderStatus|PaymentMethodType|PackageStatus|src/types" packages docs
rg -n "UNPAID|PAYING|PENDING_VERIFICATION|PAID|EXPIRED" docs
rg -n "待初审|待复核|待确认|已通过|已驳回" docs
```

## 预期结果

- 前端不需要翻外部枚举字典，也能看懂 API 文档
- 后端可以直接依据 `enums + contracts + docs/api + data-model-reference` 落代码
- 仓库内只有一套枚举事实源
