# ============================================
# Stage 1: 安装依赖
# ============================================
FROM node:22-alpine AS deps

# 配置国内镜像源（解决阿里云服务器无法访问 npmjs.org）
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable

WORKDIR /app

# 先复制 pnpm 配置和所有 package.json，利用 Docker 缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .npmrc ./

# apps
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/tenant/package.json apps/tenant/
COPY apps/pay-h5/package.json apps/pay-h5/

# packages
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/
COPY packages/shared-ui/package.json packages/shared-ui/

RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: 构建全部应用
# ============================================
FROM deps AS build

COPY . .

# Prisma generate（生成客户端）
RUN pnpm --filter api prisma:generate

# Turbo 构建所有应用
RUN pnpm run build

# pnpm deploy 生成独立部署目录（无 symlink，node_modules 完整平铺）
RUN pnpm --filter api deploy --prod --legacy /deploy/api

# 把 dist 和 prisma 复制进去（deploy 只含运行时依赖，不含构建产物）
RUN cp -r /app/apps/api/dist /deploy/api/dist && \
    cp -r /app/apps/api/prisma /deploy/api/prisma

# ============================================
# Stage 3: API 运行时（精简镜像）
# ============================================
FROM node:22-alpine AS api

# Prisma 引擎依赖 OpenSSL
RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=build /deploy/api ./

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma db push --skip-generate && node dist/main"]

# ============================================
# Stage 4: Nginx 托管前端静态文件
# ============================================
FROM nginx:alpine AS nginx

# 复制三个前端的构建产物
COPY --from=build /app/apps/admin/dist /usr/share/nginx/admin
COPY --from=build /app/apps/tenant/dist /usr/share/nginx/tenant
COPY --from=build /app/apps/pay-h5/dist /usr/share/nginx/pay-h5

# 复制 Nginx 配置
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# 删除默认配置避免冲突
RUN rm -f /etc/nginx/conf.d/default.conf.bak

EXPOSE 8001 8002 8003
