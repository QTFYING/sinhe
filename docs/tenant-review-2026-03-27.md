# Tenant 租户端前端 Code Review 报告

**审查日期**: 2026-03-27
**审查范围**: `apps/tenant/src/` 全部源码
**对标文档**: `docs/API.md` (V1.2)、`docs/prisma.md`、`docs/plan_solution.md`、`docs/logic_diagram.md`、`CLAUDE.md`
**综合评分**: **5.5 / 10** — 基础框架搭建合理，但存在多处与文档规范的严重脱节、功能大面积缺失、以及若干安全隐患

---

## 一、做得好的地方

| 项目 | 说明 |
|------|------|
| 技术栈选型正确 | React 18 + Vite + Ant Design 5.x + Zustand + TanStack Query，完全符合 `plan_solution.md` 要求 |
| Excel 浏览器端解析 | SheetJS 在前端解析，未上传原始文件，严格遵守 CLAUDE.md 红线 |
| 状态管理分层 | 服务端数据用 TanStack Query，客户端 UI 状态用 Zustand，未用 useState 管理服务端数据 |
| 打印方案 | 使用隐藏 iframe + `@media print` CSS，符合"不做 Electron 客户端"要求 |
| 金额展示 | 使用 `shared-utils` 的 `formatAmount()` 格式化，未直接 `parseFloat` |
| Auth 持久化 | Zustand persist 到 localStorage，刷新后不丢失登录态 |
| 请求拦截器 | Token 自动注入 + 401 自动跳转登录页 |

---

## 二、P0 严重问题（必须立即修复）

### 2.1 🔴 响应码判断错误 — 前后端无法正常通信

**文件**: `src/api/http-client.ts:24`

```typescript
// ❌ 当前代码
if (response.data?.code !== 200 && response.data?.code !== undefined)

// ✅ API.md §1.2 规定成功码为 0
if (response.data?.code !== 0 && response.data?.code !== undefined)
```

**影响**: API 返回 `{ code: 0, message: "ok", data: {...} }` 时，前端会将其判定为业务错误并弹出错误提示，**所有正常请求都会失败**。这是当前最严重的对接问题。

---

### 2.2 🔴 API 端点路径与文档严重不一致（6 处）

| 前端实际调用 | API.md 规定路径 | 涉及文件 |
|-------------|----------------|---------|
| `GET /order` | `GET /orders` | `order-manager.tsx:17`, `print-center.tsx` |
| `PATCH /order/{id}/price` | `PATCH /orders/{id}/price` | `order-manager.tsx:21` |
| `POST /payment/initiate/{orderId}` | `POST /payments/initiate` (orderId 在 body 中) | `order-manager.tsx:30` |
| `POST /import/orders` | `POST /orders/import` | `import-orders.tsx:16` |
| `POST /print/jobs` | `POST /print/jobs` | ✅ 唯一一致的端点 |
| `GET /report/daily-summary` | `GET /report/collection-overview` | `dashboard.tsx`, `financial-report.tsx` |

**影响**: 前后端联调必然全面失败。

---

### 2.3 🔴 订单列表无分页 — 数据量增长后必崩

**文件**: `order-manager.tsx:17`, `print-center.tsx`

当前 `GET /order` 无任何分页参数，API.md §4.1 明确要求：
```
GET /orders?page=1&pageSize=20&payStatus=UNPAID&keyword=张三
```

需要实现分页组件 + 筛选条件（payStatus、keyword、dateRange）。

---

### 2.4 🔴 缺少路由级权限守卫 — 仅隐藏菜单不安全

**文件**: `dashboard-layout.tsx:11-18`, `App.tsx`

当前仅在侧边栏菜单做了角色过滤，但路由本身无守卫。`TENANT_VIEWER` 用户直接在浏览器输入 `/print` 即可访问打印中心，`TENANT_FINANCE` 直接输入 `/orders` 可访问订单管理。

