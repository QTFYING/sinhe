# 订单链路 PRD

> 日期：2026-04-15
> 文档状态：当前生效
> 面向对象：前端工程师、联调同学、AI 提示词使用者
> 关联文档：
> - `docs/api/tenant-api-doc.md`
> - `docs/api/api-architecture-overview.md`

## 一、背景

当前订单导入链路需要解决 3 个问题：

1. 旧模板结构使用 `sourceColumns / fields / mappings` 三段式，前后端心智成本高。
2. 旧预检接口直接吃 Excel 原始行，导致“模板映射”和“订单校验”耦合在一个接口里。
3. 导入完成后，订单列表/详情与导入阶段使用的字段口径不一致，不利于前端联调和 AI 生成代码。

本轮目标是把订单导入链路统一成一套清晰的对象模型：

- 默认模板 `defaultFields`
- 租户模板 `customerFields`
- 标准订单 `orders[]`
- 预检结果 `previewId`
- 正式导入任务 `jobId`

## 二、范围

本轮覆盖以下 9 个接口：

1. `GET /import/default-template`
2. `GET /import/templates`
3. `POST /import/templates`
4. `PUT /import/templates/{id}`
5. `POST /import/preview`
6. `POST /orders/import`
7. `GET /orders/import/jobs/{jobId}`
8. `GET /orders`
9. `GET /orders/{id}`

本轮不展开手工建单、改单、打印回执、催款、回款等动作型接口。

## 三、核心对象

### 3.1 默认模板字段

系统默认模板固定 6 个字段：

```json
[
  { "label": "源订单号", "key": "sourceOrderNo", "mapStr": "", "isRequired": true },
  { "label": "客户名称", "key": "customer", "mapStr": "", "isRequired": true },
  { "label": "商品名称", "key": "skuName", "mapStr": "", "isRequired": true },
  { "label": "行金额", "key": "lineAmount", "mapStr": "", "isRequired": true },
  { "label": "总金额", "key": "totalAmount", "mapStr": "", "isRequired": true },
  { "label": "下单时间", "key": "orderTime", "mapStr": "", "isRequired": true }
]
```

### 3.2 租户模板

租户模板结构统一为：

```json
{
  "id": "tpl_order_001",
  "name": "饮品订单模板",
  "isDefault": true,
  "updatedAt": "2026-04-15T09:00:00.000Z",
  "defaultFields": [],
  "customerFields": []
}
```

其中：

- `defaultFields` 固定 6 项，租户只填写 `mapStr`
- `customerFields` 结构与默认字段一致
- 自定义字段 key 由服务端生成：`customerKey1...N`
- 所有自定义字段 `isRequired=false`

### 3.3 标准订单对象

前端在预检前必须把 Excel 数据回填成标准订单结构：

```json
{
  "sourceOrderNo": "SO-20260415-001",
  "groupKey": "SO-20260415-001",
  "customer": "深圳华强贸易",
  "skuName": "农夫山泉550ml",
  "lineAmount": 24,
  "totalAmount": 48,
  "orderTime": "2026-04-15 09:30:00",
  "customerValues": {
    "customerKey1": "MD001",
    "customerKey2": "张三"
  },
  "lineItems": [
    {
      "skuName": "农夫山泉550ml",
      "skuSpec": "24瓶/箱",
      "unit": "箱",
      "quantity": 2,
      "unitPrice": 24,
      "lineAmount": 48
    }
  ]
}
```

说明：

- `lineItems` 可以为空数组
- `customerValues` 的 key 必须来自模板中的 `customerFields[].key`
- 后端不再负责从 Excel 原始列头推导这些字段
- `groupKey` 是辅助分组/防重键；未显式提供时通常回退为 `sourceOrderNo`
- `mappingTemplateId` 会在预检结果和订单资源中回传，表示订单关联的映射模板
- `qrCodeToken` 会在正式导入成功后的订单资源中回传，表示跳转 H5 支付页的订单令牌

### 3.4 `previewId`

`previewId` 是预检成功后生成的批次凭证：

- 由 `POST /import/preview` 返回
- 是 `POST /orders/import` 的唯一入参核心
- 一次性消费，成功创建正式导入任务后失效

### 3.5 `jobId`

