# API 评审纪要（2026-04-07）

> 目的：存档今晚对 `yapi/`、`docs/API.md`、`docs/logic_diagram.md` 的审查结论，作为后续逐份修订文档的统一依据。

---

## 一、评审范围

本次主要审查以下文档：

- `yapi/admin-api-doc.md`
- `yapi/tenant-api-doc.md`
- `yapi/h5-api-doc.md`
- `yapi/api-architecture-overview.md`
- `docs/API.md`
- `docs/logic_diagram.md`

本次评审的判断基准：

1. `docs/logic_diagram.md` 中“思维导图长文本大纲格式”是已审核通过的业务真相源
2. 项目根目录 `AGENTS.md` 中的多租户、金额、权限、支付等约束为强约束
3. 本次会议明确的新增决议，优先覆盖 YAPI 中未收敛或偏离核心业务的部分

---

## 二、审查中发现的主要问题

### 1. H5 访问凭证设计偏离核心安全模型

问题：

- YAPI H5 文档曾将 H5 公共访问从 `qrCodeToken` 改为 `orderNo`
- 这会让订单号本身承担公开凭证职责，不符合当前“二维码唯一短串令牌”的设计

结论：

- H5 继续使用 `qrCodeToken`
- H5 路径继续采用 `/pay/:token*`
- 不改成 `orderNo` 公开凭证

---

### 2. Tenant 角色体系被改成动态权限模型，偏离一期范围

问题：

- YAPI Tenant 文档中曾出现 `owner / clerk / finance / agent`
- 同时设计了 `/settings/roles`、`/settings/permissions` 以及角色 CRUD
- 这与项目约束“固定角色枚举，不做动态自建角色”冲突

结论：

- 一期继续采用固定角色：
  - `TENANT_OWNER`
  - `TENANT_OPERATOR`
  - `TENANT_FINANCE`
  - `TENANT_VIEWER`
- `settings/roles`、`settings/permissions` 保留为占位只读接口
- 一期不开放角色新增、编辑、删除

---

### 3. Excel 导入链路被改成文件直传，不符合既定方案

问题：

- YAPI 中曾将导入接口设计为 `multipart/form-data`
- 同时出现“模板存 localStorage、不走服务端模板管理”的设计
- 这与已审核的大纲和项目约束不一致

结论：

- 一期继续采用：
  - 浏览器端 SheetJS 解析 Excel
  - 服务端模板管理：`/import/templates`
  - 导入预检：`/import/preview`
  - 异步正式导入：`/orders/import`
  - 任务进度查询：`/orders/import/jobs/:jobId`
- 不上传原始 Excel 文件

---

### 4. 订单删除语义不合适

问题：

- YAPI 中存在 `DELETE /orders/{id}`
- 财务相关单据不应物理删除

结论：

- 不提供物理删除订单接口
- 一期改为提供“作废订单”接口
- 错误订单作废后保留记录，但不参与默认汇总统计

建议接口：

```text
POST /orders/:id/void
```

---

### 5. H5 状态机与现金核销链路未统一

问题：

- 旧版大纲是 4 态：`UNPAID / PAYING / PAID / EXPIRED`
- 但如果引入现金登记与财务核销，就会多出“待核销”状态

结论：

- 一期正式扩展为 5 态：
  - `UNPAID`
  - `PAYING`
  - `PENDING_VERIFICATION`
  - `PAID`
  - `EXPIRED`

---

### 6. `verify-cash` 是否进入一期，需要和 H5 现金登记绑定

问题：

- 单独保留 `verify-cash` 没意义，必须有 H5 上游入口

结论：

- 一期同时保留以下两步：
  - H5 现金登记：`POST /pay/:token/offline-payment`
  - Tenant 财务核销：`POST /orders/:id/verify-cash`

现金链路说明：

```text
H5 登记现金支付
→ 订单状态变为 PENDING_VERIFICATION
→ Tenant 财务核销 verify-cash
→ 订单状态更新为 PAID
→ 新增一条现金收款流水
```

---

### 7. Agents 模块语义不准确

问题：

- YAPI 中的 `agents` 更接近“服务商”
- 但产品方向上未来实际要做的是“分销商”

结论：

- 该模块不进入一期最终接口清单
- 后续以“分销商”概念重新定义领域模型和接口
- 作为 Phase 2 重新设计

---

### 8. 文档之间统计口径和接口数量不一致

问题：

- YAPI 不同文件之间的端点总数、模块数和接口口径有不一致现象
- 造成“总览文档”和“端侧文档”不能互相作为真相源

结论：

- 后续修文时，必须先统一一期最终接口边界，再逐份同步
- 不再以当前 YAPI 原始计数作为决策依据

---

## 三、已确认的一期最终方案

### 1. H5 侧

继续采用：

```text
GET  /pay/:token
POST /pay/:token/initiate
POST /pay/:token/offline-payment
GET  /pay/:token/status
```

规则：

- 使用 `qrCodeToken`
- 金额由服务端定格
- 5 态页面状态机

---

### 2. Tenant 侧固定角色

一期固定角色如下：

```text
TENANT_OWNER
TENANT_OPERATOR
TENANT_FINANCE
TENANT_VIEWER
```

说明：

- 前端按固定角色做条件渲染
- 一期不做动态权限编辑器

---

### 3. Tenant 导入链路

一期导入主链路保持为：

```text
GET    /import/templates
POST   /import/templates
PATCH  /import/templates/:id
DELETE /import/templates/:id
POST   /import/preview
POST   /orders/import
GET    /orders/import/jobs/:jobId
```

说明：

- 模板由服务端持久化
- 支持 `customFieldDefs` / `customFields`
- 正式入库使用异步队列

---

### 4. 订单管理新增/保留项

一期确定保留：

- 订单列表
- 订单详情
- 改价
- 手工标记已支付
- 获取付款码
- 打印任务
- 配送状态更新

一期新增：

```text
POST /orders/:id/void
```

作废规则：

- 仅未支付订单允许作废
- 已支付订单不能直接作废
- 作废后不参与默认统计

---

### 5. 现金核销链路

一期确定进入正式接口：

```text
POST /pay/:token/offline-payment
POST /orders/:id/verify-cash
```

---

### 6. Settings 占位接口

一期保留以下接口作为只读占位：

```text
GET /settings/roles
GET /settings/permissions
```

一期逻辑：

- 只返回固定角色枚举
- 只返回固定权限树
- 不开放以下接口：
  - `POST /settings/roles`
  - `PUT /settings/roles/{id}`
  - `DELETE /settings/roles/{id}`

---

### 7. Phase 2 延后项

以下能力不进入一期最终接口：

- 分销商模块（原 `agents` 方向重做）
- Tenant 动态角色 CRUD
- 与一期核心交易链路无关的增强型经营分析和抽象设计

---

## 四、后续修文建议

后续如继续逐份修订文档，建议顺序如下：

1. 先以本纪要为准，修正 `docs/API.md`
2. 再同步 `docs/logic_diagram.md`
3. 然后分别修正：
   - `yapi/h5-api-doc.md`
   - `yapi/tenant-api-doc.md`
   - `yapi/api-architecture-overview.md`
   - `yapi/admin-api-doc.md`
4. 最后单独维护一份面向前端的枚举清单

---

## 五、可直接作为后续修订依据的关键词

```text
qrCodeToken
H5 五态状态机
offline-payment
verify-cash
订单作废 void
固定角色枚举
settings/roles 占位
settings/permissions 占位
浏览器解析 Excel
import/preview
orders/import/jobs/:jobId
分销商 Phase 2
```

