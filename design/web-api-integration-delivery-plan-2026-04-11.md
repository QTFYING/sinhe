# 前端项目接入 API 落地方案

> 日期：2026-04-11
> 文档状态：当前生效
> 文档定位：前端接入执行手册
> 适用范围：`D:\Sinhe\web`
> 关联仓库：`D:\Sinhe\api`
> 目标：以当前后端标准 API 为唯一事实源，推动 `web` 项目从 mock / 原型态逐步切换到真实接口联调态

本手册用于定义前端项目接入服务端 API 的阶段划分、工程准备、mock 策略、联调顺序与验收标准。
凡与前端契约来源、shared api 分层、mock 维护时机、H5 / 打印接入方式有关的判断，以本手册为准。

## 一、当前现状判断

截至 2026-04-11，`web` 项目已经具备部分 API 接入壳，但整体仍未进入“按真实 API 联调”的稳定状态。

当前判断如下：

1. `web` 项目内存在独立维护的 `packages/shared/src/contracts` 与 `packages/shared/src/types`，其中已出现与后端 `docs/api`、`packages/types` 漂移的情况。
2. `packages/shared/src/api/modules/*` 中仍残留旧路径、旧字段和旧动作接口，例如：
   - `/orders/{id}/remind`
   - `/orders/{id}/mark-received`
   - `/orders/{id}/verify-cash`
   - `/orders/{id}/print`
   - `/orders/batch/print`
   - `/pay/orders/{orderNo}`
3. `web` 当前默认数据源仍偏向本地 mock，页面“能显示”不能代表已接通真实后端。
4. `tenant` 的订单列表、订单详情、导入模板、分析看板已有一定 shared api 接入基础，但页面语义与真实契约未完全对齐。
5. `h5` 入口与支付链路仍停留在旧模型：
   - 以 `orderNo` 为入口
   - 以 `/pay/orders/{orderNo}` 为路径
   - 保留旧支付通道与旧状态值假设
6. `printing` 相关页面仍以本地模板工作台为主，未按当前后端 `settings/printing*` 与 `orders/print-records` 契约接入。
7. `admin` 前端虽然复用了部分 shared api，但后端当前并未完整提供对应的跨租户 order / payment 联调能力，不能视为已接入范围。

结论：

1. 当前 `web` 的核心问题不是“少几个接口”，而是“前端本地契约、mock 语义、H5 / 打印产品模型尚未彻底切换到后端事实源”。
2. 因此，前端接入工作必须先收口契约和工程边界，再按模块逐步联调，不应直接在现有页面上继续叠加修补。

## 二、前置原则

前端接入阶段继续遵守以下单向事实源顺序：

1. `D:\Sinhe\api\docs\api\*.md`
2. `D:\Sinhe\api\packages\types\src\enums`
3. `D:\Sinhe\api\packages\types\src\contracts`
4. `D:\Sinhe\api\docs\prisma\data-model-reference.md`
5. `D:\Sinhe\web\packages\shared\src\api`
6. `D:\Sinhe\web\apps\*\src\features\*\repositories`
7. `D:\Sinhe\web\apps\*\src\pages`

补充约束：

1. 前端页面不得自行发明新的接口路径、字段名、状态值和支付入口规则。
2. `mock` 不是事实源，只是开发期镜像层与场景层。
3. H5 支付入口、打印二维码、打印回执必须服从后端当前设计：
   - H5 入口基于 `qrCodeToken`
   - H5 路由为 `/pay/:token`
   - 打印成功回执为 `POST /orders/print-records`
4. 前端本地 `contracts`、`types` 若与后端事实源冲突，必须以前者清理或收口为目标，而不是继续做兼容事实源。
5. 是否“完成接入”以 remote 联调结果为准，不以 mock 页面可见为准。

## 三、总体目标

本轮前端接入工作的总体目标不是“先把所有页面都改完”，而是建立一套可以持续演进的接入基线。

目标分为四类：

1. 契约基线
   - 前端只消费一套稳定的 API 契约
   - 不再自维护第二套业务真相
2. 工程基线
   - shared api、repository、hook、page 的职责清晰
   - mock 与 remote 可以明确切换并可追踪
3. 联调基线
   - 至少打通 `auth -> tenant order -> h5 payment -> printing` 主链路
4. 质量基线
   - 关键状态机、金额口径、二维码入口、多租户隔离在前端展示层不再失真

## 四、开工前必须完成的准备

### 4.1 仓库级规则

在 `web` 仓库落地以下规则：

1. 新增 `AGENTS.md`
   - 明确前端事实源顺序
   - 明确 mock 不是事实源
   - 明确页面不能跳过 shared api 与 repository 直接拼接口