`jobId` 是正式导入任务的唯一标识：

- 由 `POST /orders/import` 返回
- 用于 `GET /orders/import/jobs/{jobId}` 轮询进度
- 正式导入阶段才进入 `import-worker`

## 四、完整业务流程

### 4.1 业务步骤

1. 前端先请求 `GET /import/default-template`
2. 用户读取已有模板或新建模板
3. 前端使用 SheetJS 解析 Excel
4. 前端根据模板把 Excel 内容回填成标准订单数组 `orders[]`
5. 前端调用 `POST /import/preview`
6. 后端同步返回 `previewId` 和预检结果
7. 用户确认后，前端调用 `POST /orders/import`
8. 后端返回 `jobId`，并把任务交给 `import-worker`
9. 前端轮询 `GET /orders/import/jobs/{jobId}`
10. 任务完成后，前端调用 `GET /orders` / `GET /orders/{id}` 查看结果

### 4.2 前端交互建议

推荐交互不是“两个机械按钮”，而是一个主按钮，内部两阶段：

1. 用户点击“开始导入”
2. 前端先自动调用 `/import/preview`
3. 如果存在 `invalidOrders`，直接展示错误并阻止后续上传
4. 如果预检通过，弹出摘要确认框
5. 用户确认后，再调用 `/orders/import`

推荐确认文案：

> 共 2 张订单，重复 0 张，错误 0 条。是否按当前模板正式导入？

## 五、为什么预检不用 worker

本轮明确采用以下分工：

- 预检：同步执行
- 正式导入：异步执行，由 `import-worker` 处理

原因：

1. 预检的目标是快速反馈，不适合再走一套任务轮询
2. 正式导入涉及落库、幂等、冲突处理，更适合异步任务
3. 前端已经负责 Excel 解析和模板回填，后端预检负担明显下降

因此当前链路的工程判断是：

- `/import/preview` 不进入 worker
- `/orders/import` 才进入 worker

如果未来单次导入量大到同步预检无法接受，再讨论异步预检任务化。

## 六、接口推演

本节按真实联调顺序写每个接口的调用时机、入参和出参示例。

### 6.1 `GET /import/default-template`

**调用时机**

- 用户进入模板配置页
- 用户准备新建模板

**调用目的**

- 获取系统固定的 6 个默认字段

**请求**

```http
GET /import/default-template
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "label": "源订单号", "key": "sourceOrderNo", "mapStr": "", "isRequired": true },
    { "label": "客户名称", "key": "customer", "mapStr": "", "isRequired": true },
    { "label": "商品名称", "key": "skuName", "mapStr": "", "isRequired": true },
    { "label": "行金额", "key": "lineAmount", "mapStr": "", "isRequired": true },
    { "label": "总金额", "key": "totalAmount", "mapStr": "", "isRequired": true },
    { "label": "下单时间", "key": "orderTime", "mapStr": "", "isRequired": true }
  ]
}
```

**前端动作**

- 渲染默认字段表单
- 要求用户填写每一项的 `mapStr`

### 6.2 `GET /import/templates`

**调用时机**

- 用户进入模板列表页
- 用户选择已有模板进行导入

**调用目的**

- 获取当前租户已有模板

**请求**

```http
GET /import/templates
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "tpl_order_001",
      "name": "饮品订单模板",
      "isDefault": true,
      "updatedAt": "2026-04-15T09:00:00.000Z",
      "defaultFields": [
        { "label": "源订单号", "key": "sourceOrderNo", "mapStr": "单据号", "isRequired": true },
        { "label": "客户名称", "key": "customer", "mapStr": "客户名称", "isRequired": true },
        { "label": "商品名称", "key": "skuName", "mapStr": "商品名称", "isRequired": true },
        { "label": "行金额", "key": "lineAmount", "mapStr": "行金额", "isRequired": true },
        { "label": "总金额", "key": "totalAmount", "mapStr": "订单总金额", "isRequired": true },
        { "label": "下单时间", "key": "orderTime", "mapStr": "下单时间", "isRequired": true }
      ],
      "customerFields": [
        { "label": "门店编码", "key": "customerKey1", "mapStr": "门店编码", "isRequired": false },
        { "label": "业务员", "key": "customerKey2", "mapStr": "业务员", "isRequired": false }
      ]
    }
  ]
}
```