**应当**: 在路由层添加 `<RoleGuard allowedRoles={[...]}>`，未授权角色渲染 403 页面或重定向。

---

### 2.5 🔴 TENANT_VIEWER 可执行改价和发起支付操作

**文件**: `order-manager.tsx:48-56`

`TENANT_VIEWER` 角色定义为"订单列表（只读）"，但订单管理页面的"申请折让金调整"和"建构终端支付链接"按钮对所有能访问该页面的角色都可见可操作，违反 CLAUDE.md 权限矩阵。

**应当**: 根据 `userInfo.role` 条件渲染操作按钮，`TENANT_VIEWER` 和 `TENANT_FINANCE` 不展示操作列。

---

### 2.6 🔴 登出未调用后端 API — Refresh Token 不会失效

**文件**: `dashboard-layout.tsx:36-39`

```typescript
// ❌ 当前：仅清除前端状态
const handleLogout = () => {
  logout();
  navigate('/login', { replace: true });
};

// ✅ 应当：调用后端注销接口
const handleLogout = async () => {
  await httpClient.post('/auth/logout');
  logout();
  navigate('/login', { replace: true });
};
```

**影响**: 用户登出后 Token 仍然有效，存在会话劫持风险。API.md §2.3 定义了 `POST /auth/logout` 接口，需要调用以将 Token 加入 Redis 黑名单。

---

## 三、P1 中等问题

### 3.1 🟡 导入功能严重简化 — 缺少模板管理系统

**文件**: `import-orders.tsx`

| 缺失项 | API.md 要求 |
|--------|------------|
| 导入模板管理 | `POST /import/templates` 创建模板、`GET /import/templates` 列表 |
| 列映射配置 | `mappingRules` JSON 持久化，而非前端硬编码 |
| 自定义字段 | `customFieldDefs` 定义，支持扩展字段 |
| 模板选择 | 导入时选择已保存模板，非写死 `templateId: 'dummy'` |
| 数据校验 | 导入前校验必填字段、金额格式、重复 ERP 订单号 |
| 导入结果反馈 | 返回 `failedRows` 明细，展示哪些行导入失败及原因 |

当前实现是硬编码的中文列名映射（`ERP订单号`、`客户名称` 等），无法适配不同经销商的 Excel 格式，违背了模板系统的设计初衷。

---

### 3.2 🟡 财务报表功能严重不足

**文件**: `financial-report.tsx`

| 缺失项 | API.md 要求 |
|--------|------------|
| 回款概览接口 | 应调用 `GET /report/collection-overview`，包含 orderCount、paidCount 等 |
| 订单明细导出 | `GET /report/order-detail` 支持分页、筛选、CSV 下载 |
| 支付流水查询 | `GET /report/payment-flows` 查看每笔支付详情 |
| 数据可视化 | 仅有 3 个数字卡片 + 一个"未来开放 BI 图表"占位符 |
| 日期筛选精度 | 缺少按支付状态、客户名称等维度筛选 |

---

### 3.3 🟡 整体功能模块大面积缺失

以下为 API.md 和 `logic_diagram.md` 要求但 Tenant 端完全未实现的模块：

| 缺失模块 | 重要性 | API.md 章节 |
|----------|--------|------------|
| **员工管理** | 高 | §3 — 员工 CRUD、角色分配、禁用/启用 |
| **订单详情页** | 高 | §4.2 — 查看单个订单完整信息 + 商品明细 + 操作日志 |
| **手工标记已支付** | 高 | §4.5 — 线下转账后标记已付（需备注 + 凭证） |
| **配送状态更新** | 中 | §4.6 — 更新 deliveryStatus + deliveryPersonName |
| **站内信/通知** | 中 | §8 — 未读计数、消息列表、批量标记已读 |
| **租户设置** | 中 | §9 — 账期配置 (creditPeriodDays) |
| **Token 刷新** | 高 | §2.2 — `POST /auth/refresh` 无感续期 |
| **导入模板管理** | 中 | §3.5 — 模板 CRUD |

