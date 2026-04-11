# AGENTS.md

本文件定义本仓库对智能编码代理的默认约束。除非用户在当前任务中明确覆盖，否则进入本仓库后应默认遵守本文件。

## 一、语言与沟通

1. 与用户沟通默认使用中文。
2. 仓库内新增或重写的说明性文档默认使用中文。
3. 对外暴露的英文标识只用于代码、接口路径、枚举值、库名和命令，不使用中文值替代英文事实值。

## 二、事实源顺序

涉及接口、字段、枚举、状态机、数据模型时，必须遵守以下单向事实源顺序：

1. `docs/api/*.md`
2. `packages/types/src/enums`
3. `packages/types/src/contracts`
4. `docs/prisma/data-model-reference.md`
5. `apps/api` 实现代码
6. Swagger / OpenAPI

约束：

1. `docs/api` 定义业务语义。
2. `enums` 定义闭集值与英文枚举名。
3. `contracts` 只做请求、响应和资源结构投影，不反向定义业务。
4. `data-model-reference` 只做服务端建模同步。
5. Swagger / OpenAPI 只是联调产物，不得反向推动接口改义。

## 三、执行手册

`design` 目录下以下 3 份文件是当前阶段生效的执行手册：

1. `design/api-implementation-plan.md`
2. `design/api-technical-debt.md`
3. `design/api-regression-checklist.md`

要求：

1. 进入真实编码前，先看总纲，再按需要查看技术债台账与回归清单。
2. 不平行新增“讨论版”“临时版”“最终版”同类文档；若有修订，直接更新原文件。
3. 历史阶段文件统一放入 `design/archived`，不再作为当前执行依据。

## 四、当前项目状态

1. 当前仓库已完成首轮后端落地，进入“稳态迭代、联调补强、技术债收口”阶段。
2. `apps/api` 中主链路模块已按当前文档完成重建，但旧 MVP 残留代码仍只能作为历史实现参考。
3. `auth` 机制、租户作用域、主链路模型可继续复用，新增改动应直接在当前契约上增量演进。
4. `notification`、`report` 属于已收口的外围域，后续按真实业务需要增强，不再作为主事实源讨论对象。

## 五、编码边界

1. 不恢复已废弃的 `/print/jobs` 语义。
2. 不让旧字段重新进入主链路，例如 `erpOrderNo`、`templateId`、`customFields`、旧 `payStatus` 主流程。
3. 打印配置只存黑盒 JSON，不在服务端解析模板内部结构。
4. 多租户隔离、支付金额正确性、状态机一致性高于“先把功能写出来”。
5. 未被当前阶段执行清单允许触达的域，不主动扩散修改。

## 六、默认分层

新增或重构后端实现时，默认遵守以下分层边界：

1. controller 只处理 HTTP 契约、参数校验、鉴权接入和响应组装。
2. service 只处理业务语义、状态流转、事务边界和幂等收口。
3. Prisma 查询与写入只承载持久化，不散落核心业务判断。
4. 变更完成后，按需要同步 Swagger、回归清单和技术债台账。

## 七、文档同步规则

发生以下变更时，必须同步检查对应文档：

1. 改接口：检查 `docs/api`、`enums`、`contracts`、Swagger。
2. 改枚举：检查 `docs/api`、`packages/types/src/enums`、`packages/types/src/contracts`、`docs/enums/enum-manual.md`。
3. 改数据模型：检查 `docs/prisma/data-model-reference.md` 与 `schema.prisma`。
4. 改实施计划或阶段边界：检查 `design/api-implementation-plan.md`，并按需要同步技术债台账与回归清单。

## 八、文档职责划分

1. `README.md`
   面向项目使用者，说明项目现状、环境准备、启动方式、目录结构和阅读入口。
2. `AGENTS.md`
   面向代理，定义仓库级默认规则和事实源顺序。
3. `.codex/skills/*`
   面向专项任务，承载更细的领域工作流，不替代 `AGENTS.md`。

## 九、开始任务时的默认动作

1. 先确认任务属于哪个阶段、哪个模块。
2. 先看事实源和 3 份活文档，再看旧实现。
3. 先判断是复用、校准、重写还是暂缓，不直接在旧代码上叠加。
