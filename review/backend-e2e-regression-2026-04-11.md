# 后端完整链回归记录

> 日期：2026-04-11
> 执行方式：本地进程内启动 Nest 应用，走真实 HTTP 请求
> 执行命令：`pnpm -F api test:backend-regression`
> 结果文件：`apps/api/.runtime/backend-regression-result.json`
> 执行结果：通过

## 一、本次执行环境

- 数据库：本地 PostgreSQL，库名 `distributor_pay`
- Redis：`redis://localhost:6379`
- API 启动方式：Runner 内部临时监听本地随机端口
- 导入任务：Runner 内设置 `IMPORT_JOB_WORKER_ENABLED=true`

## 二、联调固定夹具

- 租户 ID：`7f4d6bde-8e44-4f39-9c5d-4d5f8f90a001`
- 老板账号：`reg_owner_20260411`
- 财务账号：`reg_finance_20260411`
- 导入订单号：`REG-IMPORT-20260411-001`

说明：

- Runner 每次执行前会清理该租户下的订单、导入、支付、打印、提醒、打印模板等联调数据
- Runner 会保留并复用固定租户和固定联调账号

## 三、本次跑通的完整链路

按以下顺序完成真实接口调用：

1. `POST /api/auth/login`
2. `GET /api/auth/me`
3. `POST /api/auth/refresh`
4. `POST /api/auth/refresh` 使用旧 cookie，确认失效
5. `GET /api/settings/general`
6. `PUT /api/settings/general`
7. `POST /api/import/templates`
8. `GET /api/settings/printing`
9. `GET /api/settings/printing/{importTemplateId}`
10. `PUT /api/settings/printing/{importTemplateId}`
11. `GET /api/settings/printing/{importTemplateId}`
12. `POST /api/import/preview`
13. `POST /api/orders/import`
14. `GET /api/orders/import/jobs/{jobId}` 轮询至完成
15. `GET /api/orders`
16. `GET /api/orders/{id}`
17. `GET /api/pay/{qrCodeToken}`
18. `POST /api/pay/{qrCodeToken}/offline-payment`
19. `GET /api/pay/{qrCodeToken}/status`
20. `POST /api/auth/login` 财务账号
21. `POST /api/orders/{id}/cash-verifications`
22. `GET /api/pay/{qrCodeToken}/status`
23. `GET /api/payments/summary`
24. `GET /api/payments`
25. `POST /api/orders/print-records`
26. `POST /api/orders/print-records` 重放同一 `requestId`
27. `POST /api/orders/{id}/reminders`
28. `GET /api/orders/{id}`
29. `POST /api/auth/logout`
30. `POST /api/auth/refresh` 确认退出后失效

## 四、关键结果摘要

### 4.1 Auth

- 老板与财务账号都能正常登录
- `refreshToken` 轮换生效
- 旧 refresh cookie 无效
- 退出登录后 refresh 失效

### 4.2 Settings

- 通用配置默认值读取正常
- 租户覆盖保存后再次读取口径正确
- 新建导入模板后，打印配置列表能立即感知
- 打印配置在未配置时 `hasCustomConfig=false`
- 保存后 `hasCustomConfig=true`，并返回 `configVersion / updatedAt / updatedBy`

### 4.3 Import

- 导入模板创建成功
- 2 行明细按同一 `sourceOrderNo` 聚合为 1 张订单
- 预检摘要正确：
  - `totalRows=2`
  - `aggregatedOrderCount=1`
  - `duplicateOrderCount=0`
  - `errorCount=0`
- 正式导入任务在第 2 次轮询进入 `completed`

### 4.4 Order

- 导入后订单成功生成
- 订单金额 `24`
- 订单初始 `paid=0`
- 订单初始状态 `pending`
- 订单明细共 2 行

### 4.5 Payment

- H5 详情接口能通过 `qrCodeToken` 正常读取订单
- 线下现金登记后状态为 `pending_verification`
- 财务核销后：
  - 订单状态变为 `paid`
  - H5 支付状态变为 `paid`
  - `paidAmount=24`
- 收款汇总与流水列表口径一致：
  - `totalAmount=24`
  - `totalFee=0`
  - `totalNet=24`
  - `totalCount=1`
  - `abnormalCount=0`

### 4.6 Print / Reminder

- 打印回执首次提交成功
- 重放同一 `requestId` 未重复累加
- 最终订单 `prints=1`
- 催款提醒记录创建成功

## 五、执行中发现并已处理的问题

### 5.1 本地数据库不是空库

现象：

- `prisma db push` 遇到旧表、旧枚举与缺表混杂状态，无法直接推送

处理：

- 对本机联调库执行 `pnpm -F api exec prisma db push --force-reset`

结论：

- 本地若长期存在旧 MVP 残留库，首次联调前建议直接重建联调库

### 5.2 `@shou/types` 不能被 Node 运行时直接消费

现象：

- `apps/api/dist` 在运行时加载 `@shou/types/*` 时，命中 `src/*.ts` 源码导出
- Node 运行时报 `ERR_MODULE_NOT_FOUND`

处理：

- 已把 `packages/types` 改为真正构建产物导出
- 新增 `packages/types/tsconfig.json`
- 新增 `pnpm -F @shou/types build`

结论：

- 后续任何本地自启、部署前构建、回归执行，都必须先保证 `@shou/types` 已 build

### 5.3 `logout` 清 cookie 存在 Express 弃用警告

现象：

- `res.clearCookie` 继续透传 `maxAge`

处理：

- 已修正清 cookie 参数，不再传 `maxAge`

## 六、当前建议

当前仓库已经具备以下基线：

1. `pnpm -F @shou/types build`
2. `pnpm -F api build`
3. `pnpm -F api test:smoke`
4. `pnpm -F api test:backend-regression`

后续建议：

1. 每次改动支付、导入、订单、打印链路后，至少执行 `test:smoke + test:backend-regression`
2. 在进入前端真实联调前，先保证这份回归记录可以再次完整跑通