2. 在 `README.md` 或执行手册中补充当前页面状态说明
   - 哪些页面是 remote-ready
   - 哪些页面仍是 prototype
   - 如何切换 mock / remote

### 4.2 推荐新增 skills

建议在 `web` 仓库补 4 个中文 skills：

1. `frontend-api-contract-alignment`
   - 用于接接口前核对 `docs/api -> enums -> contracts -> shared/api -> repository`
2. `mock-to-remote-migration`
   - 用于把页面从 mock / seed 迁到真实接口
3. `h5-and-print-integration`
   - 用于统一处理 `qrCodeToken`、`/pay/:token`、打印配置、打印回执
4. `frontend-integration-qa`
   - 用于做联调后的状态机、字段、枚举和空值语义复核

### 4.3 工程分层约束

前端代码按以下职责收口：

1. `packages/shared/src/api/*`
   - 只负责请求封装
   - 不承载业务真相
2. `repositories/*`
   - 只负责调用 shared api 与做最小返回编排
3. `services/*mapper.ts`
   - 只允许做展示映射
   - 不允许改写业务语义
4. `pages/*`
   - 不允许直接拼接 H5 支付地址
   - 不允许自己推断支付状态机
   - 不允许自己决定打印回执接口

### 4.4 remote 联调约束

联调期间增加以下硬规则：

1. 默认以 remote 为主，不以 mock 为主。
2. 每个已进入联调范围的页面，都要能在 UI 中明确显示当前数据源是 `mock` 还是 `remote`。
3. 若某页仍必须依赖 mock，必须在手册与页面注释中明确标记原因。

## 五、mock 维护策略

### 5.1 mock 的定位

`mock` 保留，但仅保留两种价值：

1. 联调后备 mock
   - 后端暂未完成时，用于前端局部开发兜底
2. 场景模拟 mock
   - 用于构造异常态、空态、边界态、支付中、已过期、导入冲突等特定场景

禁止继续保留：

1. 作为事实源的 mock
2. 与后端当前契约冲突但仍被页面当成主数据源的 mock

### 5.2 mock 的矫正时机

mock 不作为第一阶段优先事项。

正确顺序为：

1. 先打通 remote 主链路
2. 再回头对 mock 做契约化矫正
3. 最后补高价值场景 mock

### 5.3 mock 的维护阶段

mock 维护放在 `M2` 末到 `M3` 初执行：

1. `M1` 不专门修 mock，只允许临时最小兜底
2. `M2` 主链路稳定后，统一替换旧路径、旧字段、旧状态
3. `M3` 补支付、打印、导入等复杂场景 mock

## 六、实施阶段划分

| 阶段 | 主题 | 目标 | 当前建议 |
|---|---|---|---|
| `M0` | 接入基线准备 | 规则、skills、shared 层边界、联调约束落地 | 立即执行 |
| `M1` | 契约收口 | 收口前端本地 contracts / types / shared api | 第一优先级 |
| `M2` | Tenant 主链路联调 | 打通登录、订单、导入、基础设置、H5 主入口 | 主线阶段 |
| `M3` | H5 与打印联调 | 切换 `qrCodeToken`、打印配置、打印回执 | 高优先级 |
| `M4` | mock 契约化矫正 | 以真实契约校准 mock，补高价值场景 | 次主线 |
| `M5` | Admin 与外围域评估 | 在后端能力具备后再推进平台侧页面联调 | 后续阶段 |

## 七、各阶段实施内容

### 7.1 `M0` 接入基线准备

必须完成：

1. `web/AGENTS.md` 落地
2. `web` 侧接入 skills 落地
3. 明确 remote / mock 切换规则
4. 盘点当前 shared api、repository、mock、页面的事实源冲突点

输出物：

1. 仓库规则文件
2. skills 文件
3. 前端 API 接入执行清单

### 7.2 `M1` 契约收口

目标：让前端不再维护第二套业务真相。

必须完成：

1. 收口或删除 `packages/shared/src/contracts/*`
2. 收口或重写 `packages/shared/src/types/*`
3. 统一改造 `packages/shared/src/api/modules/*`
4. 清理以下旧接口：
   - `/orders/{id}/remind`
   - `/orders/{id}/mark-received`
   - `/orders/{id}/verify-cash`
   - `/orders/{id}/print`
   - `/orders/batch/print`
   - `/pay/orders/{orderNo}`
5. 清理以下旧值：
   - 中文 `现款 / 账期`
   - 大写 H5 支付状态值
   - 旧支付通道字眼

阶段结论：

1. 前端 shared 层只承载后端当前契约的投影
2. 页面后续联调不再建立在旧假设上

