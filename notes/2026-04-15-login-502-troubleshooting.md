# 2026-04-15 登录接口 502 排查记录

## 背景

前端本地开发环境在 `env=pro` 时，通过本地代理访问生产 API 域名 `https://api.shoudanba.cn`，登录接口返回 `502 Bad Gateway`。

本次排查目标：

1. 判断问题是否来自前端代理配置
2. 判断问题是否来自后端 CORS 或登录逻辑
3. 找出生产部署链路中的真实故障点

## 现象

本地前端登录请求链路如下：

1. 浏览器请求本地 `/api/auth/login`
2. 本地 Vite 代理根据 `X-Proxy-Env: pro` 转发到 `https://api.shoudanba.cn`
3. 浏览器看到 `502 Bad Gateway`

已确认前端开发态不是浏览器直接跨域访问生产 API，而是走本地代理。

## 排查过程

### 1. 先排除前端 `.env` 配置错误

确认前端代理目标已从错误的 `api.sinhe.com` 更正为：

```env
VITE_PROXY_PRO=https://api.shoudanba.cn
```

结论：

1. 域名配置错误不是当前根因
2. 问题已经收敛为“代理上游不可达”或“上游网关异常”

### 2. 先排除 DNS 问题

域名 `api.shoudanba.cn` 能解析到：

```text
47.95.31.220
```

结论：

1. 不是 DNS 解析失败

### 3. 先排除后端 CORS 根因

检查后端入口代码：

- `apps/api/src/main.ts`
- `apps/api/src/config/app.config.ts`
- `apps/api/src/config/env.validation.ts`

确认后端已启用 CORS，且生产环境通过 `CORS_ORIGINS` 做白名单限制。

结论：

1. 如果浏览器直接跨域请求生产 API，CORS 可能成为问题
2. 但当前链路是“本地代理 -> 生产 API”，CORS 不会表现成 Vite 代理层的 `502`
3. 因此当前 `502` 不是 CORS 根因

### 4. 检查仓库内生产部署拓扑

检查：

- `docker-compose.yml`
- `nginx.conf`
- `docs/deployment/server_deployment.md`

确认当前仓库默认生产拓扑为：

1. `shou-api` 容器内监听 `3000`
2. `shou-nginx` 容器对外暴露 `5001/5002/5003`
3. 三个前端站点通过 `/api/` 反代到 `api:3000`

同时确认：

1. 仓库内 `nginx.conf` 没有实现 `api.shoudanba.cn` 的独立站点
2. `api.shoudanba.cn` 的 HTTPS 入口实际由 1Panel/OpenResty 承接

### 5. 检查 1Panel/OpenResty 上游目标

用户确认 1Panel 中 `api.shoudanba.cn` 的反代目标是：

```text
http://127.0.0.1:3000
```

继续在服务器上验证：

```bash
curl -I http://127.0.0.1:3000/api/docs
```

结果：

```text
curl: (7) Failed to connect to 127.0.0.1 port 3000: Connection refused
```

同时 `docker compose ps` 显示：

```text
shou-api ... PORTS 3000/tcp
```

这说明：

1. `shou-api` 只开放了容器内部端口
2. 宿主机并没有监听 `127.0.0.1:3000`
3. 1Panel/OpenResty 反向代理到宿主机 `127.0.0.1:3000` 时，上游连接被拒绝

## 根因

生产 `502` 的真实根因是：

1. `api.shoudanba.cn` 由 1Panel/OpenResty 承接
2. OpenResty 代理到 `http://127.0.0.1:3000`
3. 但 `docker-compose.yml` 中 `api` 服务没有把 `3000` 映射到宿主机
4. 所以 OpenResty 访问宿主机 `127.0.0.1:3000` 时连接失败，并返回 `502`

这不是：

1. 前端 `.env` 问题
2. CORS 问题
3. 登录接口业务代码问题

## 修复方案

对 `docker-compose.yml` 做最小改动，为 `api` 服务增加仅宿主机可见的端口映射：

```yml
api:
  ports:
    - "127.0.0.1:3000:3000"
```

这样可以做到：

1. 让 1Panel/OpenResty 继续使用 `http://127.0.0.1:3000`
2. 仅宿主机本地可访问，不直接暴露公网
3. 不需要先改项目内 `nginx.conf`

## 上线步骤

```bash
cd /data/www/sinhe
git pull
docker compose up -d --force-recreate api
```

## 验证步骤

### 1. 服务器本机验证

```bash
curl -I http://127.0.0.1:3000/api/docs
```

### 2. 域名验证

```bash
curl -I https://api.shoudanba.cn/api/docs
```

### 3. 本地前端验证

在本地前端使用 `env=pro` 再次执行登录请求，确认不再返回 `502`。

## 结论

本次 `502` 问题的关键经验：

1. 当前生产 API 独立域名入口不在项目内 `shou-nginx`，而在 1Panel/OpenResty
2. Docker 容器内端口暴露不等于宿主机端口可访问
3. 只要宿主机 `127.0.0.1:3000` 不存在，1Panel 代理到该地址就必然返回 `502`
