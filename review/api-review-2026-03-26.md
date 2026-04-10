# Code Review 报告 — apps/api 全量审查

**日期**: 2026-03-26
**审查范围**: `apps/api/src/` 全部 40 个文件
**对照文档**: `docs/API.md` (V1.2)、`docs/archived/prisma-design-v1.md`、`AGENTS.md`

---

## 一、总体评价

模块骨架搭得不错——NestJS 分层清晰、Prisma Schema 设计扎实、租户隔离意识到位、金额用 BigNumber.js 处理。认证模块采用 JWT + Refresh Token 双令牌方案，Redis 用于令牌黑名单和 Refresh Token 存储，技术选型合理。全局 ResponseInterceptor + GlobalExceptionFilter 已落地，统一了 `{ code, message, data }` 响应格式。

但对照 API 设计文档，仍有不少脱节和安全/正确性问题。

**综合评分: 6.5 / 10** — 基础架构良好，安全与业务正确性问题较多，需逐项修复。

---

## 二、严重问题 — P0 Must Fix

### 2.1 JWT Secret 硬编码回退值

**文件**: `auth/auth.module.ts:10`、`auth/jwt.strategy.ts:14`

```typescript
secret: process.env.JWT_SECRET || 'secret-key-change-in-production'
```

**问题**: 环境变量未配置时使用已知硬编码密钥，任何人可伪造 JWT，是严重安全漏洞。

**建议**: 启动时强制校验，不提供 fallback。

```typescript
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');
```

---

### 2.2 QR Token 可猜测 — 安全漏洞

**文件**: `import/import.service.ts:38`

当前使用 `Date.now()` + 6 位随机数生成 QR Token。API 文档明确要求「不可猜测、不可伪造」。该方案可被暴力枚举。

**建议**: 改用 `crypto.randomUUID()` 或 `crypto.randomBytes(32).toString('hex')`。

---

### 2.3 分布式锁缺少所有者标识 — 可能误释放他人锁

**文件**: `redis/redis.service.ts:25-38`

```typescript
async acquireLock(key: string, ttlSeconds = 30): Promise<boolean> {
  const result = await this.client.set(key, 'LOCKED', { NX: true, EX: ttlSeconds });
  return result === 'OK';
}
async releaseLock(key: string): Promise<void> {
  await this.client.del(key);
}
```

**问题**: 锁值固定为 `'LOCKED'`，释放时直接 DEL。当锁超时后被另一进程获取，原进程 `releaseLock` 会误删新锁，导致并发保护失效。

**建议**: 使用随机值 + Lua 脚本原子校验释放。

