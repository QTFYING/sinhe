# 经销商订单收款平台

基于 `Turborepo` 与 `pnpm workspace` 的后端单仓项目，当前核心应用是 `apps/api`。

## 项目定位

当前仓库已进入稳定迭代阶段，主链路集中在：

- Admin / Tenant / H5 共用后端
- 订单录入、订单导入、支付、核销
- H5 扫码支付
- 独立 `import-worker` 导入任务处理

## 治理入口

对全局项目持续生效的约束入口只有这些：

1. `README.md`
2. `AGENTS.md`
3. `.codex/skills/*`
4. `docs/api/*.md`

涉及接口、字段、枚举、状态机、数据模型时，默认按以下顺序判断事实：

1. `docs/api/*.md`
2. `packages/types/src/enums`
3. `packages/types/src/contracts`
4. `docs/prisma/data-model-reference.md`
5. `apps/api` 实现代码
6. Swagger / OpenAPI

其中：

- `docs/api` 定义业务语义
- `enums` 定义闭集值
- `contracts` 只做结构投影
- `data-model-reference` 只做建模同步
- Swagger / OpenAPI 只是联调产物

## 非事实源

以下目录只提供背景，不作为编码依据：

- `design/`
- `notes/`
- `review/`
- `docs/archived/`

## 目录概览

```text
.
├── README.md
├── AGENTS.md
├── apps/
│   └── api/
├── docs/
│   ├── api/
│   ├── enums/
│   ├── prisma/
│   ├── deployment/
│   └── archived/
├── .codex/
│   └── skills/
├── packages/
│   ├── types/
│   └── utils/
├── scripts/
├── design/
├── notes/
└── review/
```

## 环境要求

- Node.js `>= 22.0.0`
- pnpm `>= 9.0.0`
- PostgreSQL
- Redis
- Docker 可选

## 启动模式

本仓库默认区分两种启动方式：

- 本地联调模式：前后端开发联调时使用，只启动 `db`、`redis` 容器，API 由本机 `dev` 进程启动。
- 生产环境部署模式：构建 `dist` 并通过 Docker 编排启动完整服务。

注意：

- 直接执行 `docker compose up -d` 会按 `docker-compose.yml` 启动 `api`、`import-worker`、`nginx`，其中 `api` 和 `import-worker` 都依赖 `dist` 构建产物。
- 如果你只是和前端联调，不要直接起整套 compose，应该走下面的“本地联调模式”。

## 本地联调模式

### 1. 安装依赖

```bash
pnpm install
```

### 2. 准备环境变量

```bash
cp apps/api/.env.example apps/api/.env
```

本地联调建议至少确认这些变量：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shou_db?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-local-secret
CORS_ORIGINS=http://localhost:5173
PORT=3000
NODE_ENV=development
AUTH_COOKIE_SECURE=false
IMPORT_JOB_WORKER_ENABLED=false
```

说明：

- `CORS_ORIGINS` 改成你本地前端 dev server 地址；若有多个地址，用逗号分隔。
- `AUTH_COOKIE_SECURE=false` 适用于本地 HTTP 联调。
- `IMPORT_JOB_WORKER_ENABLED=false` 表示 API 进程不直接消费导入任务。

### 3. 只启动基础设施

推荐命令：

```bash
docker compose up -d db redis
```

如你的 Docker 版本仍使用旧命令，也可以：

```bash
docker-compose up -d db redis
```

### 4. 同步 Prisma

```bash
pnpm -F api prisma:push
pnpm -F api prisma:generate
```

### 5. 初始化数据

```bash
pnpm db:seed
```

默认测试账号：

- `admin` / `123456`
- `boss` / `123456`

### 6. 启动开发态 API

```bash
pnpm dev:api
```

如果你会同时修改 `packages/types`，推荐改用：

```bash
pnpm dev
```

默认地址：

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api/docs`

补充：

- 本地联调前端时，通常只需要 `pnpm dev:api`。
- 若要验证独立导入 Worker 链路，需额外准备 `dist` 后再启动 Worker，不属于最小联调路径。

## 生产环境部署模式

适用于需要通过 Docker 编排启动完整服务的场景。

### 1. 安装依赖并准备环境变量

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
```

### 2. 同步 Prisma 与初始化数据

```bash
pnpm -F api prisma:push
pnpm -F api prisma:generate
pnpm db:seed
```

### 3. 构建产物

```bash
pnpm build
```

### 4. 启动完整服务

```bash
docker compose up -d
```

该模式会启动：

- `db`
- `redis`
- `api`
- `import-worker`
- `nginx`

其中：

- `api` 通过 Docker 构建并以 `dist` 产物启动。
- `import-worker` 通过 `dist/import-worker.main` 启动。
- `nginx` 会挂载根目录下的 `dist/admin`、`dist/tenant`、`dist/h5`。

## 常用命令

```bash
pnpm dev
pnpm dev:api
pnpm dev:worker
pnpm build
pnpm check:backend
pnpm db:seed
pnpm db:init
pnpm -F api test:smoke
pnpm -F api test:backend-regression
```

## 环境变量

模板文件：`apps/api/.env.example`

常用变量：

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

## 阅读顺序

1. `README.md`
2. `AGENTS.md`
3. `docs/api/api-architecture-overview.md`
4. 对应业务域的 `docs/api/*.md`
5. `packages/types/src/enums`
6. `packages/types/src/contracts`
7. `docs/prisma/data-model-reference.md`
8. 对应 `apps/api/src/*`

## 关键文档

- `docs/api/api-architecture-overview.md`
- `docs/api/admin-api-doc.md`
- `docs/api/tenant-api-doc.md`
- `docs/api/h5-api-doc.md`
- `docs/enums/enum-manual.md`
- `docs/prisma/data-model-reference.md`
- `docs/deployment/env.md`
- `docs/deployment/local-start-and-aliyun-release-runbook.md`
- `docs/deployment/server_deployment.md`

## 开发约束摘要

- 先看契约，再看实现。
- 不让 Swagger 反向定义接口。
- 不恢复已废弃的旧语义，例如 `/print/jobs`、`erpOrderNo`、`templateId`、`customFields`、旧 `payStatus` 主流程。

更严格的代理约束见 `AGENTS.md`。
