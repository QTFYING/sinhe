# 经销商订单收款平台 — API 接口文档

> **文档版本**: V1.3
> **编制日期**: 2026-04-07
> **对应后端**: NestJS（apps/api）
> **数据库**: PostgreSQL + Prisma
> **变更说明**:
> * V1.1 修复路由冲突、补全缺失接口、统一 HTTP 动词语义、完善全局约定；
> * V1.2 新增自定义字段扩展能力（`customFieldDefs` / `customFields`），涉及导入模板、订单列表/详情/导入、打印模块共 8 处接口变更；
> * V1.3 新增订单作废、H5 现金待核销、Tenant 财务现金核销，并将 H5 状态机扩展为五态

---

## 目录

1. [全局约定](#一全局约定)
2. [认证模块](#二认证模块)
3. [OS 平台模块](#三os-平台模块)
4. [租户员工模块](#四租户员工模块)
5. [导入模板模块](#五导入模板模块)
6. [订单模块](#六订单模块)
7. [打印模块](#七打印模块)
8. [支付模块（后台侧）](#八支付模块后台侧)
9. [买家收款页模块（C端）](#九买家收款页模块c端)
10. [财务报表模块](#十财务报表模块)
11. [站内信模块](#十一站内信模块)
12. [租户设置模块](#十二租户设置模块)

---

## 一、全局约定

### 1.1 Base URL

```
https://api.platform.com/api/v1
```

### 1.2 鉴权方式

| 接口类型 | 鉴权方式 |
|---|---|
| 后台接口（OS / Tenant） | `Authorization: Bearer <access_token>`（JWT） |
| C端收款页接口 | 无 JWT，凭 URL 中的 `qrCodeToken` 作为访问凭证 |
| Lakala Webhook 回调 | 无 JWT，后端校验拉卡拉签名 |

JWT 由 `/auth/login` 颁发，Access Token 有效期 **2小时**，Refresh Token 有效期 **7天**（存 HttpOnly Cookie）。

### 1.3 权限角色说明

每个接口标注允许调用的角色，角色枚举如下：

| 标记 | 说明 |
|---|---|
| `[OS_SUPER_ADMIN]` | OS 平台超级管理员 |
| `[OS_OPERATOR]` | OS 平台运营人员 |
| `[TENANT_OWNER]` | 租户老板（全权限） |
| `[TENANT_OPERATOR]` | 打单员（订单操作权限） |
| `[TENANT_FINANCE]` | 出纳（财务只读） |
| `[TENANT_VIEWER]` | 只读账号 |
| `[PUBLIC]` | 无需任何鉴权，公开访问 |

### 1.4 统一响应格式

所有接口（**Lakala Webhook 回调接口除外，见 §8.1**）返回统一的 JSON 包装：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | `number` | `0` 表示成功，非 0 表示业务错误码（见 §1.6） |
| `message` | `string` | 成功为 `"ok"`，失败为错误描述 |
| `data` | `object \| null` | 业务数据，失败时为 `null` |

### 1.5 分页约定

**请求参数（Query String）：**

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `page` | `number` | `1` | 页码，从 1 开始 |
| `pageSize` | `number` | `20` | 每页条数，最大 100 |

**响应 data 结构：**

```json
{
  "list": [],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

### 1.6 业务错误码

> **说明**：HTTP 响应状态码（4xx/5xx）用于传输层错误，响应 Body 中的 `code` 字段仅使用以下自定义业务错误码，不与 HTTP 状态码混用。

| code | 含义 | 对应 HTTP 状态码 |
|---|---|---|
| `0` | 成功 | 200 |
| `1001` | 订单已支付，禁止重复操作 | 409 |
| `1002` | 二维码已过期 | 410 |
| `1003` | 支付中，禁止并发发起 | 409 |
| `1004` | 金额不合法（超出应收范围） | 422 |
| `4001` | 未登录或 Token 已失效 | 401 |
| `4003` | 无权限访问该资源 | 403 |
| `4004` | 资源不存在 | 404 |
| `4009` | 资源冲突（如重复导入同一单号） | 409 |
| `4022` | 请求参数校验失败 | 422 |
| `5000` | 服务器内部错误 | 500 |

### 1.7 时区约定

所有时间字段均以 **ISO 8601 UTC 格式**（含 `Z` 后缀）传输，前端展示时统一转换为 **UTC+8（北京时间）**。

---

## 二、认证模块

### 2.1 登录

**`POST /auth/login`** `[PUBLIC]`

OS端和Tenant端共用同一登录接口，后端通过 `username` + `tenantId`（可选）区分身份。

**Request Body：**

```json
{
  "username": "admin",
  "password": "Abc123456",
  "tenantId": "8f14e45f-ceea-467a-a866-1d7e0d1b2e9a"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `username` | `string` | ✅ | 登录用户名 |
| `password` | `string` | ✅ | 明文密码，HTTPS 传输 |
| `tenantId` | `string` | ❌ | 租户员工登录时必填；OS 账号登录时留空 |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 7200,
    "user": {
      "id": "a1b2c3d4-0001-0001-0001-000000000001",
      "username": "admin",
      "realName": "张三",
      "role": "TENANT_OWNER",
      "tenantId": "8f14e45f-ceea-467a-a866-1d7e0d1b2e9a"
    }
  }
}
```

> Refresh Token 通过 `Set-Cookie: refresh_token=...;HttpOnly;Secure` 下发，不在 body 中返回。

---

### 2.2 刷新 Access Token

**`POST /auth/refresh`** `[PUBLIC]`

凭 HttpOnly Cookie 中的 Refresh Token 换新 Access Token，无需传 Body。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 7200
  }
}
```

---

### 2.3 登出

**`POST /auth/logout`** `[所有已登录角色]`

服务端将当前 Access Token 加入 Redis 黑名单，并清除 Refresh Token Cookie。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": null
}
```

---

## 三、OS 平台模块

> 所有 `/os/*` 接口仅限 OS 端角色访问，Tenant 端账号调用返回 HTTP `403`。

### 3.1 获取租户列表

**`GET /os/tenants`** `[OS_SUPER_ADMIN, OS_OPERATOR]`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `page` | `number` | ❌ | 默认 1 |
| `pageSize` | `number` | ❌ | 默认 20 |
| `keyword` | `string` | ❌ | 模糊搜索租户名称或联系手机号 |
| `status` | `number` | ❌ | `1`=正常 `0`=封禁 `2`=已过期 |
| `agentId` | `string` | ❌ | 按代理商筛选 |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "8f14e45f-ceea-467a-a866-1d7e0d1b2e9a",
        "name": "某某酒水经销商",
        "contactPhone": "13800138000",
        "status": 1,
        "expireAt": "2027-03-25T00:00:00.000Z",
        "maxCreditDays": 30,
        "agentId": "agent-uuid-001",
        "agentName": "华东区代理商",
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 58,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 3.2 获取租户详情

**`GET /os/tenants/:id`** `[OS_SUPER_ADMIN, OS_OPERATOR]`

**Path 参数：** `id` — 租户 UUID

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "8f14e45f-ceea-467a-a866-1d7e0d1b2e9a",
    "name": "某某酒水经销商",
    "contactPhone": "13800138000",
    "status": 1,
    "expireAt": "2027-03-25T00:00:00.000Z",
    "maxCreditDays": 30,
    "creditReminderDays": 3,
    "agentId": "agent-uuid-001",
    "agentName": "华东区代理商",
    "paymentConfig": {
      "lakalaShopNo": "LKL_SHOP_001"
    },
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-03-25T10:00:00.000Z"
  }
}
```

---

### 3.3 创建租户

**`POST /os/tenants`** `[OS_SUPER_ADMIN]`

**Request Body：**

```json
{
  "name": "某某酒水经销商",
  "contactPhone": "13800138000",
  "agentId": "agent-uuid-001",
  "expireAt": "2027-03-25T00:00:00.000Z",
  "maxCreditDays": 30,
  "paymentConfig": {
    "lakalaShopNo": "LKL_SHOP_001"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | ✅ | 经销商名称 |
| `contactPhone` | `string` | ✅ | 联系手机号 |
| `agentId` | `string` | ❌ | 所属代理商ID，无代理商时留空 |
| `expireAt` | `string` | ❌ | SaaS 到期时间（ISO 8601 UTC） |
| `maxCreditDays` | `number` | ❌ | 最大账期天数，默认 30 |
| `paymentConfig` | `object` | ❌ | 拉卡拉进件参数（公开字段，不含密钥） |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "8f14e45f-ceea-467a-a866-1d7e0d1b2e9a",
    "name": "某某酒水经销商",
    "contactPhone": "13800138000",
    "status": 1,
    "maxCreditDays": 30,
    "createdAt": "2026-03-25T10:00:00.000Z"
  }
}
```

---

### 3.4 更新租户信息

**`PATCH /os/tenants/:id`** `[OS_SUPER_ADMIN]`

**Path 参数：** `id` — 租户 UUID

**Request Body（字段均为可选，仅传需要修改的字段）：**

```json
{
  "name": "新名称酒水经销商",
  "contactPhone": "13900139000",
  "expireAt": "2028-03-25T00:00:00.000Z",
  "maxCreditDays": 45,
  "paymentConfig": {
    "lakalaShopNo": "LKL_SHOP_002"
  }
}
```

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "8f14e45f-ceea-467a-a866-1d7e0d1b2e9a",
    "name": "新名称酒水经销商",
    "maxCreditDays": 45,
    "updatedAt": "2026-03-25T10:30:00.000Z"
  }
}
```

---

### 3.5 封禁 / 恢复租户

**`POST /os/tenants/:id/suspend`** `[OS_SUPER_ADMIN]`

**`POST /os/tenants/:id/restore`** `[OS_SUPER_ADMIN]`

无 Request Body。封禁后该租户下所有员工登录请求返回 HTTP `403`。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": { "id": "8f14e45f-ceea-467a-a866-1d7e0d1b2e9a", "status": 0 }
}
```

---

### 3.6 获取代理商列表

**`GET /os/agents`** `[OS_SUPER_ADMIN, OS_OPERATOR]`

**Query 参数：** `page` `pageSize` `keyword`（模糊匹配名称/电话）

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "agent-uuid-001",
        "name": "华东区代理商",
        "contactPhone": "13700137000",
        "commissionRate": "0.0050",
        "tenantCount": 12,
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 3.7 获取代理商详情

**`GET /os/agents/:id`** `[OS_SUPER_ADMIN, OS_OPERATOR]`

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "agent-uuid-001",
    "name": "华东区代理商",
    "contactPhone": "13700137000",
    "commissionRate": "0.0050",
    "tenantCount": 12,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-03-25T10:00:00.000Z"
  }
}
```

---

### 3.8 创建代理商

**`POST /os/agents`** `[OS_SUPER_ADMIN]`

**Request Body：**

```json
{
  "name": "华东区代理商",
  "contactPhone": "13700137000",
  "commissionRate": 0.005
}
```

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "agent-uuid-002",
    "name": "华东区代理商",
    "contactPhone": "13700137000",
    "commissionRate": "0.0050",
    "createdAt": "2026-03-25T10:00:00.000Z"
  }
}
```

---

### 3.9 更新代理商信息

**`PATCH /os/agents/:id`** `[OS_SUPER_ADMIN]`

**Request Body（字段均为可选）：**

```json
{
  "name": "华东区代理商（更新）",
  "contactPhone": "13700137001",
  "commissionRate": 0.006
}
```

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "agent-uuid-001",
    "name": "华东区代理商（更新）",
    "commissionRate": "0.0060",
    "updatedAt": "2026-03-25T11:00:00.000Z"
  }
}
```

---

### 3.10 禁用 / 启用代理商

**`POST /os/agents/:id/disable`** `[OS_SUPER_ADMIN]`

**`POST /os/agents/:id/enable`** `[OS_SUPER_ADMIN]`

无 Request Body。禁用后该代理商下属关联关系保留，不影响租户正常使用。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": { "id": "agent-uuid-001", "disabled": true }
}
```

---

### 3.11 平台总报表

**`GET /os/reports/platform`** `[OS_SUPER_ADMIN, OS_OPERATOR]`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `startDate` | `string` | ✅ | 开始日期 `YYYY-MM-DD` |
| `endDate` | `string` | ✅ | 结束日期 `YYYY-MM-DD` |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "totalPaidAmount": "1580000.00",
    "totalOrderCount": 3200,
    "activeTenantCount": 45,
    "pendingCommissionAmount": "7900.00",
    "dailyTrend": [
      { "date": "2026-03-24", "paidAmount": "52000.00", "orderCount": 108 },
      { "date": "2026-03-25", "paidAmount": "48000.00", "orderCount": 96 }
    ]
  }
}
```

---

### 3.12 OS 账号管理

> OS 账号仅由 `OS_SUPER_ADMIN` 手动创建，无自助注册流程。

**`GET /os/users`** `[OS_SUPER_ADMIN]`

**Query 参数：** `page` `pageSize`

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "os-user-uuid-001",
        "username": "operator_east",
        "realName": "运营-华东",
        "role": "OS_OPERATOR",
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20
  }
}
```

**`POST /os/users`** `[OS_SUPER_ADMIN]`

**Request Body：**

```json
{
  "username": "operator_east",
  "password": "Abc123456",
  "realName": "运营-华东",
  "role": "OS_OPERATOR"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `username` | `string` | ✅ | OS 系统内唯一 |
| `password` | `string` | ✅ | 初始密码 |
| `realName` | `string` | ✅ | 真实姓名 |
| `role` | `string` | ✅ | 枚举：`OS_SUPER_ADMIN` / `OS_OPERATOR` |

**`PATCH /os/users/:id`** `[OS_SUPER_ADMIN]` — 更新（realName / password / role）

**`POST /os/users/:id/disable`** `[OS_SUPER_ADMIN]` — 禁用账号

---

## 四、租户员工模块

> 以下接口均在当前 JWT 所属租户上下文内操作，中间件自动注入 `tenantId`，无需手动传入。

### 4.1 获取员工列表

**`GET /tenant/users`** `[TENANT_OWNER]`

**Query 参数：** `page` `pageSize` `status`（`1`=可用 `0`=冻结）

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "user-uuid-001",
        "username": "operator01",
        "realName": "李四",
        "role": "TENANT_OPERATOR",
        "status": 1,
        "createdAt": "2026-02-01T00:00:00.000Z"
      }
    ],
    "total": 4,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 4.2 获取员工详情

**`GET /tenant/users/:id`** `[TENANT_OWNER]`

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "user-uuid-001",
    "username": "operator01",
    "realName": "李四",
    "role": "TENANT_OPERATOR",
    "status": 1,
    "createdAt": "2026-02-01T00:00:00.000Z",
    "updatedAt": "2026-03-01T00:00:00.000Z"
  }
}
```

---

### 4.3 创建员工账号

**`POST /tenant/users`** `[TENANT_OWNER]`

**Request Body：**

```json
{
  "username": "finance01",
  "password": "Abc123456",
  "realName": "王五",
  "role": "TENANT_FINANCE"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `username` | `string` | ✅ | 同一租户内唯一 |
| `password` | `string` | ✅ | 初始密码 |
| `realName` | `string` | ✅ | 真实姓名 |
| `role` | `string` | ✅ | 枚举：`TENANT_OPERATOR` / `TENANT_FINANCE` / `TENANT_VIEWER` |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "user-uuid-002",
    "username": "finance01",
    "realName": "王五",
    "role": "TENANT_FINANCE",
    "status": 1
  }
}
```

---

### 4.4 更新员工信息

**`PATCH /tenant/users/:id`** `[TENANT_OWNER]`

**Request Body（字段均可选）：**

```json
{
  "realName": "王五（出纳）",
  "role": "TENANT_VIEWER",
  "password": "NewPassword123"
}
```

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "user-uuid-002",
    "realName": "王五（出纳）",
    "role": "TENANT_VIEWER",
    "updatedAt": "2026-03-25T11:00:00.000Z"
  }
}
```

---

### 4.5 冻结 / 恢复员工账号

**`POST /tenant/users/:id/freeze`** `[TENANT_OWNER]`

**`POST /tenant/users/:id/unfreeze`** `[TENANT_OWNER]`

无 Request Body。冻结后该员工登录返回 HTTP `403`，无法执行任何操作。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": { "id": "user-uuid-002", "status": 0 }
}
```

---

## 五、导入模板模块

> **Excel 解析策略**：前端使用 SheetJS 在**浏览器端**完成 Excel 文件解析，**不上传原始文件**到服务端。服务端仅接收解析后的结构化 JSON 数据用于校验和预览确认。

### 5.1 获取模板列表

**`GET /import/templates`** `[TENANT_OWNER, TENANT_OPERATOR]`

**Query 参数：** `page`（默认 1）`pageSize`（默认 20）

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "tmpl-uuid-001",
        "templateName": "某某酒水分部-金蝶K3导出模板",
        "mappingRules": {
          "ERP订单号": "erpOrderNo",
          "客户名称": "customerName",
          "客户电话": "customerPhone",
          "送货地址": "deliveryAddress",
          "送货人": "deliveryPersonName",
          "应收金额": "totalAmount"
        },
        "customFieldDefs": [
          { "columnHeader": "内部备注", "fieldKey": "remark1", "label": "备注1", "showInList": true },
          { "columnHeader": "区域编号", "fieldKey": "remark2", "label": "区域",  "showInList": false }
        ],
        "createdAt": "2026-02-10T00:00:00.000Z"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 5.2 创建导入模板

**`POST /import/templates`** `[TENANT_OWNER, TENANT_OPERATOR]`

**Request Body：**

```json
{
  "templateName": "某某酒水分部-金蝶K3导出模板",
  "mappingRules": {
    "ERP订单号": "erpOrderNo",
    "客户名称": "customerName",
    "客户电话": "customerPhone",
    "送货地址": "deliveryAddress",
    "送货人": "deliveryPersonName",
    "应收金额": "totalAmount"
  },
  "customFieldDefs": [
    { "columnHeader": "内部备注", "fieldKey": "remark1", "label": "备注1", "showInList": true },
    { "columnHeader": "区域编号", "fieldKey": "remark2", "label": "区域",  "showInList": false }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `templateName` | `string` | ✅ | 模板名称 |
| `mappingRules` | `object` | ✅ | Excel列头 → 系统标准字段的映射关系 |
| `customFieldDefs` | `array` | ❌ | 自定义扩展字段定义列表，默认空数组 |
| `customFieldDefs[].columnHeader` | `string` | ✅ | Excel 中的列头名（需与表格实际列名一致） |
| `customFieldDefs[].fieldKey` | `string` | ✅ | 存入 `order.customFields` 的 JSON key（英文标识，建议 remark1/remark2） |
| `customFieldDefs[].label` | `string` | ✅ | 前端订单列表展示的列头名称 |
| `customFieldDefs[].showInList` | `boolean` | ✅ | `true` 时在按模板筛选的订单列表中渲染为额外列 |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "tmpl-uuid-002",
    "templateName": "某某酒水分部-金蝶K3导出模板",
    "createdAt": "2026-03-25T10:00:00.000Z"
  }
}
```

---

### 5.3 更新导入模板

**`PATCH /import/templates/:id`** `[TENANT_OWNER, TENANT_OPERATOR]`

**Request Body（字段均可选）：**

```json
{
  "templateName": "新模板名称",
  "mappingRules": {
    "单据编号": "erpOrderNo",
    "终端名称": "customerName"
  },
  "customFieldDefs": [
    { "columnHeader": "内部备注", "fieldKey": "remark1", "label": "备注1", "showInList": true }
  ]
}
```

**Response：** 同创建，返回更新后完整对象。

---

### 5.4 删除导入模板

**`DELETE /import/templates/:id`** `[TENANT_OWNER]`

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": null
}
```

---

### 5.5 导入数据预检校验

**`POST /import/preview`** `[TENANT_OWNER, TENANT_OPERATOR]`

前端使用 SheetJS 在浏览器端完成 Excel 解析与字段映射后，将解析结果以 JSON 形式提交至本接口，服务端执行业务规则校验（重复单号、金额合法性等），返回校验报告供用户确认后再正式提交入库。

**Request Body：**

```json
{
  "templateId": "tmpl-uuid-001",
  "rows": [
    {
      "erpOrderNo": "KD2026032500001",
      "customerName": "某某便利店",
      "customerPhone": "13500135000",
      "deliveryAddress": "XX街道XX号",
      "deliveryPersonName": "赵六",
      "totalAmount": "1580.00",
      "customFields": {
        "remark1": "A区重点客户",
        "remark2": "VIP"
      }
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `templateId` | `string` | ❌ | 套用已有模板ID；不传则视为无模板自由映射 |
| `rows` | `array` | ✅ | 浏览器端解析并完成字段映射后的数据行 |
| `rows[].customFields` | `object` | ❌ | 按模板 `customFieldDefs` 提取的自定义列数据，key 为 `fieldKey`，value 为对应单元格内容 |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "totalRows": 156,
    "validRows": 154,
    "invalidRows": 2,
    "preview": [
      {
        "erpOrderNo": "KD2026032500001",
        "customerName": "某某便利店",
        "customerPhone": "13500135000",
        "deliveryPersonName": "赵六",
        "totalAmount": "1580.00",
        "customFields": {
          "remark1": "A区重点客户",
          "remark2": "VIP"
        }
      }
    ],
    "errors": [
      { "row": 12, "reason": "应收金额为空或非数字" },
      { "row": 45, "reason": "ERP单号与已有订单重复" }
    ]
  }
}
```

---

## 六、订单模块

### 6.1 获取订单列表

**`GET /orders`** `[TENANT_OWNER, TENANT_OPERATOR, TENANT_FINANCE, TENANT_VIEWER]`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `page` | `number` | ❌ | 默认 1 |
| `pageSize` | `number` | ❌ | 默认 20 |
| `payStatus` | `string` | ❌ | 枚举：`UNPAID` `PAYING` `PENDING_VERIFICATION` `PARTIAL_PAID` `PAID` `REFUNDED` |
| `deliveryStatus` | `string` | ❌ | 枚举：`PENDING` `IN_TRANSIT` `DELIVERED` |
| `keyword` | `string` | ❌ | 模糊搜索：ERP单号 / 客户名称 / 送货人 |
| `templateId` | `string` | ❌ | 按导入模板筛选 |
| `startDate` | `string` | ❌ | 生单开始日期 `YYYY-MM-DD` |
| `endDate` | `string` | ❌ | 生单结束日期 `YYYY-MM-DD` |
| `creditExpiring` | `boolean` | ❌ | `true` 仅返回账期即将到期（7天内）的未付订单 |

**Response：**

> 当查询参数中携带 `templateId` 时，响应 `data` 根节点额外返回 `templateCustomFields` 字段，前端据此动态渲染自定义列头；未传 `templateId` 时该字段不存在。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "order-uuid-001",
        "erpOrderNo": "KD2026032500001",
        "customerName": "某某便利店",
        "customerPhone": "13500135000",
        "deliveryPersonName": "赵六",
        "totalAmount": "1580.00",
        "paidAmount": "0.00",
        "discountAmount": "0.00",
        "payStatus": "UNPAID",
        "deliveryStatus": "PENDING",
        "creditExpireAt": "2026-04-24T00:00:00.000Z",
        "customFields": {
          "remark1": "A区重点客户",
          "remark2": "VIP"
        },
        "createdAt": "2026-03-25T08:00:00.000Z"
      }
    ],
    "total": 256,
    "page": 1,
    "pageSize": 20,
    "templateCustomFields": [
      { "fieldKey": "remark1", "label": "备注1", "showInList": true },
      { "fieldKey": "remark2", "label": "区域",  "showInList": false }
    ]
  }
}
```

> `templateCustomFields` 仅在 `templateId` 筛选激活时出现，内容来自对应模板的 `customFieldDefs`（过滤掉 `columnHeader`，前端仅需 `fieldKey` / `label` / `showInList` 三项）。`showInList: true` 的字段前端渲染为额外表格列；`showInList: false` 的字段可在详情页展示，不在列表列头出现。

---

### 6.2 获取订单详情

**`GET /orders/:id`** `[TENANT_OWNER, TENANT_OPERATOR, TENANT_FINANCE, TENANT_VIEWER]`

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "order-uuid-001",
    "erpOrderNo": "KD2026032500001",
    "customerName": "某某便利店",
    "customerPhone": "13500135000",
    "deliveryAddress": "XX街道XX号",
    "deliveryPersonName": "赵六",
    "totalAmount": "1580.00",
    "paidAmount": "1480.00",
    "discountAmount": "100.00",
    "payStatus": "PAID",
    "deliveryStatus": "DELIVERED",
    "creditExpireAt": "2026-04-24T00:00:00.000Z",
    "qrCodeToken": "a3f8d2c1b9e4...",
    "qrExpireAt": "2026-12-31T00:00:00.000Z",
    "customFields": {
      "remark1": "A区重点客户",
      "remark2": "VIP"
    },
    "createdAt": "2026-03-25T08:00:00.000Z",
    "items": [
      {
        "id": "item-uuid-001",
        "productName": "某品牌白酒 500ml×6",
        "quantity": 2,
        "unitPrice": "480.00",
        "amount": "960.00"
      },
      {
        "id": "item-uuid-002",
        "productName": "某品牌啤酒 330ml×24",
        "quantity": 5,
        "unitPrice": "124.00",
        "amount": "620.00"
      }
    ],
    "payments": [
      {
        "id": "pay-uuid-001",
        "paymentMethod": "ONLINE_PAYMENT",
        "actualAmount": "1480.00",
        "channel": "LAKALA",
        "channelTradeNo": "LKL20260325000001",
        "status": "SUCCESS",
        "paidTime": "2026-03-25T09:30:00.000Z"
      }
    ],
    "logs": [
      {
        "event": "ORDER_CREATED",
        "operatorId": "user-uuid-001",
        "snapshot": null,
        "createdAt": "2026-03-25T08:00:00.000Z"
      },
      {
        "event": "PRICE_ADJUSTED",
        "operatorId": "user-uuid-001",
        "snapshot": { "before": { "discountAmount": "0.00" }, "after": { "discountAmount": "100.00" } },
        "createdAt": "2026-03-25T09:00:00.000Z"
      }
    ]
  }
}
```

---

### 6.3 批量导入订单

**`POST /orders/import`** `[TENANT_OWNER, TENANT_OPERATOR]`

前端通过 `/import/preview` 预检通过后，调用本接口提交解析后的订单数据异步入库。

**Request Body：**

```json
{
  "templateId": "tmpl-uuid-001",
  "orders": [
    {
      "erpOrderNo": "KD2026032500001",
      "customerName": "某某便利店",
      "customerPhone": "13500135000",
      "deliveryAddress": "XX街道XX号",
      "deliveryPersonName": "赵六",
      "totalAmount": "1580.00",
      "customFields": {
        "remark1": "A区重点客户",
        "remark2": "VIP"
      },
      "items": [
        {
          "productName": "某品牌白酒 500ml×6",
          "quantity": 2,
          "unitPrice": "480.00",
          "amount": "960.00"
        }
      ]
    }
  ]
}
```

**Response（异步入库，返回任务ID）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "jobId": "bullmq-job-uuid-001",
    "submittedCount": 154,
    "status": "PENDING"
  }
}
```

---

### 6.4 查询导入任务进度

**`GET /orders/import/jobs/:jobId`** `[TENANT_OWNER, TENANT_OPERATOR]`

轮询查询批量导入任务的处理进度。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "jobId": "bullmq-job-uuid-001",
    "status": "COMPLETED",
    "submittedCount": 154,
    "successCount": 152,
    "failedCount": 2,
    "errors": [
      { "erpOrderNo": "KD2026032500099", "reason": "ERP单号与已有订单重复" }
    ]
  }
}
```

| `status` 枚举 | 说明 |
|---|---|
| `PENDING` | 队列等待中 |
| `PROCESSING` | 处理中 |
| `COMPLETED` | 已完成（含部分失败） |
| `FAILED` | 任务整体失败 |

---

### 6.5 调整订单金额（改价）

**`PATCH /orders/:id/discount`** `[TENANT_OWNER, TENANT_OPERATOR]`

仅允许写入 `discountAmount`，`totalAmount` 严禁修改。后端自动写入操作流水快照。

**Request Body：**

```json
{
  "discountAmount": "100.00",
  "reason": "客户现场议价，抹零100元"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `discountAmount` | `string` | ✅ | 减免金额，不得超过 `totalAmount - paidAmount - currentDiscountAmount` |
| `reason` | `string` | ❌ | 改价原因，写入操作流水 remark |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "order-uuid-001",
    "totalAmount": "1580.00",
    "paidAmount": "0.00",
    "discountAmount": "100.00",
    "payStatus": "UNPAID"
  }
}
```

---

### 6.6 手工标记已支付

**`POST /orders/:id/manual-paid`** `[TENANT_OWNER, TENANT_OPERATOR]`

用于线下转账、现金等无法通过扫码完成的结算场景。若 `actualAmount` 小于应付金额（`totalAmount - paidAmount - discountAmount`），订单状态将置为 `PARTIAL_PAID`；等于应付金额时置为 `PAID`。

**Request Body：**

```json
{
  "actualAmount": "1480.00",
  "markReason": "客户已现金付款，司机代收",
  "paidTime": "2026-03-25T14:00:00.000Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `actualAmount` | `string` | ✅ | 本次实收金额，不得超过当前应付余额 |
| `markReason` | `string` | ✅ | 标记原因 |
| `paidTime` | `string` | ❌ | 实际收款时间（ISO 8601 UTC），默认当前时间 |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "order-uuid-001",
    "paidAmount": "1480.00",
    "discountAmount": "100.00",
    "payStatus": "PAID"
  }
}
```

---

### 6.7 作废订单

**`POST /orders/:id/void`** `[TENANT_OWNER]`

用于处理误导入、重复导入等错误订单数据。作废后订单保留数据库记录，但不再参与默认列表统计与财务报表汇总。

**Request Body：**

```json
{
  "reason": "Excel 错误导入，订单金额无效"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `reason` | `string` | ✅ | 作废原因，写入操作流水 |

**业务规则：**

- 仅未支付订单允许作废
- 已支付订单不得直接作废，需走退款/冲正链路
- 订单作废后写入 `ORDER_VOIDED` 生命周期日志

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "order-uuid-001",
    "voided": true,
    "voidReason": "Excel 错误导入，订单金额无效",
    "voidedAt": "2026-04-07T12:00:00.000Z"
  }
}
```

---

### 6.8 更新配送状态

**`PATCH /orders/:id/delivery-status`** `[TENANT_OWNER, TENANT_OPERATOR]`

**Request Body：**

```json
{
  "deliveryStatus": "IN_TRANSIT"
}
```

枚举值（单向流转）：`PENDING`（已打单）→ `IN_TRANSIT`（已出车）→ `DELIVERED`（已送达）

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "order-uuid-001",
    "deliveryStatus": "IN_TRANSIT"
  }
}
```

---

### 6.9 获取订单支付二维码

**`GET /orders/:id/qrcode`** `[TENANT_OWNER, TENANT_OPERATOR]`

用于打印发货单时渲染二维码图片。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "qrCodeUrl": "https://m.platform.com/pay/a3f8d2c1b9e4...",
    "qrCodeToken": "a3f8d2c1b9e4...",
    "qrExpireAt": "2026-12-31T00:00:00.000Z"
  }
}
```

---

## 七、打印模块

### 7.1 创建批量打印任务

**`POST /print/jobs`** `[TENANT_OWNER, TENANT_OPERATOR]`

触发后端生成打印数据，返回打印 HTML 数据供浏览器 `@media print` 渲染。

**Request Body：**

```json
{
  "orderIds": [
    "order-uuid-001",
    "order-uuid-002",
    "order-uuid-003"
  ]
}
```

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "jobId": "print-job-uuid-001",
    "orderCount": 3,
    "printData": [
      {
        "orderId": "order-uuid-001",
        "erpOrderNo": "KD2026032500001",
        "customerName": "某某便利店",
        "deliveryAddress": "XX街道XX号",
        "deliveryPersonName": "赵六",
        "totalAmount": "1580.00",
        "discountAmount": "100.00",
        "items": [
          { "productName": "某品牌白酒 500ml×6", "quantity": 2, "unitPrice": "480.00", "amount": "960.00" }
        ],
        "qrCodeUrl": "https://m.platform.com/pay/a3f8d2c1b9e4...",
        "customFields": {
          "remark1": "A区重点客户",
          "remark2": "VIP"
        }
      }
    ]
  }
}
```

---

## 八、支付模块（后台侧）

### 8.1 拉卡拉支付回调（Webhook）

**`POST /payment/webhook/lakala`** `[PUBLIC]`

拉卡拉支付成功后主动回调本接口。后端校验签名后更新订单支付状态，写入支付流水与操作日志。

> **安全机制**：不走 JWT，后端通过拉卡拉提供的公钥校验请求签名，签名不合法直接返回 HTTP `400`。

> **响应格式特例**：本接口响应不遵循全局统一格式（§1.4），按拉卡拉回调协议要求返回以下格式：

**Request Body（拉卡拉标准回调格式，字段名以实际对接为准）：**

```json
{
  "merchantOrderNo": "a3f8d2c1b9e4...",
  "channelTradeNo": "LKL20260325000001",
  "tradeStatus": "SUCCESS",
  "totalAmount": "1480.00",
  "payTime": "2026-03-25T09:30:00.000Z",
  "sign": "BASE64_SIGNATURE_STRING"
}
```

**Response（拉卡拉要求返回指定格式以确认收单）：**

```json
{
  "code": "SUCCESS",
  "message": "OK"
}
```

> 若 `channelTradeNo` 已存在（唯一约束冲突），静默返回 `SUCCESS` 跳过重复入账。

---

### 8.2 现金核销

**`POST /orders/:id/verify-cash`** `[TENANT_FINANCE]`

用于核销 H5 端登记的现金支付订单。核销成功后订单状态由 `PENDING_VERIFICATION` 更新为 `PAID`，同时新增一条现金收款流水。

**业务规则：**

- 仅 `PENDING_VERIFICATION` 状态允许核销
- 核销成功后写入生命周期日志

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "order-uuid-001",
    "payStatus": "PAID",
    "verifiedAt": "2026-04-07T13:00:00.000Z"
  }
}
```

---

## 九、买家收款页模块（C端）

> 以下四个接口无需 JWT 鉴权，以 `qrCodeToken` 作为访问凭证。后端在处理每个请求时均校验 Token 有效性与订单状态。

### 9.1 查询订单信息

**`GET /pay/:token`** `[PUBLIC]`

买家扫码后 H5 页面首屏加载调用，获取订单基本信息用于展示。

**Path 参数：** `token` — 订单专属 qrCodeToken

**Response（未支付）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "orderId": "order-uuid-001",
    "payStatus": "UNPAID",
    "customerName": "某某便利店",
    "totalAmount": "1580.00",
    "discountAmount": "100.00",
    "payableAmount": "1480.00",
    "items": [
      { "productName": "某品牌白酒 500ml×6", "quantity": 2, "amount": "960.00" },
      { "productName": "某品牌啤酒 330ml×24", "quantity": 5, "amount": "620.00" }
    ]
  }
}
```

**Response（已支付）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "orderId": "order-uuid-001",
    "payStatus": "PAID",
    "paidAmount": "1480.00",
    "paidTime": "2026-03-25T09:30:00.000Z"
  }
}
```

**Response（现金待核销）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "orderId": "order-uuid-001",
    "payStatus": "PENDING_VERIFICATION",
    "offlinePayment": {
      "method": "CASH",
      "remark": "买家表示以现金支付",
      "submittedAt": "2026-04-07T12:30:00.000Z"
    }
  }
}
```

**Response（二维码过期，业务错误码 1002）：**

```json
{
  "code": 1002,
  "message": "二维码已过期，请联系经销商重新获取",
  "data": null
}
```

---

### 9.2 发起收银请求

**`POST /pay/:token/initiate`** `[PUBLIC]`

买家点击「立即支付」按钮后调用。后端向拉卡拉发起收银请求，返回拉卡拉原生收银页 URL，前端跳转。

> 后端在此步骤将订单状态改为 `PAYING`，并写入 `PAYMENT_INITIATED` 流水日志，防止并发重复发起。

**Request Body：** 无（金额由后端服务端定格，前端无权传入）

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "cashierUrl": "https://cashier.lakala.com/pay?token=LAKALA_PAY_TOKEN_001",
    "orderId": "order-uuid-001",
    "payableAmount": "1480.00"
  }
}
```

**Response（已支付，阻断重复发起，业务错误码 1001）：**

```json
{
  "code": 1001,
  "message": "订单已支付，请勿重复操作",
  "data": null
}
```

**Response（支付中，阻断并发，业务错误码 1003）：**

```json
{
  "code": 1003,
  "message": "支付进行中，请稍候...",
  "data": null
}
```

---

### 9.3 登记现金待核销

**`POST /pay/:token/offline-payment`** `[PUBLIC]`

买家选择现金支付后调用，订单状态转为 `PENDING_VERIFICATION`，等待 Tenant 财务核销。

**Request Body：**

```json
{
  "paymentMethod": "CASH",
  "remark": "买家表示已线下现金支付"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `paymentMethod` | `string` | ✅ | 当前固定为 `CASH` |
| `remark` | `string` | ✅ | 现金登记备注 |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "orderId": "order-uuid-001",
    "payStatus": "PENDING_VERIFICATION",
    "offlinePayment": {
      "method": "CASH",
      "remark": "买家表示已线下现金支付",
      "submittedAt": "2026-04-07T12:30:00.000Z"
    }
  }
}
```

---

### 9.4 主动查询支付状态（轮询）

**`GET /pay/:token/status`** `[PUBLIC]`

买家从拉卡拉收银页切回 H5 时触发，前端主动调用此接口查询最终结果。后端同步向拉卡拉查询，确保零掉单。

**Response（支付成功）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "payStatus": "PAID",
    "paidAmount": "1480.00",
    "paidTime": "2026-03-25T09:30:00.000Z"
  }
}
```

**Response（支付中，继续轮询）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "payStatus": "PAYING"
  }
}
```

---

**Response（现金待核销）：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "payStatus": "PENDING_VERIFICATION",
    "offlinePayment": {
      "method": "CASH",
      "remark": "买家表示已线下现金支付",
      "submittedAt": "2026-04-07T12:30:00.000Z"
    }
  }
}
```

---

## 十、财务报表模块

### 10.1 回款概览

**`GET /report/summary`** `[TENANT_OWNER, TENANT_FINANCE, TENANT_VIEWER]`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `startDate` | `string` | ✅ | `YYYY-MM-DD` |
| `endDate` | `string` | ✅ | `YYYY-MM-DD` |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "totalOrderAmount": "580000.00",
    "totalPaidAmount": "520000.00",
    "totalDiscountAmount": "8000.00",
    "unpaidAmount": "52000.00",
    "paidOrderCount": 320,
    "unpaidOrderCount": 38,
    "collectionRate": "89.66",
    "byDeliveryPerson": [
      { "name": "赵六", "paidAmount": "180000.00", "orderCount": 110 },
      { "name": "孙七", "paidAmount": "160000.00", "orderCount": 98 }
    ],
    "byTemplate": [
      { "templateName": "某某分部-金蝶K3", "paidAmount": "320000.00", "orderCount": 200 }
    ]
  }
}
```

---

### 10.2 订单明细报表

**`GET /report/orders`** `[TENANT_OWNER, TENANT_FINANCE, TENANT_VIEWER]`

**Query 参数：** 同 `GET /orders`，额外支持导出标志 `export=true`（返回文件流，暂不展开）。

**Response：** 同 `GET /orders` 分页列表格式，含金额汇总行。

---

### 10.3 支付流水报表

**`GET /report/payments`** `[TENANT_OWNER, TENANT_FINANCE]`

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `startDate` | `string` | ✅ | `YYYY-MM-DD` |
| `endDate` | `string` | ✅ | `YYYY-MM-DD` |
| `paymentMethod` | `string` | ❌ | `ONLINE_PAYMENT` / `MANUAL_MARKUP` |
| `page` | `number` | ❌ | 默认 1 |
| `pageSize` | `number` | ❌ | 默认 20 |

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "pay-uuid-001",
        "orderId": "order-uuid-001",
        "erpOrderNo": "KD2026032500001",
        "customerName": "某某便利店",
        "paymentMethod": "ONLINE_PAYMENT",
        "actualAmount": "1480.00",
        "channel": "LAKALA",
        "channelTradeNo": "LKL20260325000001",
        "status": "SUCCESS",
        "paidTime": "2026-03-25T09:30:00.000Z"
      }
    ],
    "total": 320,
    "page": 1,
    "pageSize": 20,
    "totalAmount": "520000.00"
  }
}
```

---

## 十一、站内信模块

### 11.1 获取未读消息数

**`GET /notifications/unread-count`** `[TENANT_OWNER, TENANT_FINANCE]`

用于顶部导航角标展示，高频轮询（建议 30 秒间隔）。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "unreadCount": 3
  }
}
```

---

### 11.2 获取消息列表

**`GET /notifications`** `[TENANT_OWNER, TENANT_FINANCE]`

**Query 参数：** `page` `pageSize` `isRead`（`true`=已读 `false`=未读）

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "notif-uuid-001",
        "type": "CREDIT_OVERDUE_REMINDER",
        "title": "账期提醒：3笔订单将于3天后到期",
        "content": "以下订单账期将于 2026-03-28 到期，请及时跟进回款：KD2026032500001、KD2026032500002、KD2026032500003",
        "isRead": false,
        "relatedOrderId": null,
        "createdAt": "2026-03-25T06:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 11.3 标记单条消息已读

**`PATCH /notifications/:id/read`** `[TENANT_OWNER, TENANT_FINANCE]`

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "notif-uuid-001",
    "isRead": true,
    "readAt": "2026-03-25T10:00:00.000Z"
  }
}
```

---

### 11.4 全部标记已读

**`POST /notifications/read-all`** `[TENANT_OWNER, TENANT_FINANCE]`

将当前用户所有未读消息批量标记为已读。

> **注意**：本接口使用 `POST` 而非 `PATCH`，以避免与 `PATCH /notifications/:id/read` 产生路由匹配冲突（NestJS 路由按注册顺序匹配，"read-all" 会被 `/:id` 模式捕获）。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "updatedCount": 3
  }
}
```

---

## 十二、租户设置模块

### 12.1 获取租户配置

**`GET /tenant/settings`** `[TENANT_OWNER]`

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "name": "某某酒水经销商",
    "contactPhone": "13800138000",
    "maxCreditDays": 30,
    "creditReminderDays": 3,
    "expireAt": "2027-03-25T00:00:00.000Z",
    "paymentConfig": {
      "lakalaShopNo": "LKL_SHOP_001"
    }
  }
}
```

---

### 12.2 更新租户配置

**`PATCH /tenant/settings`** `[TENANT_OWNER]`

> 仅允许修改账期相关配置；`paymentConfig`（进件参数）、`expireAt`（SaaS 期限）的修改权限归 OS 端，租户侧无法自行变更。

**Request Body（字段均可选）：**

```json
{
  "maxCreditDays": 45,
  "creditReminderDays": 7
}
```

---

### 12.3 获取固定角色列表（占位接口）

**`GET /settings/roles`** `[TENANT_OWNER]`

> Phase 1 仅返回系统固定角色枚举，不支持动态角色 CRUD。后续如进入统一权限中心，再扩展相关写接口。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "code": "TENANT_OWNER", "label": "老板", "readonly": true },
    { "code": "TENANT_OPERATOR", "label": "打单员", "readonly": true },
    { "code": "TENANT_FINANCE", "label": "财务", "readonly": true },
    { "code": "TENANT_VIEWER", "label": "只读账号", "readonly": true }
  ]
}
```

---

### 12.4 获取固定权限树（占位接口）

**`GET /settings/permissions`** `[TENANT_OWNER]`

> Phase 1 仅返回固定权限树结构，用于前端展示角色与权限映射关系，不提供保存接口。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "orders",
      "label": "订单管理",
      "children": [
        { "id": "orders.list", "label": "查看订单列表" },
        { "id": "orders.discount", "label": "调整订单金额" },
        { "id": "orders.void", "label": "作废订单" }
      ]
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `maxCreditDays` | `number` | ❌ | 最大账期天数，范围 `1-365` |
| `creditReminderDays` | `number` | ❌ | 提前提醒天数，范围 `1-30`，不得大于 `maxCreditDays` |

> **注意**：修改 `maxCreditDays` 仅影响**新生成订单**的 `creditExpireAt` 快照，历史订单账期截止日不变。

**Response：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "maxCreditDays": 45,
    "creditReminderDays": 7,
    "updatedAt": "2026-03-25T11:00:00.000Z"
  }
}
```

---

*本文档版本 V1.2，接口细节如有调整请同步更新并递增版本号。*
