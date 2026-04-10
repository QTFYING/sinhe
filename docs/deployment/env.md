# env 环境配置

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

# 跨域配置 (支持联调)
CORS_ORIGINS=http://localhost:5001,http://localhost:5002,http://localhost:5003
```

## 阿里云服务器env配置

``` shell
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Sinhe@db_2026_Secure!
POSTGRES_DB=shou
JWT_SECRET=7f8b9d2a1c4e6f5a3c2b1d4e7f8a9c0b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a
```