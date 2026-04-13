# Redis Insight 登录会话排查指南

适用场景：

- 本地开发环境已启动 API、PostgreSQL、Redis
- 需要确认登录后 Redis 里到底写了哪些 key
- 需要通过 Redis Insight 排查登录、刷新、登出链路

本文基于当前项目的会话中心实现整理，默认 Redis 连接为：

- Host：`127.0.0.1`
- Port：`6379`

## 1. 当前登录态的 Redis 键设计

当前项目登录成功后，Redis 主要会写 4 类键：

### 1. `session:{sessionId}`

作用：

- 保存单个会话的完整信息

类型：

- `HASH`

典型字段：

- `sessionId`
- `userId`
- `account`
- `role`
- `tenantId`
- `status`
- `refreshTokenHash`
- `createdAt`
- `lastSeenAt`
- `accessExpiresAt`
- `refreshExpiresAt`

### 2. `refresh:{sha256(refreshToken)}`

作用：

- 用 refresh token 的哈希值反查 `sessionId`

类型：

- `STRING`

值：

- `sessionId`

说明：

- Redis 不保存 refresh token 明文
- 只保存 refresh token 的 `sha256` 哈希

### 3. `user:sessions:{userId}`

作用：

- 保存某个用户当前所有活跃会话

类型：

- `ZSET`

member：

- `sessionId`

score：

- `lastSeenAt` 的毫秒时间戳

### 4. `user:tokenVersion:{userId}`

作用：

- 预留给“全端失效”“强制重新登录”场景

类型：

- `STRING`

值：

- 当前 token 版本号，默认是 `1`

## 2. 本次排查到的真实示例

以下值来自本机一次真实登录后的 Redis 数据，仅作为示例。后续重新登录、刷新或登出后，这些值会变化。

### admin 用户

- `userId`：`fbff2d66-5388-47f6-bfa1-be4faa66ef51`
- `account`：`admin`
- `role`：`OS_SUPER_ADMIN`

### 本次示例会话

- `session:0a746e8e-d8ef-4fee-9674-44cf6a49bf9f`
- `refresh:c1982a75b61c1c663b75363b5991532a2665f7b171241e423dd78441183dbc9c`
- `user:sessions:fbff2d66-5388-47f6-bfa1-be4faa66ef51`
- `user:tokenVersion:fbff2d66-5388-47f6-bfa1-be4faa66ef51`

## 3. 在使用 Redis Insight 之前，先用命令确认键值

如果你想先在命令行里确认当前有哪些会话键，可使用 `redis-cli`。

推荐优先使用已经加入环境变量的通用命令：

```powershell
redis-cli
```

如果当前机器还没有把 `redis-cli` 加入 `PATH`，再按实际安装位置使用绝对路径。

Windows 本机可选示例：

```powershell
C:\Program Files\Redis\redis-cli.exe
```

说明：

- 文档中的绝对路径只表示“本机某次排查时的一个示例路径”
- 不是项目运行时依赖
- 换一台电脑、换一个用户名、换到服务器环境后，路径都可能不同

### 3.1 查询所有会话相关 key

```powershell
redis-cli --raw -h 127.0.0.1 -p 6379 KEYS 'session:*'
redis-cli --raw -h 127.0.0.1 -p 6379 KEYS 'refresh:*'
redis-cli --raw -h 127.0.0.1 -p 6379 KEYS 'user:sessions:*'
redis-cli --raw -h 127.0.0.1 -p 6379 KEYS 'user:tokenVersion:*'
```

### 3.2 查询某个用户有哪些会话

以 `admin` 为例：

```powershell
redis-cli --raw -h 127.0.0.1 -p 6379 ZRANGE 'user:sessions:fbff2d66-5388-47f6-bfa1-be4faa66ef51' 0 -1 WITHSCORES
```

返回值中：

- 第 1 行是 `sessionId`
- 第 2 行是该会话的 `lastSeenAt`

### 3.3 查询单个 session 的详细内容

```powershell
redis-cli --raw -h 127.0.0.1 -p 6379 HGETALL 'session:0a746e8e-d8ef-4fee-9674-44cf6a49bf9f'
```

示例返回重点如下：

```text
sessionId
0a746e8e-d8ef-4fee-9674-44cf6a49bf9f
userId
fbff2d66-5388-47f6-bfa1-be4faa66ef51
account
admin
role
OS_SUPER_ADMIN
status
active
refreshTokenHash
c1982a75b61c1c663b75363b5991532a2665f7b171241e423dd78441183dbc9c
```

### 3.4 查询 refresh 哈希对应的是哪个会话

```powershell
redis-cli --raw -h 127.0.0.1 -p 6379 GET 'refresh:c1982a75b61c1c663b75363b5991532a2665f7b171241e423dd78441183dbc9c'
```

返回值应为：

```text
0a746e8e-d8ef-4fee-9674-44cf6a49bf9f
```

说明这条 refresh 映射的是这一个 session。

### 3.5 查询 tokenVersion

```powershell
redis-cli --raw -h 127.0.0.1 -p 6379 GET 'user:tokenVersion:fbff2d66-5388-47f6-bfa1-be4faa66ef51'
```