**前端动作**

- 支持用户选模板
- 或把模板数据回填到编辑页

### 6.3 `POST /import/templates`

**调用时机**

- 用户新建一个模板并保存

**调用目的**

- 创建租户模板

**请求**

```http
POST /import/templates
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "name": "饮品订单模板",
  "isDefault": true,
  "defaultFields": [
    { "label": "源订单号", "key": "sourceOrderNo", "mapStr": "单据号", "isRequired": true },
    { "label": "客户名称", "key": "customer", "mapStr": "客户名称", "isRequired": true },
    { "label": "商品名称", "key": "skuName", "mapStr": "商品名称", "isRequired": true },
    { "label": "行金额", "key": "lineAmount", "mapStr": "行金额", "isRequired": true },
    { "label": "总金额", "key": "totalAmount", "mapStr": "订单总金额", "isRequired": true },
    { "label": "下单时间", "key": "orderTime", "mapStr": "下单时间", "isRequired": true }
  ],
  "customerFields": [
    { "label": "门店编码", "mapStr": "门店编码" },
    { "label": "业务员", "mapStr": "业务员" }
  ]
}
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "tpl_order_001",
    "name": "饮品订单模板",
    "isDefault": true,
    "updatedAt": "2026-04-15T09:00:00.000Z",
    "defaultFields": [
      { "label": "源订单号", "key": "sourceOrderNo", "mapStr": "单据号", "isRequired": true },
      { "label": "客户名称", "key": "customer", "mapStr": "客户名称", "isRequired": true },
      { "label": "商品名称", "key": "skuName", "mapStr": "商品名称", "isRequired": true },
      { "label": "行金额", "key": "lineAmount", "mapStr": "行金额", "isRequired": true },
      { "label": "总金额", "key": "totalAmount", "mapStr": "订单总金额", "isRequired": true },
      { "label": "下单时间", "key": "orderTime", "mapStr": "下单时间", "isRequired": true }
    ],
    "customerFields": [
      { "label": "门店编码", "key": "customerKey1", "mapStr": "门店编码", "isRequired": false },
      { "label": "业务员", "key": "customerKey2", "mapStr": "业务员", "isRequired": false }
    ]
  }
}
```

**关键点**

- 前端不传 `customerFields[].key`
- 服务端负责生成 `customerKey1`、`customerKey2`
- 服务端统一回填 `isRequired=false`

### 6.4 `PUT /import/templates/{id}`

**调用时机**

- 用户编辑已有模板并保存

**调用目的**

- 更新模板结构

**请求**

```http
PUT /import/templates/tpl_order_001
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "name": "饮品订单模板-v2",
  "isDefault": true,
  "defaultFields": [
    { "label": "源订单号", "key": "sourceOrderNo", "mapStr": "单据号", "isRequired": true },
    { "label": "客户名称", "key": "customer", "mapStr": "客户名称", "isRequired": true },
    { "label": "商品名称", "key": "skuName", "mapStr": "品名", "isRequired": true },
    { "label": "行金额", "key": "lineAmount", "mapStr": "明细金额", "isRequired": true },
    { "label": "总金额", "key": "totalAmount", "mapStr": "订单总金额", "isRequired": true },
    { "label": "下单时间", "key": "orderTime", "mapStr": "单据时间", "isRequired": true }
  ],
  "customerFields": [
    { "label": "门店编码", "mapStr": "门店编码" },
    { "label": "业务员", "mapStr": "业务员" },
    { "label": "配送区域", "mapStr": "配送区域" }
  ]
}
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "tpl_order_001",
    "name": "饮品订单模板-v2",
    "isDefault": true,
    "updatedAt": "2026-04-15T10:00:00.000Z",
    "defaultFields": [
      { "label": "源订单号", "key": "sourceOrderNo", "mapStr": "单据号", "isRequired": true },
      { "label": "客户名称", "key": "customer", "mapStr": "客户名称", "isRequired": true },
      { "label": "商品名称", "key": "skuName", "mapStr": "品名", "isRequired": true },
      { "label": "行金额", "key": "lineAmount", "mapStr": "明细金额", "isRequired": true },
      { "label": "总金额", "key": "totalAmount", "mapStr": "订单总金额", "isRequired": true },
      { "label": "下单时间", "key": "orderTime", "mapStr": "单据时间", "isRequired": true }
    ],
    "customerFields": [
      { "label": "门店编码", "key": "customerKey1", "mapStr": "门店编码", "isRequired": false },
      { "label": "业务员", "key": "customerKey2", "mapStr": "业务员", "isRequired": false },
      { "label": "配送区域", "key": "customerKey3", "mapStr": "配送区域", "isRequired": false }
    ]
  }
}
```

