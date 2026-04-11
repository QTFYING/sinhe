# 经销商订单收款平台

本仓库是一个基于 `Turborepo` 与 `pnpm workspace` 组织的后端单仓项目，当前核心应用为 `apps/api`。

## 当前状态

项目目前已完成首轮后端落地，当前处于“按稳定契约持续迭代、联调补强与技术债收口”的阶段。

当前应以以下内容作为事实源和执行依据：

1. `docs/api/*.md`
2. `packages/types/src/enums`
3. `packages/types/src/contracts`
4. `docs/prisma/data-model-reference.md`
5. `design/api-implementation-plan.md`
6. `design/api-technical-debt.md`
7. `design/api-regression-checklist.md`

说明：

1. `apps/api` 中仍有少量早期 MVP 残留代码，仅可作为历史实现参考。
2. 主链路接口、枚举、contracts 与数据模型已经形成当前稳定基线。
3. Swagger 是联调产物，不是设计源。

## 技术栈

- 后端框架：NestJS 10
- ORM：Prisma
- 数据库：PostgreSQL
- 缓存与会话：Redis
- 接口文档：Swagger
- 工作区管理：pnpm workspace
- 构建编排：Turborepo

## 目录结构

```text
.
├── AGENTS.md                         # 代理执行规则
├── apps/
│   └── api/                          # NestJS 后端服务
├── design/                           # 活文档与归档设计手册
├── docs/                             # API、枚举、数据模型等正式文档
├── packages/
│   ├── types/                        # 共享枚举与 contracts
│   └── utils/                        # 共享工具
├── review/                           # 评审记录与阶段说明
├── scripts/                          # 数据初始化脚本
├── package.json                      # 根脚本
├── pnpm-workspace.yaml               # 工作区定义
└── turbo.json                        # Turborepo 任务编排
```

## 环境要求

- Node.js `>= 22.0.0`
- pnpm `>= 9.0.0`
- PostgreSQL
- Redis
- Docker 可选

## 本地启动

### 1. 安装依赖

```powershell
pnpm install
```

### 2. 启动 PostgreSQL 与 Redis

推荐使用 Docker：

```powershell
docker-compose up -d
```

如果不使用 Docker，也可以本机自行安装 PostgreSQL 与 Redis，并确保连接信息与 `apps/api/.env` 保持一致。

### 3. 推送 Prisma schema 并生成客户端

```powershell
pnpm --filter api prisma:push
pnpm --filter api prisma:generate
```

### 4. 初始化测试数据

```powershell
pnpm db:seed
```

默认会创建以下测试账号：

- OS 管理员：`admin` / `123456`
- 租户老板：`boss` / `123456`

### 5. 启动开发服务

```powershell
pnpm run dev
```

默认地址：

- API：`http://localhost:3000`
- Swagger：`http://localhost:3000/api/docs`

## 常用命令

### 根目录

```powershell
pnpm run dev
pnpm run build
pnpm run lint
pnpm run format
pnpm db:seed
pnpm db:init
```

### API 应用

```powershell
pnpm --filter api dev
pnpm --filter api build
pnpm --filter api start:debug
pnpm --filter api prisma:push
pnpm --filter api prisma:generate
```

## 环境变量

主要使用 `apps/api/.env`：

```env
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
CORS_ORIGINS=
PORT=
NODE_ENV=
AUTH_COOKIE_SECURE=
IMPORT_JOB_WORKER_ENABLED=
LAKALA_CASHIER_URL_PREFIX=
```

建议以 `apps/api/.env.example` 作为本地配置模板。

生产初始化脚本 `pnpm db:init` 还会读取以下变量：

```env
INIT_OS_ADMIN_USERNAME=
INIT_OS_ADMIN_PASSWORD=
INIT_OS_ADMIN_REAL_NAME=
INIT_TENANT_NAME=
INIT_TENANT_CONTACT_PHONE=
INIT_TENANT_OWNER_USERNAME=
INIT_TENANT_OWNER_PASSWORD=
INIT_TENANT_OWNER_REAL_NAME=
INIT_TENANT_MAX_CREDIT_DAYS=
INIT_TENANT_CREDIT_REMINDER_DAYS=
```

## 核心文档入口

### 业务与接口

- `docs/api/api-architecture-overview.md`
- `docs/api/admin-api-doc.md`
- `docs/api/tenant-api-doc.md`
- `docs/api/h5-api-doc.md`

### 枚举与类型

- `docs/enums/enum-manual.md`
- `packages/types/src/enums`
- `packages/types/src/contracts`

### 数据模型

- `docs/prisma/data-model-reference.md`
- `apps/api/prisma/schema.prisma`

### 执行手册

- `design/api-implementation-plan.md`
- `design/api-technical-debt.md`
- `design/api-regression-checklist.md`

### 历史归档

- 若后续再次产生阶段性过程文档，统一放入 `design/archived/`

## 阅读顺序

建议按以下顺序阅读本仓库：

1. `README.md`
2. `AGENTS.md`
3. `docs/api/api-architecture-overview.md`
4. `docs/api/*.md`
5. `docs/enums/enum-manual.md`
6. `docs/prisma/data-model-reference.md`
7. `design/api-implementation-plan.md`
8. `design/api-technical-debt.md`
9. `design/api-regression-checklist.md`

## 开发约束

1. 先看文档，再看旧代码。
2. 不让 Swagger 反向定义接口。
3. 不恢复已废弃的旧语义，例如 `/print/jobs`、`erpOrderNo`、`templateId`、`customFields`、旧 `payStatus` 主流程。
4. `docs/api` 定业务结构，`enums` 定闭集值，`contracts` 跟随投影，`data-model-reference` 做建模同步。

更严格的代理执行规则见 [AGENTS.md](/D:/Sinhe/api/AGENTS.md)。