示例返回：

```text
1
```

### 3.6 查询 TTL

```powershell
redis-cli -h 127.0.0.1 -p 6379 TTL 'session:0a746e8e-d8ef-4fee-9674-44cf6a49bf9f'
redis-cli -h 127.0.0.1 -p 6379 TTL 'refresh:c1982a75b61c1c663b75363b5991532a2665f7b171241e423dd78441183dbc9c'
```

说明：

- `session:*` 和 `refresh:*` 的 TTL 一般接近 refresh token 的有效期
- 当前项目 refresh token 有效期是 7 天

## 4. 如何先从 PostgreSQL 查到 userId

有时你只知道账号，不知道 `userId`。这时先去 PostgreSQL 查 `users` 表。

示例：

```powershell
$env:PGPASSWORD='postgres'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -U postgres -d shou_db -t -A -c "select id, account, role from users order by account;"
```

如果 `psql` 已加入环境变量，也可直接写成：

```powershell
psql -h 127.0.0.1 -U postgres -d shou_db -t -A -c "select id, account, role from users order by account;"
```

示例结果：

```text
fbff2d66-5388-47f6-bfa1-be4faa66ef51|admin|OS_SUPER_ADMIN
82817114-7485-438a-ba78-2ac5945f2f69|boss|TENANT_OWNER
```

拿到 `userId` 后，再回 Redis 查：

- `user:sessions:{userId}`
- `user:tokenVersion:{userId}`

## 5. 在 Redis Insight 中查看完整链路

### 5.1 连接本地 Redis

在 Redis Insight 新建连接：

- Host：`127.0.0.1`
- Port：`6379`

连接成功后进入 `Browser`。

### 5.2 先看用户会话索引

搜索：

```text
user:sessions:fbff2d66-5388-47f6-bfa1-be4faa66ef51
```

你会看到一个 `ZSET`，里面的 member 就是 `sessionId`。

对当前 `admin` 来说，示例是：

- `0a746e8e-d8ef-4fee-9674-44cf6a49bf9f`

### 5.3 再看 session 详情

搜索：

```text
session:0a746e8e-d8ef-4fee-9674-44cf6a49bf9f
```

重点看：

- `account`
- `role`
- `status`
- `refreshTokenHash`
- `lastSeenAt`

### 5.4 再看 refresh 映射

搜索：

```text
refresh:c1982a75b61c1c663b75363b5991532a2665f7b171241e423dd78441183dbc9c
```

你会看到 value 是：

- `0a746e8e-d8ef-4fee-9674-44cf6a49bf9f`

这样就串起来了：

```text
userId
-> user:sessions:{userId}
-> sessionId
-> session:{sessionId}
-> refreshTokenHash
-> refresh:{refreshTokenHash}
```

### 5.5 最后看 tokenVersion

搜索：

```text
user:tokenVersion:fbff2d66-5388-47f6-bfa1-be4faa66ef51
```

通常为：

- `1`

## 6. 如何验证登录、刷新、登出

### 6.1 登录成功后

预期会新增：

- `user:sessions:{userId}` 中新增一个 `sessionId`
- `session:{sessionId}` 新增一条 HASH
- `refresh:{hash}` 新增一条 STRING

### 6.2 刷新成功后

预期变化：

- `session:{sessionId}` 里的 `lastSeenAt` 更新
- `session:{sessionId}` 里的 `refreshTokenHash` 变化
- 旧 `refresh:{旧hash}` 被删除
- 新 `refresh:{新hash}` 被创建

### 6.3 登出成功后

预期变化：

- `user:sessions:{userId}` 里的对应 `sessionId` 被移除
- `session:{sessionId}` 被删除
- `refresh:{refreshTokenHash}` 被删除

## 7. 排查建议

如果你发现“数据库重置了，但 Redis 里还有旧会话”，这是正常现象，因为：

- PostgreSQL 数据和 Redis 会话不是一起重置的
- `prisma db push --force-reset` 只会影响数据库
- 不会自动清理 Redis

这时建议只清理登录相关 key：

```powershell
redis-cli --raw -h 127.0.0.1 -p 6379 KEYS 'session:*'
redis-cli --raw -h 127.0.0.1 -p 6379 KEYS 'refresh:*'
redis-cli --raw -h 127.0.0.1 -p 6379 KEYS 'user:sessions:*'
redis-cli --raw -h 127.0.0.1 -p 6379 KEYS 'user:tokenVersion:*'
```

删除前先确认环境，避免误删线上数据。

## 8. 阿里云或其他服务器环境怎么用

如果部署在阿里云或其他 Linux 服务器，通常不会使用 Windows 绝对路径，而是直接用系统命令：

```bash
redis-cli -h 127.0.0.1 -p 6379
```

如果 Redis 跑在 Docker 容器里，还可以进入容器执行：

```bash
docker exec -it <redis-container> redis-cli
```

结论：

- 文档中的绝对路径只是本机示例，不是通用依赖
- 本地、他人电脑、阿里云服务器都应优先使用通用命令 `redis-cli`
- 只有在命令未加入 `PATH` 时，才按当前机器实际安装位置补绝对路径