**关键点**

- 更新时按当前提交内容整体替换模板
- 自定义字段 key 重新按当前顺序编号

### 6.5 `POST /import/preview`

**调用时机**

- 用户在导入页点击“开始导入”
- 前端已经解析 Excel，并根据模板回填出标准订单数组

**调用目的**

- 做订单级预检
- 生成 `previewId`
- 返回重复、错误、规范化后的订单结果

**请求**

```http
POST /import/preview
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "templateId": "tpl_order_001",
  "orders": [
    {
      "sourceOrderNo": "SO-20260415-001",
      "groupKey": "SO-20260415-001",
      "customer": "深圳华强贸易",
      "skuName": "农夫山泉550ml",
      "lineAmount": 24,
      "totalAmount": 48,
      "orderTime": "2026-04-15 09:30:00",
      "customerValues": {
        "customerKey1": "MD001",
        "customerKey2": "张三"
      },
      "lineItems": [
        {
          "skuName": "农夫山泉550ml",
          "skuSpec": "24瓶/箱",
          "unit": "箱",
          "quantity": 2,
          "unitPrice": 24,
          "lineAmount": 48
        }
      ]
    },
    {
      "sourceOrderNo": "SO-20260415-002",
      "customer": "广州天河分销",
      "skuName": "可乐330ml",
      "lineAmount": 30,
      "totalAmount": 90,
      "orderTime": "2026-04-15 09:45:00",
      "customerValues": {
        "customerKey1": "MD002",
        "customerKey2": "李四"
      },
      "lineItems": []
    }
  ]
}
```

**成功响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "previewId": "preview_20260415_001",
    "templateId": "tpl_order_001",
    "summary": {
      "totalOrders": 2,
      "validOrders": 2,
      "invalidOrders": 0,
      "duplicateOrderCount": 0,
      "errorCount": 0
    },
    "orders": [
      {
        "sourceOrderNo": "SO-20260415-001",
        "groupKey": "SO-20260415-001",
        "customer": "深圳华强贸易",
        "skuName": "农夫山泉550ml",
        "lineAmount": 24,
        "totalAmount": 48,
        "orderTime": "2026-04-15T09:30:00.000Z",
        "mappingTemplateId": "tpl_order_001",
        "customerValues": {
          "customerKey1": "MD001",
          "customerKey2": "张三"
        },
        "lineItems": [
          {
            "skuName": "农夫山泉550ml",
            "skuSpec": "24瓶/箱",
            "unit": "箱",
            "quantity": 2,
            "unitPrice": 24,
            "lineAmount": 48
          }
        ]
      },
      {
        "sourceOrderNo": "SO-20260415-002",
        "groupKey": "SO-20260415-002",
        "customer": "广州天河分销",
        "skuName": "可乐330ml",
        "lineAmount": 30,
        "totalAmount": 90,
        "orderTime": "2026-04-15T09:45:00.000Z",
        "mappingTemplateId": "tpl_order_001",
        "customerValues": {
          "customerKey1": "MD002",
          "customerKey2": "李四"
        },
        "lineItems": []
      }
    ],
    "duplicateOrders": [],
    "invalidOrders": []
  }
}
```

**失败响应示例**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "previewId": "preview_20260415_002",
    "templateId": "tpl_order_001",
    "summary": {
      "totalOrders": 1,
      "validOrders": 0,
      "invalidOrders": 1,
      "duplicateOrderCount": 0,
      "errorCount": 1
    },
    "orders": [],
    "duplicateOrders": [],
    "invalidOrders": [
      {
        "index": 1,
        "sourceOrderNo": "SO-20260415-003",
        "field": "totalAmount",
        "reason": "总金额不能为空"
      }
    ]
  }
}
```

