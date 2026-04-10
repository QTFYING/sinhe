---
name: api-contract-governance
description: 统一维护本仓库的枚举定义、API 契约和接口文档。修改 `packages/types/src/enums`、`packages/types/src/contracts`、`docs/api/*.md`、`docs/prisma/data-model-reference.md` 或 `docs/enums/enum-manual.md` 时使用，尤其适用于新增或调整状态机、闭集字段、共享请求结构和响应结构的场景。
---

# API 契约治理

保持仓库内只有一套共享契约体系：

- `docs/api/*.md` 定义业务结构，是接口语义事实源
- `packages/types/src/enums` 定义闭集值，是枚举事实源
- `packages/types/src/contracts` 只做请求、响应和资源结构投影
- `docs/prisma/data-model-reference.md` 只做服务端建模同步
- 禁止让 `contracts` 反过来重定义或推动 API 文档

## 执行顺序

1. 先确认变更范围
   如果改动涉及状态值、角色编码、支付方式、排序字段或其它闭集字段，先从 `packages/types/src/enums` 开始。

2. 先改 `enums`
   在 `packages/types/src/enums/*` 中维护 `XxxEnum` 和 `Xxx`。
   枚举值必须使用稳定英文值。
   每个枚举定义和每个枚举成员都必须补中文 JSDoc。
   禁止引入中文 wire value。

3. 再定稿 `docs/api`
   优先确认并修改 `docs/api/*.md`。
   API 文档正文必须可以独立阅读：
   首次出现关键枚举时，直接展开真实值。
   保留中文字段释义。
   删除空的类型定义块。
   不能只写“见 enum-manual”就结束。

4. 再投影 `contracts`
   在 `packages/types/src/contracts/*` 中维护请求、响应、查询和资源结构。
   枚举类型统一从 `../enums` 引入。
   `contracts` 不能重新定义枚举事实源。
   `contracts` 默认不写中文注释，字段中文释义以 4 份 API 文档正文为准。
   只有黑盒 JSON、兼容约束字段、或语义明显反直觉的字段，才允许补充极少量说明。
   `contracts` 只能减少重复代码，不能新增一套文档里没有确认的业务语义。

5. 最后同步补充文档
   在 `enums`、`docs/api` 和 `contracts` 定稿后，再同步 `docs/prisma/data-model-reference.md` 与 `docs/enums/enum-manual.md`。
   `data-model-reference.md` 不是第二事实源，不能维护一套冲突值。

## 强约束

- `packages/types/src/types` 禁止重建
- `packages/types/src/contracts` 禁止成为第二枚举源
- `packages/types/src/contracts` 禁止成为业务结构的第一事实源
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
- `contracts` 是否出现文档里已经废弃的字段名

推荐用 `rg`：

```powershell
rg -n "PayType|H5PayOrderStatus|PaymentMethodType|PackageStatus|src/types" packages docs
rg -n "UNPAID|PAYING|PENDING_VERIFICATION|PAID|EXPIRED" docs
rg -n "待初审|待复核|待确认|已通过|已驳回" docs
rg -n "contactName|qrExpiryDays|notifyDriver|notifyBoss|lineId|skuCode|period:" packages/types/src/contracts
```

## 预期结果

- 前端不需要翻外部枚举字典，也能看懂 API 文档
- 后端可以直接依据 `docs/api + enums + contracts + data-model-reference` 落代码
- 仓库内只有一套枚举事实源，且 `contracts` 不再反向影响文档
