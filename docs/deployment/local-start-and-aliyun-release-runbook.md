# 本地自启与阿里云发布手册

> 日期：2026-04-11
> 适用范围：本地开发环境自启、联调前准备、阿里云服务器发布参考
> 当前阶段：文档先行后的第一版可运行手册

## 一、手册目标

本手册用于解决 3 个问题：

1. 本地环境如何稳定自启，不再靠临时口头命令
2. 后端完整链如何在本地自检
3. 当前代码发布到阿里云前，需要注意哪些前置条件和已踩过的问题

## 二、当前已验证可用的启动方式

截至当前，下面 4 种启动方式已经在项目内被验证可用：

1. 本地开发态 API

```powershell
pnpm run dev:api
```

2. 本地开发态 API + watch

```powershell
pnpm run dev
```

3. 本地或服务器独立导入 Worker

```powershell
pnpm run dev:worker
pnpm -F api start:import-worker
```

4. 构建产物直启 API

```powershell
pnpm -F api start:prod
```

说明：

- `apps/api` 现已统一通过 `apps/api/.env` 加载环境变量，不再依赖本地脚本硬编码。
- 完整业务链路如果包含正式导入，必须同时存在 `API + import-worker` 两个进程。
- `import-worker` 是后台消费进程，不额外监听 HTTP 端口，也不需要单独域名。

## 三、当前最小运行依赖

本项目当前 API 运行至少依赖以下条件：

1. PostgreSQL 可连接
2. Redis 可连接
3. `JWT_SECRET` 已配置
4. `apps/api/.env` 已按 `apps/api/.env.example` 完成填充
5. `@shou/types` 已构建为运行时产物
6. `apps/api/dist` 已构建完成

本地默认口径：

- PostgreSQL：`localhost:5432`
- Redis：`localhost:6379`
- API：`localhost:3000`

## 四、本地首次启动顺序

如果本地数据库仍残留旧 MVP 表结构，建议按以下顺序执行：

1. 构建共享类型包

```powershell
pnpm -F @shou/types build
```

2. 重建本地联调库 schema

```powershell
pnpm -F api exec prisma db push --force-reset
```

说明：

- 该命令会清空当前 `.env` 指向的本地数据库 schema
- 只适用于你确认可以删除本机开发库的场景
- 不适用于生产环境

3. 构建 API

```powershell
pnpm -F api build
```

4. 运行最小 smoke

```powershell
pnpm -F api test:smoke
```

5. 运行完整后端链回归

```powershell
pnpm -F api test:backend-regression
```

## 五、本地日常自启顺序

如果本地数据库已经是当前 schema，不需要每次重建，可按以下顺序：

推荐直接使用新的根脚本：

```powershell
pnpm run dev:api
```

如果需要同时开启 `@shou/types` 的 watch 构建和 API watch：

```powershell
pnpm run dev
```

如果需要单独起导入 Worker：

```powershell
pnpm run dev:worker
```

若不用一键脚本，也可按以下顺序手工执行：

1. 构建共享类型包

```powershell
pnpm -F @shou/types build
```

2. 构建 API

```powershell
pnpm -F api build
```

3. 启动 Web API

```powershell
pnpm -F api start:prod
```

4. 启动导入 Worker

```powershell
pnpm -F api start:import-worker
```

说明：

- 当前导入正式任务建议由独立 Worker 进程消费
- 如果只启动 API，不启动 Worker，导入任务会停留在 `pending`

## 六、本地联调前自检命令

建议固定为以下 3 条：

```powershell
pnpm -F @shou/types build
pnpm -F api test:smoke
pnpm -F api test:backend-regression
```

也可以直接执行：

```powershell
pnpm run check:backend
```

含义：

1. `@shou/types build`
   保证运行时不再引用 `src/*.ts` 导出
2. `test:smoke`
   保证导入、订单、支付核心规则没回归
3. `test:backend-regression`
   保证完整后端主链路仍可跑通

## 七、环境变量建议