### 7.3 `M2` Tenant 主链路联调

联调顺序如下：

1. `auth`
   - 登录字段切到 `account`
   - refresh / logout / me 校准
2. `tenant orders`
   - 列表
   - 详情
   - 创建 / 更新 / 作废
   - reminders
   - receipts
3. `import`
   - 模板列表
   - 创建模板
   - 更新模板
   - 预检
   - 异步导入任务
4. `settings/general`
   - 从本地 state 切换到真实接口
5. `notifications`
   - 已读接口切到 `/notifications/{id}/read-records`

阶段验收：

1. 登录到订单列表可完全走 remote
2. 订单相关动作不再调用旧 RPC 风格路径
3. 页面不再依赖 mock 才能跑通

### 7.4 `M3` H5 与打印联调

这是本轮接入中最关键的收口阶段。

必须完成：

1. H5 入口从 `orderNo` 切换到 `qrCodeToken`
2. H5 路由切换为 `/pay/:token`
3. H5 payment repository / page 状态机与后端真实状态值对齐
4. 打印二维码改为使用 `orders.qrCodeToken`
5. 打印成功后调用 `POST /orders/print-records`
6. 打印设置页改为对接：
   - `GET /settings/printing`
   - `GET /settings/printing/{importTemplateId}`
   - `PUT /settings/printing/{importTemplateId}`
7. 停止前端自行维护“可新增 / 删除打印模板”的产品模型

阶段验收：

1. 打印出来的二维码能打开真实 H5 页面
2. H5 页面状态与后端支付状态机一致
3. 打印次数以服务端回执为准

### 7.5 `M4` mock 契约化矫正

目标：让 mock 成为真实契约镜像，而不是历史残留。

必须完成：

1. 按后端当前接口统一替换 mock 路径
2. 按后端当前字段统一替换 mock payload
3. 删除已废弃旧链路 mock
4. 新增高价值场景 mock：
   - `paying`
   - `pending_verification`
   - `expired`
   - `qrCodeToken` 缺失
   - 打印配置未维护
   - 导入冲突
   - 部分成功 / 全失败

阶段验收：

1. mock 与 remote 返回结构同名同义
2. 页面切换 mock / remote 时，不需要改业务代码

### 7.6 `M5` Admin 与外围域评估

该阶段不是立即执行项。

进入条件：

1. 后端跨租户 order / payment 能力已经明确并落地
2. Tenant 主链路联调稳定
3. shared 层不再残留旧契约噪音

## 八、优先整改清单

第一批必须立即处理的点：

1. 登录请求从 `username` 改为 `account`
2. shared api 清理旧动作接口
3. `PayType` 中文值退出主链路
4. H5 支付入口从 `orderNo` 改为 `qrCodeToken`
5. 打印二维码不再前端拼接 query 参数 URL
6. 打印预览不再依赖外部第三方二维码生成服务

第二批高优先级：

1. `settings/general` 接真实接口
2. `settings/printing*` 接真实接口
3. `notifications/read-records` 校准
4. 导入流程从原型切换到真实接口

## 九、统一验收标准

每个阶段都按以下标准验收：

1. 契约一致性
   - 前端请求路径、请求体、响应体、枚举值与后端事实源一致
2. remote 可运行性
   - 当前阶段涉及页面能真实请求后端并完成主要交互
3. mock 可替换性
   - 若存在 mock，切换 mock / remote 不需要改页面业务逻辑
4. 状态机正确性
   - H5 支付、订单回款、打印状态展示与后端真实状态一致
5. 敏感数据边界
   - 前端不把订单客户、金额等业务数据通过第三方二维码服务外发
6. 历史残留清理
   - 当前阶段涉及的旧路径、旧字段、旧状态不再留在主链路

## 十、非目标

当前方案明确不做以下事情：

1. 不为了兼容旧前端 mock 而反向修改后端当前 API 文档
2. 不在 Tenant 主链路未稳定前，强行推进 Admin 全量联调
3. 不继续扩展前端本地“第二事实源” contracts / types
4. 不继续维持旧 H5 入口与旧打印产品模型

## 十一、预期最终结果

当本方案推进完成后，前端项目应达到以下状态：

1. 前端只基于后端当前 API 文档和 types 进行接入，不再自维护冲突契约。
2. `tenant` 主链路可在 remote 模式下稳定联调。
3. H5 支付与打印链路围绕 `qrCodeToken` 完成统一收口。
4. mock 成为真实契约的镜像层与场景层，而不是历史事实源。
5. 后续新增页面或新增接口时，团队可以重复使用同一套规则和 skills，而不是重新协商接入方式。
