# 经销商订单收款平台 (SaaS Monorepo)

本项目采用 `Turborepo` + `pnpm workspace` 搭建，包含一个基于 NestJS 的服务 API，以及三个前端应用（React/Preact）。

## 架构说明

- `apps/api`: NestJS + Prisma + PostgreSQL + Redis (后端核心)
- `apps/tenant`: 经销商 SaaS工作台 (React 18 + Vite + Antd 5 + Zustand + TanStack Query)
- `apps/admin`: OS运营管理台 (React 18 + Vite)
- `apps/pay-h5`: C端收银台 (Preact + Vite，极速四态流转)
- `packages/shared-*`: 共享的枚举约束、计算工具和 UI 组件库

## 本地启动指南

请在项目根目录（`d:\Sinhe\api`）依次执行以下 4 个步骤，即可一键跑通所有端。

### 1. 安装全局依赖

进入根目录，使用 `pnpm` 安装并链接所有工作区依赖：
```powershell
pnpm install
```
*(提示：如安装后遇到 Prisma 等包触发 ignored build scripts 警告，可按提示运行 `pnpm approve-builds` 并重新执行安装)*

### 2. 启动底层数据库引擎 (二选一)

**方案 A：使用 Docker (推荐, 适合 Mac/Linux/WSL 用户)**
确保电脑上已安装并运行 Docker Desktop，然后在后台静默启动 PostgreSQL 和 Redis 引擎：
```powershell
docker-compose up -d
```

**方案 B：无 Docker 裸机运行 (适合纯 Windows 用户)**
如果电脑无法运行 Docker/WSL，可以直接在本机安装并裸跑环境：
1. **安装 PostgreSQL**：下载 Windows 安装包。超级权限用户与密码统一配置为 `postgres`，默认端口 `5432` 保持不变。安装完成后，打开自带的 pgAdmin 新建一个名叫 `distributor_pay` 空白数据库。
2. **安装 Redis**：Windows 官方无纯净版，可下载微软的 [Memurai](https://www.memurai.com/) 或各类一键运行绿色包。双击启动即可，默认无密码，端口 `6379`。
*(注：`apps/api/.env` 文件已默认配置好适配裸机直连环境的连接串，无需任何修改)*

### 3. 生成 Prisma 客户端并推送表结构 (只要表结构更新，必须要执行，有一堆TS报错的时候，也可以试试)

将按照红线安全规范设计的多租户业务表结构一次性推送到本地 Postgres 数据库中：
```powershell
pnpm --filter api prisma:push  # 建表（将架构表完美推送到你的本地 PostgreSQL）
pnpm --filter api prisma:generate # 生成客户端，召唤 TypeScript 强类型大军（让你的 TS 编译器认识所有新字段）
```

### 4. 插入测试种子数据 (账号初始化)

首次部署时数据库为空，为方便立即体验，请运行注水脚本：
```powershell
node apps/api/prisma/seed.js
```
该命令会自动生成以下真实可用的测试环境：

**👑 OS 运营上帝视角账号**
- **账号**：`admin` / **密码**：`123456`
- **角色**：`OS_SUPER_ADMIN` (无租户限制，拥有全局视野)

**🏢 测试 SaaS 经销商老板账号**
- **所属租户**：自动初始化 `华东区饮料总代(测试)`
- **账号**：`boss` / **密码**：`123456`
- **角色**：`TENANT_OWNER` (最高权限管理该经销商单体所有数据)

### 5. 一键启动全栈服务 ⚡️

借助于 Turborepo 并发控制，只需一条命令即可拉起所有 4 个服务：
```powershell
pnpm run dev
```

成功后，各端服务本地监听端口如下：
- **后端 API (`api`)** -> `http://localhost:3000`
- **经销商 SaaS (`tenant`)** -> `http://localhost:5000`
- **OS 运营台 (`admin`)** -> `http://localhost:5001`
- **C端收银台 (`pay-h5`)** -> `http://localhost:5002`

您可以打开浏览器访问 [http://localhost:5000](http://localhost:5000) 用上述测试账号体验 B端全景架构，或访问 [http://localhost:5002](http://localhost:5002) 测试 C端防篡改支付。