**前端动作**

- 如果 `invalidOrders.length > 0`，直接展示错误，不调用正式导入
- 如果 `invalidOrders.length === 0`，弹出摘要确认框

### 6.6 `POST /orders/import`

**调用时机**

- 预检成功
- 用户确认正式导入

**调用目的**

- 消费 `previewId`
- 创建正式导入任务
- 返回 `jobId`

**请求**

```http
POST /orders/import
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "previewId": "preview_20260415_001",
  "conflictPolicy": "skip"
}
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "jobId": "job_20260415_001",
    "previewId": "preview_20260415_001",
    "submittedCount": 2,
    "status": "pending"
  }
}
```

**关键点**

- 这里不再传 `orders`
- 这里不再传 `rows`
- 这里不再传 `templateId`
- `previewId` 一次性消费

**重复提交示例**

如果同一个 `previewId` 已被消费，服务端应返回明确错误，前端不应继续重复触发。

### 6.7 `GET /orders/import/jobs/{jobId}`

**调用时机**

- 正式导入任务创建后

**调用目的**

- 轮询导入任务进度

**请求**

```http
GET /orders/import/jobs/job_20260415_001
Authorization: Bearer <access_token>
```

**处理中响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "jobId": "job_20260415_001",
    "previewId": "preview_20260415_001",
    "status": "processing",
    "submittedCount": 2,
    "processedCount": 1,
    "successCount": 1,
    "skippedCount": 0,
    "overwrittenCount": 0,
    "failedCount": 0,
    "failedOrders": [],
    "conflictDetails": []
  }
}
```

**完成响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "jobId": "job_20260415_001",
    "previewId": "preview_20260415_001",
    "status": "completed",
    "submittedCount": 2,
    "processedCount": 2,
    "successCount": 2,
    "skippedCount": 0,
    "overwrittenCount": 0,
    "failedCount": 0,
    "failedOrders": [],
    "conflictDetails": [],
    "completedAt": "2026-04-15T10:05:00.000Z"
  }
}
```

**前端动作**

- `status=pending/processing` 继续轮询
- `status=completed/failed` 停止轮询
- 完成后跳转订单列表或刷新订单列表

### 6.8 `GET /orders`

**调用时机**

- 导入完成后回到订单列表
- 用户按模板、状态、时间范围查看结果

**调用目的**

- 查看导入成功后的订单主信息

**请求**

