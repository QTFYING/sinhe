# env 环境配置

说明：

- API 当前统一通过 `ConfigModule` 加载 `apps/api/.env`
- 本地环境建议复制 `apps/api/.env.example` 生成自己的 `.env`

## ThinkPad 本地开发

``` shell
# 数据库基础凭证
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=shou

# Prisma 核心连接串 (注意：原密码中的 @ 已经智能转义为 %40 以兼容连接串)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shou?schema=public"

# JWT 签名密钥
JWT_SECRET=7f8b9d2a1c4e6f5a3c2b1d4e7f8a9c0b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a

# Redis 连接
REDIS_URL=redis://localhost:6379

# 跨域配置 (支持联调)
CORS_ORIGINS=http://localhost:5001,http://localhost:5002,http://localhost:5003

# API 启动端口
PORT=3000

# 运行环境
NODE_ENV=development

# 本地 HTTP 下关闭 secure cookie
AUTH_COOKIE_SECURE=false

# API 进程默认不直接消费导入任务
IMPORT_JOB_WORKER_ENABLED=false

# 拉卡拉收银台前缀
LAKALA_CASHIER_URL_PREFIX=https://cashier.lakala.com/pay?tradeNo=
```

## 阿里云服务器env配置

``` shell
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Sinhe@db_2026_Secure!
POSTGRES_DB=shou
JWT_SECRET=7f8b9d2a1c4e6f5a3c2b1d4e7f8a9c0b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a
REDIS_URL=redis://127.0.0.1:6379
PORT=3000
NODE_ENV=production
AUTH_COOKIE_SECURE=true
IMPORT_JOB_WORKER_ENABLED=false
LAKALA_CASHIER_URL_PREFIX=https://cashier.lakala.com/pay?tradeNo=
```
