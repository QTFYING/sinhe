# 经销商订单收款平台生产环境部署说明书

本文档基于当前仓库实现整理，适用于阿里云 ECS 上使用 `Docker Compose` 部署本项目的生产环境。

## 1. 部署范围

当前生产部署包含以下 4 个容器服务：

| 服务 | 容器名 | 说明 |
| --- | --- | --- |
| PostgreSQL | `shou-db` | 主业务数据库 |
| Redis | `shou-redis` | 缓存与分布式锁 |
| API | `shou-api` | NestJS 后端服务，容器内端口 `3000` |
| Nginx | `shou-nginx` | 托管三个前端并反向代理 `/api` |

对外访问入口以 `docker-compose.yml` 为准，当前端口如下：

| 端口 | 用途 | 说明 |
| --- | --- | --- |
| `5001` | OS 运营台 | Nginx 静态站点 |
| `5002` | 租户工作台 | Nginx 静态站点 |
| `5003` | C 端收款 H5 | Nginx 静态站点 |
| `5432` | PostgreSQL | 仅宿主机/内网运维使用，不对公网开放 |
| `6379` | Redis | 仅宿主机/内网运维使用，不对公网开放 |

说明：

- API 不直接对公网暴露，三个前端通过 `/api/` 反向代理到容器内 `api:3000`。
- 生产环境请以阿里云安全组限制公网入口，只放行 `22` 和实际需要的业务端口。
- 当前项目默认对外开放的是 `5001/5002/5003`，不是旧文档中的 `8001/8002/8003`。

## 2. 推荐部署拓扑

建议采用以下拓扑：

1. 阿里云 ECS 作为部署主机，项目目录统一放在 `/data/www/sinhe`。
2. Docker Compose 负责拉起 `db`、`redis`、`api`、`nginx` 四个服务。
3. 公网入口优先通过阿里云 SLB/ALB 或宿主机 Nginx 再做一层域名和 HTTPS 终止。
4. 数据库和 Redis 端口不对公网开放，只允许堡垒机、运维网段或同 VPC 访问。

如果当前阶段尚未接入域名与 HTTPS，也至少需要在阿里云安全组层面关闭 `5432`、`6379` 的公网访问。

## 3. 服务器前置要求

### 3.1 基础环境

- Linux 服务器 1 台，建议 Ubuntu 22.04 / Alibaba Cloud Linux 3。
- 已安装 `git`、`docker`、`docker compose`。
- 部署目录：`/data/www/sinhe`
- 服务器时间同步到 `Asia/Shanghai`。

### 3.2 Docker 镜像加速

如服务器访问 Docker Hub 较慢，可配置镜像加速：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 3.3 阿里云安全组建议

建议最小开放策略如下：

| 端口 | 是否开放公网 | 说明 |
| --- | --- | --- |
| `22` | 是 | SSH 运维入口，建议只允许固定 IP |
| `5001` | 按需 | OS 运营台 |
| `5002` | 按需 | 租户工作台 |
| `5003` | 按需 | 收款 H5 |
| `5432` | 否 | PostgreSQL，禁止公网开放 |
| `6379` | 否 | Redis，禁止公网开放 |

如果已接入域名反向代理，建议外部仅开放 `80/443`，宿主机内部再转发到 `5001/5002/5003`。

## 4. 生产配置约定

### 4.1 环境变量

在项目根目录创建 `.env` 文件：

```bash
cd /data/www/sinhe

cat > .env <<'EOF'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<请替换为强密码>
POSTGRES_DB=shou
JWT_SECRET=<请替换为长度至少 64 位的随机密钥>
EOF
```

生成随机密钥示例：

```bash
openssl rand -hex 32
```

说明：

- `POSTGRES_PASSWORD`、`JWT_SECRET` 必须使用生产专用值，禁止把真实密钥写入仓库文档。
- 当前 `docker-compose.yml` 会自动拼装 `DATABASE_URL`、`REDIS_URL`，无需手工填写。
- `.env` 属于服务器本地私有文件，不要提交到 Git。

### 4.2 首次上线前的敏感信息管理

以下信息不应直接出现在版本库文档中：

- 服务器 root 密码
- PostgreSQL 实际生产密码
- JWT 实际生产密钥
- 支付通道密钥、回调密钥、OSS 密钥

推荐统一保存到密码管理器、阿里云 KMS 或受控运维文档中。

## 5. 首次部署

### 5.1 拉取代码

```bash
mkdir -p /data/www
cd /data/www

git clone <你的仓库地址> sinhe
cd /data/www/sinhe
```

如果服务器上已经存在仓库，则直接进入目录：