---

### 3.4 🟡 支付链接展示方式不合理

**文件**: `order-manager.tsx:77-84`

当前直接展示一个文本 URL 链接，问题：
1. 应该生成 **QR 二维码图片**，方便买家扫码（使用 qrcode.js 或类似库）
2. 支付 URL 硬编码为 `http://localhost:5002`，生产环境无法使用
3. 缺少二维码有效期倒计时展示
4. 缺少支付状态轮询 — 发起支付后应轮询订单状态，支付成功后自动关闭弹窗

---

### 3.5 🟡 TypeScript 类型安全严重不足

全项目大量使用 `any` 类型：

| 文件 | `any` 使用次数 | 说明 |
|------|---------------|------|
| `order-manager.tsx` | 5 处 | `selectedOrder: any`、`record: any`、`res: any` 等 |
| `import-orders.tsx` | 4 处 | `parsedData: any[]`、`row: any`、`data: any[]` 等 |
| `print-center.tsx` | 多处 | 打印数据、record 等 |
| `dashboard.tsx` | 1 处 | response 类型 |

**应当**: 使用 `shared-types` 包中定义的 DTO 类型（OrderDto、PaymentInitiateResponse 等），实现前后端类型共享。

---

### 3.6 🟡 打印功能缺少关键字段

**文件**: `print-center.tsx`

- 缺少 `qrCodeUrl` 打印（API.md 打印数据应包含收款二维码）
- 缺少配送信息（deliveryPersonName、配送状态）
- 缺少打印历史记录和重打功能
- 打印模板内联在 JS 中，不易维护和定制

---

## 四、P2 轻微问题

### 4.1 🟢 UI 文案过度"企业化"，影响可读性

多处文案晦涩难懂，偏离正常用户体验：

| 当前文案 | 建议修改 |
|---------|---------|
| "商用订单核销中心席" | "订单管理" |
| "应付大纲金额" | "订单金额" |
| "商务折让幅度" | "折让金额" |
| "实收核销口径" | "实收金额" |
| "资金交付状态" | "支付状态" |
| "业务核准操作" | "操作" |
| "建构终端支付链接" | "发起收款" |
| "当前待结资金链已入库锁紧" | "收款链接已生成" |
| "防连击防串账逻辑引擎体系内" | "系统已自动防重复支付" |

---

### 4.2 🟢 Dashboard 过于简单

**文件**: `dashboard.tsx`

- 仅展示 3 个数字卡片
- 缺少待处理订单数、今日新增订单等运营指标
- 缺少快捷操作入口（快速导入、快速打印）
- 缺少最近订单列表预览

---

### 4.3 🟢 Login 页面缺少基础安全特性

**文件**: `login.tsx`

- 无密码输入框的 `autoComplete="current-password"` 属性
- 无登录失败次数限制提示
- 无忘记密码 / 联系管理员入口
- 无记住账号功能

---

### 4.4 🟢 缺少全局 Loading / Error Boundary

- 无 React Error Boundary，组件崩溃会白屏
- 无全局路由切换 Loading 态
- TanStack Query 的全局 error handler 未配置

---

### 4.5 🟢 import-orders 数据校验缺失

**文件**: `import-orders.tsx:40-52`

- `erpOrderNo` 缺失时用 `Date.now()` 填充 — 会产生无意义订单号
- `totalAmount` 缺失时用 `'0.00'` — 会产生零金额订单
- 未校验金额格式是否为合法数字字符串
- 未校验是否存在重复 ERP 订单号
- 未限制单次导入最大行数

---

### 4.6 🟢 打印延迟使用魔法数字

**文件**: `print-center.tsx`