```http
GET /orders?page=1&pageSize=20&templateId=tpl_order_001&dateFrom=2026-04-15&dateTo=2026-04-15
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": "ord_001",
        "sourceOrderNo": "SO-20260415-001",
        "groupKey": "SO-20260415-001",
        "customer": "深圳华强贸易",
        "skuName": "农夫山泉550ml",
        "lineAmount": 24,
        "totalAmount": 48,
        "orderTime": "2026-04-15T09:30:00.000Z",
        "customerValues": {
          "customerKey1": "MD001",
          "customerKey2": "张三"
        },
        "paid": 0,
        "status": "pending",
        "payType": "cash",
        "prints": 0,
        "mappingTemplateId": "tpl_order_001",
        "qrCodeToken": "qr_001",
        "voided": false
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### 6.9 `GET /orders/{id}`

**调用时机**

- 用户在订单列表点击某张订单

**调用目的**

- 查看完整订单详情

**请求**

```http
GET /orders/ord_001
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "ord_001",
    "sourceOrderNo": "SO-20260415-001",
    "groupKey": "SO-20260415-001",
    "customer": "深圳华强贸易",
    "skuName": "农夫山泉550ml",
    "lineAmount": 24,
    "totalAmount": 48,
    "orderTime": "2026-04-15T09:30:00.000Z",
    "customerValues": {
      "customerKey1": "MD001",
      "customerKey2": "张三"
    },
    "lineItems": [
      {
        "itemId": "item_001",
        "skuName": "农夫山泉550ml",
        "skuSpec": "24瓶/箱",
        "unit": "箱",
        "quantity": 2,
        "unitPrice": 24,
        "lineAmount": 48
      }
    ],
    "paid": 0,
    "status": "pending",
    "payType": "cash",
    "prints": 0,
    "mappingTemplateId": "tpl_order_001",
    "qrCodeToken": "qr_001",
    "voided": false
  }
}
```

## 七、给前端和 AI 的使用建议

### 7.1 给前端同学

- 不要把 Excel 原始行直接提交给 `/import/preview`
- 必须先用模板把数据回填成 `orders[]`
- 推荐一个主按钮“开始导入”，内部自动先调 `/import/preview`
- 预检失败时只展示 `invalidOrders`
- 预检成功时再展示确认框，用户确认后才调 `/orders/import`

### 7.2 订单列表页字段建议

订单列表页建议采用“固定主列 + 动态模板列 + 操作列”的结构。

**固定主列**

- `sourceOrderNo`
- `groupKey`
- `customer`
- `skuName`
- `lineAmount`
- `totalAmount`
- `orderTime`
- `paid`
- `status`
- `payType`
- `prints`

**动态模板列**

- 从当前模板的 `customerFields` 中按顺序展开
- 列标题使用 `customerFields[].label`
- 列值从 `customerValues[customerKeyN]` 读取

示例：

- 模板字段：
  - `customerKey1 -> 门店编码`
  - `customerKey2 -> 业务员`
- 列表列：
  - `门店编码`
  - `业务员`

**建议作为次级信息或筛选项的字段**

- `mappingTemplateId`
- `voided`
- `voidReason`

说明：

- `mappingTemplateId` 更适合作为筛选条件和详情补充信息，不建议默认占据主列
- `voided` 和 `voidReason` 可组合成“作废状态”展示
- `qrCodeToken` 不建议直接把原始 token 当作表格列展示

**依赖 `qrCodeToken` 的操作建议**

- `打开支付页`
- `复制支付链接`

前端可基于：

```text
/pay/:qrCodeToken
```

生成跳转链接，而不是把 token 原样展示给用户。

**不建议在列表页直接展开的字段**

- `lineItems`

原因：

- 明细数组会显著增加列表宽度和渲染复杂度
- `lineItems` 更适合放在 `GET /orders/{id}` 的详情页展示

**推荐筛选项**

- `keyword`
- `status`
- `payType`
- `templateId`
- `dateFrom`
- `dateTo`

其中 `keyword` 建议覆盖：

- `sourceOrderNo`
- `groupKey`
- `customer`
- `skuName`

**推荐行级操作**

- `查看详情`
- `打开支付页`
- `复制支付链接`
- `打印`
- `催款`
- `作废`

### 7.3 给 AI 的提示词

如果要让 AI 生成导入页逻辑，建议直接把这些约束一起给它：

```text
请基于以下规则生成订单导入页面逻辑：
1. 先请求 GET /import/default-template 和 GET /import/templates
2. 前端使用 Excel 解析结果 + 模板，把数据回填成标准 orders 数组
3. 调用 POST /import/preview，入参必须是 { templateId, orders }
4. 如果 invalidOrders.length > 0，直接展示错误，不允许上传
5. 如果预检通过，用户确认后再调用 POST /orders/import，入参只能是 { previewId, conflictPolicy }
6. 正式导入成功后拿到 jobId，轮询 GET /orders/import/jobs/{jobId}
7. 任务完成后刷新 GET /orders
```

## 八、迁移说明

以下旧口径退出主链路：

- 旧模板三段式：
  - `sourceColumns`
  - `fields`
  - `mappings`
- 旧预检入参：
  - `{ templateId?, rows }`
- 旧正式导入入参：
  - `{ previewId?, templateId?, conflictPolicy?, rows? }`
- 旧订单主字段：
  - `amount`
  - `date`
  - `summary`
  - `customFieldValues`

新的主链路统一使用：

- `totalAmount`
- `orderTime`
- `skuName`
- `customerValues`
- `previewId`
- `jobId`

## 九、当前结论

当前订单导入主链路采用以下固定设计：

1. 预检同步、正式导入异步
2. 模板统一为 `defaultFields + customerFields`
3. 前端负责 Excel 解析和模板回填
4. `previewId` 是正式导入唯一凭证
5. `jobId` 是导入任务唯一凭证
6. 订单列表与详情按新订单字段口径返回