本地至少需要：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shou_db?schema=public
JWT_SECRET=<本地固定密钥>
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:5001,http://localhost:5002,http://localhost:5003
```

补充建议：

```env
AUTH_COOKIE_SECURE=false
IMPORT_JOB_WORKER_ENABLED=false
```

说明：

- 本地 HTTP 环境建议显式关闭 secure cookie
- API 进程默认建议保持 `IMPORT_JOB_WORKER_ENABLED=false`
- 若通过 HTTPS 反代，可按实际情况改为 `true`

## 八、本次已经踩过的关键问题

### 7.1 旧库不能直接 `prisma db push`

现象：

- 本地旧库混有旧表、旧枚举和缺表状态
- `prisma db push` 会卡在数据丢失提示或缺表错误

建议：

- 本地联调库直接 `db push --force-reset`
- 不要在旧 MVP 库上反复试探式修表

### 7.2 `@shou/types` 不能只导出源码

现象：

- `apps/api/dist` 运行时直接加载 `packages/types/src`
- Node 无法把它当成稳定运行时产物

当前处理：

- 已新增 `packages/types/tsconfig.json`
- 已新增 `pnpm -F @shou/types build`
- 包导出已改为 `dist`

结论：

- 后续只要要跑 `apps/api`，就先构建 `@shou/types`

### 7.3 导入链路依赖 Worker

现象：

- `POST /orders/import` 只创建任务
- 没有 Worker 时，任务不会自动完成

建议：

- 本地联调要么单独起 `start:import-worker`
- 要么使用 `test:backend-regression`，由 runner 进程内启用导入消费

### 7.4 Windows 环境下 Prisma 命令可能被沙箱拦截

现象：

- 在代理工具环境中，`schema-engine-windows.exe` 可能出现 `spawn EPERM`

结论：

- 这是代理执行环境问题，不是项目本身逻辑错误
- 你在本机正常 PowerShell 终端直接执行，一般不会遇到这个问题

## 九、阿里云发布前检查项

当前项目尚处于“文档先行、代码逐步重建”阶段，阿里云发布前至少检查：

1. `@shou/types` 已 build
2. `apps/api` 已 build
3. 服务器 PostgreSQL、Redis 可连通
4. `JWT_SECRET` 已替换成服务器专用密钥
5. `DATABASE_URL` 指向服务器数据库
6. `REDIS_URL` 指向服务器 Redis
7. 已确认是否需要单独部署 `import-worker`
8. 已确认服务器上的 `apps/api/.env` 与 `apps/api/.env.example` 对齐
9. 已确认启动方式是“裸进程”还是“Docker Compose”

## 十、阿里云建议发布顺序

### 10.1 方式 A：裸进程发布

这是当前最完整、最贴近本地联调成功链路的服务器启动方式。

1. 拉取最新代码
2. 安装依赖

```powershell
pnpm install
```

3. 准备 `apps/api/.env`

说明：

- 以 `apps/api/.env.example` 为模板生成服务器本地 `.env`
- 不要把生产密钥写回仓库

4. 构建共享类型包

```powershell
pnpm -F @shou/types build
```

5. 构建 API

```powershell
pnpm -F api build
```

6. 同步数据库 schema

```powershell
pnpm -F api prisma:push
```

7. 启动 API

```powershell
pnpm -F api start:prod
```

8. 启动导入 Worker

```powershell
pnpm -F api start:import-worker
```

说明：

- 如果你希望完整支持导入正式提交，这个 Worker 不能省略。
- 生产环境建议由 `pm2`、`systemd` 或其他进程守护工具分别托管这两个进程。

### 10.2 方式 B：Docker Compose 发布

当前仓库里的 `docker-compose.yml` 可以直接拉起：

1. `db`
2. `redis`
3. `api`
4. `import-worker`
5. `nginx`

命令：

```powershell
docker compose up -d --build
```

但必须明确：

- 当前 `import-worker` 已作为独立容器纳入 compose。
- 它负责轮询并消费正式导入任务，但不对外暴露 HTTP 端口。
- 因此不需要为 Worker 额外配置公网端口、二级域名或 Nginx 转发。

### 10.3 当前建议结论

当前更推荐的阿里云启动方式是：

1. 如果你要长期统一运维，优先使用“方式 B：Docker Compose 发布”，统一托管 `api + import-worker + db + redis + nginx`。
2. 如果你当前只想做最小改动，也仍可使用“方式 A：裸进程发布”，但它不再是长期首选。

当前建议顺序：

1. 拉取最新代码
2. 安装依赖

```powershell
pnpm install
```

3. 构建共享类型包

```powershell
pnpm -F @shou/types build
```

4. 构建 API

```powershell
pnpm -F api build
```

5. 启动 Docker Compose

```powershell
docker compose up -d --build
```

说明：

- 当前 compose 中 `api` 与 `import-worker` 启动前都会执行 `prisma db push --skip-generate`
- 生产环境禁止使用 `--force-reset`

6. 查看运行状态

```powershell
docker compose ps
```

7. 查看关键日志

```powershell
docker compose logs -f api
docker compose logs -f import-worker
```

## 十一、发布前后建议执行的验证

发布前建议：

```powershell
pnpm -F api test:smoke
pnpm -F api test:backend-regression
```

发布后建议至少手工验证：

1. 登录
2. 获取通用配置
3. 获取打印配置列表
4. 导入预检
5. 正式导入任务能完成
6. H5 支付详情能正常打开
7. 现金登记和核销能闭环
8. 打印回执能成功且幂等

## 十二、当前结论

截至本手册生成时，项目已经具备：

1. 本地数据库重建方案
2. `@shou/types` 运行时构建方案
3. `smoke + backend-regression` 两级自检
4. API 与导入 Worker 的分进程启动基线

你以后本地自启和服务器发布，优先按这份手册执行，不要再回到“直接跑 API 看运气”的方式。