打印前用 `setTimeout(800ms)` 等待 DOM 渲染，这是不可靠的做法。应改用 `iframe.onload` 事件或 `requestAnimationFrame` 确保内容完全渲染后再触发打印。

---

## 五、与上次后端 Review (2026-03-26) 的联动问题

结合 `docs/code-review-2026-03-26.md` 中后端存在的问题，前后端需要同步修复的关键点：

| 问题 | 后端现状 | 前端应对 |
|------|---------|---------|
| API 路由不一致 | 后端用 `/order`（单数） | 前端也用 `/order`，但两者都与 API.md 的 `/orders` 不一致 — **需要统一对齐到文档** |
| 改价无金额校验 | 后端未校验恒等式 | 前端也未校验 `discountAmount ≤ totalAmount` |
| 手工标记支持 | 后端未实现部分付款 | 前端完全未实现该功能 |
| 导入应改为异步 | 后端当前同步执行 | 前端未实现 jobId 轮询进度 |
| 订单列表分页 | 后端硬编码 take:100 | 前端无分页参数 |

---

## 六、修复优先级建议

### 第一优先级（对接障碍 — 不修复无法联调）
1. 修正响应码判断 `code: 200` → `code: 0`
2. 对齐所有 API 端点路径到 API.md 规范
3. 订单列表添加分页和筛选参数

### 第二优先级（安全与权限）
4. 添加路由级权限守卫
5. 按角色条件渲染操作按钮
6. 登出调用 `POST /auth/logout`
7. 实现 Token 无感刷新 (`POST /auth/refresh`)

### 第三优先级（核心功能补全）
8. 员工管理模块
9. 订单详情页
10. 手工标记已支付
11. 配送状态更新
12. 支付二维码生成 + 状态轮询
13. 导入模板管理

### 第四优先级（体验与健壮性）
14. 财务报表完善
15. 站内信/通知
16. TypeScript 类型替换 `any`
17. Error Boundary + 全局错误处理
18. UI 文案规范化

---

## 七、文件清单与问题密度

| 文件 | 代码行数 | P0 | P1 | P2 | 说明 |
|------|---------|----|----|----|----|
| `api/http-client.ts` | 43 | 1 | 0 | 0 | 响应码判断错误 |
| `layouts/dashboard-layout.tsx` | 65 | 2 | 0 | 0 | 权限守卫缺失 + 登出未调API |
| `pages/orders/order-manager.tsx` | 88 | 2 | 2 | 1 | 路由错误 + 权限 + 分页缺失 + 类型 |
| `pages/orders/import-orders.tsx` | 103 | 1 | 1 | 1 | 路由错误 + 模板缺失 + 校验 |
| `pages/print/print-center.tsx` | ~80 | 1 | 1 | 1 | 路由错误 + 字段缺失 + 延迟 |
| `pages/report/financial-report.tsx` | ~60 | 1 | 1 | 0 | 路由错误 + 功能不足 |
| `pages/dashboard.tsx` | ~50 | 1 | 0 | 1 | 路由错误 + 功能简单 |
| `pages/login.tsx` | ~40 | 0 | 0 | 1 | 安全特性缺失 |
| `store/use-auth-store.ts` | ~20 | 0 | 0 | 0 | ✅ 实现合理 |
| `store/use-ui-store.ts` | ~10 | 0 | 0 | 0 | ✅ 实现合理 |
| **缺失模块** | — | — | — | — | 员工管理、订单详情、通知、设置等 |

---

## 八、总结

Tenant 端当前处于 **MVP 原型阶段**，核心框架选型和基本架构决策正确，但与 API.md 规范之间存在根本性的对接障碍（响应码 + 端点路径），导致当前代码 **无法与后端正常联调**。功能覆盖率约为文档要求的 **30%**，缺失员工管理、订单详情、手工标记、通知等关键业务模块。权限控制仅做了菜单级过滤，缺少路由守卫和按钮级权限控制。建议按照第六节的优先级顺序逐步修复和补全。