```bash
cd /data/www/sinhe
```

### 5.2 启动生产服务

```bash
docker compose up -d --build
```

检查服务状态：

```bash
docker compose ps
docker compose logs -f api
```

说明：

- API 容器启动命令中会自动执行 `prisma db push --skip-generate`，即容器启动时会自动同步当前 Prisma 表结构到数据库。
- 这属于“直接推表”模式，不是受控 migration 发布。生产发版前必须先做数据库备份，再执行升级。

### 5.3 访问验证

若服务器公网 IP 为 `<ECS_PUBLIC_IP>`，则默认访问地址如下：

| 端口 | 地址 |
| --- | --- |
| OS 运营台 | `http://<ECS_PUBLIC_IP>:5001` |
| 租户工作台 | `http://<ECS_PUBLIC_IP>:5002` |
| C 端收款 H5 | `http://<ECS_PUBLIC_IP>:5003` |

可先在服务器本机验证：

```bash
curl -I http://127.0.0.1:5001
curl -I http://127.0.0.1:5002
curl -I http://127.0.0.1:5003
```

### 5.4 服务器重启后的自动拉起

当前仓库的 [`docker-compose.yml`](/D:/Sinhe/api/docker-compose.yml) 已为 `db`、`redis`、`api`、`nginx` 四个服务统一配置 `restart: always`，这意味着：

- 只要 Docker 守护进程在宿主机启动后自动恢复运行，这 4 个容器就会自动拉起。
- 如果你执行过 `docker compose down`，容器会被删除；此时仅靠 `restart: always` 不会自动重新创建容器，需要再次执行 `docker compose up -d`。

建议在服务器上执行以下命令，确保 Docker 本身开机自启：

```bash
sudo systemctl enable docker
sudo systemctl start docker
sudo systemctl status docker
```

如果希望项目级别也由 `systemd` 显式托管，可额外创建一个服务单元：

```bash
sudo tee /etc/systemd/system/shou.service <<'EOF'
[Unit]
Description=Distributor Pay Platform
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
WorkingDirectory=/data/www/sinhe
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
RemainAfterExit=yes
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable shou
sudo systemctl start shou
sudo systemctl status shou
```

说明：

- 对当前项目而言，通常先启用 `docker.service` 开机自启就够了。
- 只有在你希望用 `systemd` 明确管理项目启动顺序、状态查看、统一运维入口时，才需要额外增加 `shou.service`。

## 6. 生产初始化

### 6.1 禁止直接执行测试种子脚本

以下脚本仅适用于本地开发或演示环境：

```bash
pnpm db:seed
```

原因：

- 该脚本会创建测试租户。
- 该脚本会生成固定测试账号 `admin / 123456`、`boss / 123456`。
- 该脚本会覆盖这些测试账号的密码哈希。

生产环境禁止执行该脚本。

### 6.2 正式环境初始化脚本

仓库已提供生产初始化脚本 `scripts/db-init.js`，用于安全创建：

- 首个 OS 超级管理员
- 可选的首个租户
- 可选的首个租户老板账号

执行示例：

```bash
docker compose run --rm \
  -e INIT_OS_ADMIN_USERNAME=os_admin \
  -e INIT_OS_ADMIN_PASSWORD='<强密码>' \
  -e INIT_OS_ADMIN_REAL_NAME='系统管理员' \
  -e INIT_TENANT_NAME='华东区正式租户' \
  -e INIT_TENANT_CONTACT_PHONE='13800138000' \
  -e INIT_TENANT_OWNER_USERNAME=tenant_owner \
  -e INIT_TENANT_OWNER_PASSWORD='<强密码>' \
  -e INIT_TENANT_OWNER_REAL_NAME='租户老板' \
  -e INIT_TENANT_MAX_CREDIT_DAYS=45 \
  -e INIT_TENANT_CREDIT_REMINDER_DAYS=7 \
docker-compose exec api node ../../scripts/db-init.js
```

执行规则：

- `INIT_OS_ADMIN_USERNAME`、`INIT_OS_ADMIN_PASSWORD` 必填。
- 如果要同时初始化租户，则 `INIT_TENANT_NAME`、`INIT_TENANT_CONTACT_PHONE`、`INIT_TENANT_OWNER_USERNAME`、`INIT_TENANT_OWNER_PASSWORD` 必须成组提供。
- 脚本为幂等设计；若同名对象已存在，则跳过，不会重置已有密码。

初始化完成后，请立即登录系统验证账号权限与租户数据范围是否正确。

## 7. 日常发布流程

### 7.1 标准发版步骤