```typescript
async acquireLock(key: string, ttlSeconds = 30): Promise<string | null> {
  const lockValue = crypto.randomUUID();
  const result = await this.client.set(key, lockValue, { NX: true, EX: ttlSeconds });
  return result === 'OK' ? lockValue : null;
}
async releaseLock(key: string, lockValue: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else return 0 end`;
  const result = await this.client.eval(script, { keys: [key], arguments: [lockValue] });
  return result === 1;
}
```

---

### 2.4 支付锁释放时机错误

**文件**: `payment/payment.service.ts:59-61`

`finally` 块里立即释放锁，但此时只是把状态改成了 `PAYING`，真正支付尚未完成。用户可在 Webhook 到达前再次发起支付。

**建议**: 锁应在 Webhook 处理完成后释放，或让 TTL 自然过期（设 TTL = 支付超时时间）。

---

### 2.5 改价没有金额校验

**文件**: `order/order.service.ts:48-56`

直接把 `newDiscountAmount` 写入数据库，没有校验：

- `newDiscountAmount` 是否超过 `totalAmount - paidAmount`？
- 传入 `"999999.00"` 会破坏恒等式 `totalAmount = paidAmount + discountAmount`，导致负数应付金额。

**建议**: 写入前校验 `newDiscountAmount <= totalAmount - paidAmount`，否则抛出 `BusinessException`。

---

### 2.6 二维码有效期与文档不一致

**文件**: `import/import.service.ts:39`

```typescript
dayjs().add(7, 'day')
```

API 文档规定默认 90 天，且应基于租户配置的 `qrExpireDays`。当前硬编码 7 天。

---

### 2.7 导入是同步的，文档要求异步队列

**文件**: `import/import.service.ts`

整个导入在一个 `$transaction` 里同步执行。500 条订单会锁表几十秒甚至超时。API 文档要求用 BullMQ 异步队列 + `jobId` 轮询进度。

---

### 2.8 手工标记不支持部分付款

**文件**: `payment/payment.controller.ts:31`

只接收 `remark`，没有 `actualAmount` 参数。Service 里直接将剩余全额标记为已付。API 文档要求支持传入 `actualAmount` 实现部分付款 → `PARTIAL_PAID`。

---

## 三、中等问题 — P1 Should Fix

### 3.1 Refresh Token 刷新时未轮换 (Rotation)

**文件**: `auth/auth.service.ts:64-87`

刷新时只签发新 Access Token，旧 Refresh Token 继续有效。泄露后攻击者可无限期获取新 Access Token。

**建议**: 采用 Refresh Token Rotation —— 每次刷新同时签发新 Refresh Token 并使旧的失效。

---

### 3.2 路由路径与 API 文档不一致

| 代码中的路径                              | 文档规定的路径                     |
| ----------------------------------------- | ---------------------------------- |
| `GET /order`                              | `GET /orders`                      |
| `POST /payment/initiate/:qrToken`         | `POST /pay/:token/initiate`        |
| `POST /payment/manual-mark/:orderId`      | `POST /orders/:id/manual-paid`     |
| `PATCH /order/:id/adjust-price`           | `PATCH /orders/:id/discount`       |
| `GET /notification/unread`                | `GET /notifications/unread-count`  |
| `GET /report/daily-summary`              | `GET /report/summary`              |

前端如果按文档对接，全部 404。

---

### 3.3 Webhook 回调响应格式错误

**文件**: `payment/payment.service.ts:113`

返回 `{ msg: 'success' }`，但文档 §8.1 要求拉卡拉格式 `{ code: "SUCCESS", message: "OK" }`。

---

### 3.4 租户创建权限过宽

**文件**: `tenant/tenant.controller.ts:16`

允许 `OS_OPERATOR` 创建租户，但 API 文档 §3.3 规定只有 `OS_SUPER_ADMIN` 可以。且 Service 层又重复了一遍角色判断，与 Guard 不一致。

---

### 3.5 打印数据缺少 qrCodeUrl

**文件**: `print/print.service.ts`

返回的 `printData` 没有 `qrCodeUrl` 字段。发货单上打不出付款二维码，核心功能缺失。

---

### 3.6 订单列表没有分页

**文件**: `order/order.service.ts:14-19`

`take: 100` 硬编码，无 `page/pageSize` 参数，无 `total` count。数据量大了只能看到前 100 条。

---

### 3.7 Logout 未吊销 Refresh Token 家族

**文件**: `auth/auth.service.ts:89-105`

当前只删除请求中携带的单个 Refresh Token。多设备登录时，其他设备 Token 仍然有效。

**建议**: Redis 中维护 `userId → Set<refreshToken>` 映射，支持全量吊销。

---

### 3.8 Redis 连接无错误处理

**文件**: `redis/redis.service.ts:14-16`

连接失败导致应用崩溃，运行中断连后无日志可查。

**建议**: 添加 `this.client.on('error', ...)` 错误监听。

---

### 3.9 TypeScript 严格模式被关掉了

**文件**: `tsconfig.json:17-21`

`CLAUDE.md` 明确要求「TypeScript（严格模式）」。关掉 strict 会让空值问题在运行时才暴露，越晚开越痛苦。

---

## 四、轻微问题 — P2 Nice to Have

### 4.1 Token 黑名单使用完整 Token 作 Key

**文件**: `redis/redis.service.ts:43-44`

JWT 通常 800+ 字节，作为 Redis Key 浪费内存。建议改用 SHA-256 摘要或 `jti` claim。

### 4.2 Login 接口允许前端传入 tenantId

**文件**: `auth/auth.service.ts:21`、`auth/dto/login.dto.ts:13-14`

与「禁止信任前端传入的 tenantId」原则冲突。可通过枚举 tenantId 探测其他租户用户名。建议增加 rate limiting 或改用域名区分租户。

### 4.3 Controller 中直接解析 Authorization Header

**文件**: `auth/auth.controller.ts:27-28`

```typescript
const accessToken = authHeader.replace('Bearer ', '');
```

应复用 `ExtractJwt.fromAuthHeaderAsBearerToken()` 或抽取工具函数。`replace` 不处理大小写。

### 4.4 JwtPayload 类型定义位置

定义在 `current-user.decorator.ts` 中。按规范应放在 `packages/shared-types` 统一导出。

### 4.5 GlobalExceptionFilter 用 `console.error`

**文件**: `common/filters/business-exception.filter.ts:56`

建议接入 NestJS `Logger` 服务，统一日志格式。

### 4.6 CORS origin 硬编码

**文件**: `main.ts:22`

Hardcoded `localhost` 仅适用于开发环境，部署文档中应注明必须配置 `CORS_ORIGINS`。

### 4.7 缺少登录失败频率限制

无限流措施，可被暴力破解。建议集成 `@nestjs/throttler` 或 Redis 登录失败计数器。

---

## 五、缺失模块

对照 API 文档，以下端点尚未实现：

| 模块 | 缺失端点 |
| ---- | -------- |
| OS 运营 | `GET/PATCH /os/tenants`, `GET/POST/PATCH /os/agents`, `GET /os/reports/platform`, `GET/POST /os/users` |
| C 端收款页 | `GET /pay/:token`（订单信息）, `GET /pay/:token/status`（轮询状态） |
| 导入模板 | `GET/POST/PATCH/DELETE /import/templates` |
| 导入预检 | `POST /import/preview` |
| 导入进度 | `GET /orders/import/jobs/:jobId` |
| 配送状态 | `PATCH /orders/:id/delivery-status` |
| 订单二维码 | `GET /orders/:id/qrcode` |
| 租户设置 | `GET/PATCH /tenant/settings` |
| 通知 | `POST /notifications/read-all` |

---

## 六、做得好的地方

- **Prisma Schema 质量高**: 索引设计合理、唯一约束完备（`tenantId_erpOrderNo`、`channelTradeNo`、`orderId_reminderStage`）
- **多租户隔离到位**: 所有查询都带了 `tenantId: currentUser.tenantId`
- **金额用 BigNumber.js**: 没有用浮点运算，符合规范
- **改价写了 before/after 快照审计**: 操作日志规范执行到位
- **Guard + Decorator 分层**: RBAC 实现简洁，符合 NestJS 最佳实践
- **双令牌方案**: Access Token 2h + Refresh Token 7 天，平衡安全与体验
- **Token 黑名单机制**: `JwtStrategy.validate` 中统一拦截，逻辑清晰
- **统一响应格式**: `ResponseInterceptor` + `GlobalExceptionFilter` 配合，`{ code, message, data }` 已落地
- **BusinessException**: 自定义业务错误码，异常体系分层清晰
- **DTO 校验**: `ValidationPipe` (whitelist + forbidNonWhitelisted + transform) 入参防御到位
- **Webhook 防重**: `try-catch` P2002 唯一约束防重复入账思路正确

---

## 七、修复优先级汇总

| 优先级 | 编号 | 问题 | 影响 |
| ------ | ---- | ---- | ---- |
| **P0** | 2.1 | JWT Secret 硬编码回退值 | 生产安全漏洞，可伪造 Token |
| **P0** | 2.2 | QR Token 可猜测 | 收款链接可被暴力枚举 |
| **P0** | 2.3 | 分布式锁缺少所有者标识 | 支付并发保护失效 |
| **P0** | 2.4 | 支付锁释放时机错误 | 可重复发起支付 |
| **P0** | 2.5 | 改价无金额校验 | 恒等式被破坏，财务数据错乱 |
| **P0** | 2.6 | 二维码有效期 7 天 vs 文档 90 天 | 业务逻辑错误 |
| **P0** | 2.7 | 导入同步执行无队列 | 大批量导入锁表超时 |
| **P0** | 2.8 | 手工标记不支持部分付款 | 与文档功能不符 |
| **P1** | 3.1 | Refresh Token 未轮换 | Token 泄露无法止损 |
| **P1** | 3.2 | 路由路径与文档不一致 | 前端按文档对接全部 404 |
| **P1** | 3.3 | Webhook 响应格式错误 | 支付渠道可能重复回调 |
| **P1** | 3.4 | 租户创建权限过宽 | 越权操作 |
| **P1** | 3.5 | 打印数据缺少 qrCodeUrl | 发货单无二维码 |
| **P1** | 3.6 | 订单列表无分页 | 数据量大无法查看 |
| **P1** | 3.7 | Logout 未吊销 Token 家族 | 多设备 Token 残留 |
| **P1** | 3.8 | Redis 无错误处理 | 断连后难以排查 |
| **P1** | 3.9 | TypeScript strict 关闭 | 空值问题运行时暴露 |
| **P2** | 4.1 | Token 黑名单 Key 过大 | Redis 内存浪费 |
| **P2** | 4.2 | Login tenantId 枚举风险 | 信息泄露 |
| **P2** | 4.3 | Controller 解析 Header | 代码规范 |
| **P2** | 4.4 | JwtPayload 类型位置 | 共享类型规范 |
| **P2** | 4.5 | console.error 替换 Logger | 日志规范 |
| **P2** | 4.6 | CORS 硬编码 | 部署风险 |
| **P2** | 4.7 | 无登录频率限制 | 暴力破解风险 |

---

## 八、建议修复顺序

1. **P0 安全类** (2.1, 2.2) — 改一两行代码，立刻消除安全漏洞
2. **P0 支付类** (2.3, 2.4, 2.5) — 涉及资金安全，必须在上线前修复
3. **P0 业务类** (2.6, 2.7, 2.8) — 与文档功能不符，影响核心流程
4. **P1 路由对齐** (3.2) — 前后端联调的前提条件
5. **P1 认证增强** (3.1, 3.7) — Refresh Token 轮换 + 全量吊销
6. **P1 其余** (3.3~3.6, 3.8, 3.9) — 逐项修复
7. **P2 优化项** — 后续迭代中逐步完善
8. **缺失模块** — 按业务优先级排期开发
