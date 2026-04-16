# AGENTS.md

本文件定义本仓库对智能编码代理的默认约束。

## 1. 语言

- 与用户沟通默认使用中文。
- 新增或重写的说明性文档默认使用中文。
- 英文仅用于代码、接口路径、枚举值、库名和命令。

## 2. 全局约束入口

以下内容对项目持续生效：

1. `README.md`
2. `AGENTS.md`
3. `.codex/skills/*`
4. `docs/api/*.md`

## 3. 事实源顺序

涉及接口、字段、枚举、状态机、数据模型时，按以下顺序判断：

1. `docs/api/*.md`
2. `packages/types/src/enums`
3. `packages/types/src/contracts`
4. `docs/prisma/data-model-reference.md`
5. `apps/api` 实现代码
6. Swagger / OpenAPI

补充：

- `docs/api` 定义业务语义
- `enums` 定义闭集值
- `contracts` 只做结构投影
- `data-model-reference` 只做建模同步
- Swagger / OpenAPI 不得反向推动接口改义

## 4. 非事实源

`design/`、`notes/`、`review/`、`docs/archived/` 只作背景参考，不作为编码或设计事实源。

## 5. 编码边界

- 不恢复已废弃的 `/print/jobs` 语义。
- 不让旧字段重新进入主链路，例如 `erpOrderNo`、`templateId`、`customFields`、旧 `payStatus` 主流程。
- 打印配置只存黑盒 JSON，不在服务端解析模板内部结构。
- 多租户隔离、支付金额正确性、状态机一致性高于“先把功能写出来”。

## 6. 默认分层

- controller 只处理 HTTP 契约、参数校验、鉴权接入和响应组装。
- service 只处理业务语义、状态流转、事务边界和幂等收口。
- Prisma 查询与写入只承载持久化，不散落核心业务判断。

## 7. 文档同步

- 改接口：检查 `docs/api`、`contracts`、Swagger。
- 改枚举：检查 `docs/api`、`enums`、`contracts`、`docs/enums/enum-manual.md`。
- 改数据模型：检查 `docs/prisma/data-model-reference.md` 与 `schema.prisma`。
- 改仓库级规则：检查 `README.md`、`AGENTS.md` 与相关 `.codex/skills/*`。

## 8. 默认动作

1. 先读 `README.md` 与 `AGENTS.md`。
2. 再读对应业务域的 `docs/api/*.md`。
3. 必要时继续看 `enums`、`contracts`、`data-model-reference`。
4. 最后再看当前实现代码。