```bash
cd /data/www/sinhe

git pull
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

### 7.2 发版前强制检查

每次生产发版前至少确认以下事项：

1. 已完成数据库备份。
2. 已确认本次版本是否涉及 Prisma Schema 变化。
3. 已确认 `.env` 中的生产密钥未被覆盖。
4. 已确认支付、金额、租户隔离相关改动经过专项验证。

对于本项目，这 4 项是生产红线，不可省略。

## 8. 数据备份与恢复

### 8.1 PostgreSQL 备份

建议每日定时备份数据库：

```bash
mkdir -p /data/backup/postgres

docker exec shou-db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  > /data/backup/postgres/shou_$(date +%F_%H%M%S).sql
```

如果宿主机环境变量未导出，可直接写明用户名和库名：

```bash
docker exec shou-db \
  pg_dump -U postgres -d shou \
  > /data/backup/postgres/shou_$(date +%F_%H%M%S).sql
```

### 8.2 PostgreSQL 恢复

恢复前请先停业务并确认目标库是否允许覆盖：

```bash
cat /data/backup/postgres/<备份文件>.sql | docker exec -i shou-db psql -U postgres -d shou
```

### 8.3 Redis 备份

当前 Redis 以 AOF 持久化方式运行，数据卷为 `redisdata`。若需要宿主机级别备份，可在业务低峰期备份 Docker Volume。

## 9. 回滚方案

### 9.1 应用回滚

推荐以 Git Tag 或固定提交号进行回滚：

```bash
cd /data/www/sinhe

git fetch --all --tags
git checkout <tag或commit>
docker compose up -d --build
```

### 9.2 数据回滚

如果本次发版已引发表结构变化或业务数据写入异常，应用回滚不足以恢复，需要配合数据库备份做数据恢复。

结论：

- 应用回滚解决代码问题。
- 数据回滚解决结构和数据问题。
- 两者不能互相替代。

## 10. 常用运维命令

### 10.1 查看状态与日志

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f nginx
docker compose logs -f db
docker compose logs -f redis
```

### 10.2 重启服务

```bash
docker compose restart api
docker compose restart nginx
docker compose restart db redis
```

### 10.3 停止与启动

```bash
docker compose down
docker compose up -d
```

### 10.4 重新构建镜像

```bash
docker builder prune -f
docker compose up -d --build
```

注意：

- 不要使用 `docker stop $(docker ps -q)` 这种全局命令，避免误伤同机其他项目。
- 不要直接清空整个宿主机所有 Docker 容器日志，应优先配置日志轮转。

## 11. 故障排查

### 11.1 页面打不开

排查顺序：

1. 检查阿里云安全组是否放行对应业务端口。
2. 检查 `docker compose ps` 中 `nginx` 是否正常运行。
3. 检查宿主机端口占用：`ss -lntp | grep 500`
4. 检查 `deploy/nginx.conf` 是否被错误修改。

### 11.2 API 启动失败

排查重点：

1. 检查 `JWT_SECRET` 是否配置。
2. 检查 PostgreSQL 和 Redis 容器是否先于 API 正常启动。
3. 检查 `docker compose logs -f api` 中是否存在 Prisma 连接失败或表结构同步失败。

### 11.3 数据库连接失败

```bash
docker compose logs -f db
docker exec -it shou-db psql -U postgres -d shou
```

常见原因：

- `POSTGRES_PASSWORD` 配置错误
- 数据卷损坏
- 宿主机磁盘空间不足

### 11.4 构建失败

排查顺序：

1. 检查服务器是否能访问镜像源和 npm 镜像源。
2. 检查磁盘空间是否充足。
3. 执行 `docker builder prune -f` 后重新构建。

## 12. 生产安全基线

本项目属于多租户订单收款平台，生产部署必须满足以下最小安全要求：

1. 禁止在仓库文档中保存真实生产密码、JWT 密钥、支付密钥。
2. 禁止公网开放 PostgreSQL 与 Redis 端口。
3. 首次上线前必须完成管理员账号的强密码初始化，禁止使用测试种子账号。
4. 每次发版前必须先做数据库备份。
5. 涉及支付、改价、手工标记已支付、多租户隔离的改动，必须先在预发布环境验证。
6. 建议 SSH 改为密钥登录，并禁用 root 密码直登。
7. 建议在公网入口启用 HTTPS，不直接以裸 IP + HTTP 长期运行。

## 13. 文档维护要求

后续如发生以下任一变化，必须同步更新本文件：

- Docker 端口映射变化
- Nginx 反向代理规则变化
- 环境变量新增或变更
- 数据初始化方式变化
- 备份与回滚流程变化

否则部署文档将很快失效。
