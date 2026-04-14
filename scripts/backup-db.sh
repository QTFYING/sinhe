#!/bin/bash

# ==============================================================================
# PostgreSQL 自动备份脚本
# ==============================================================================
# 建议通过 crontab 执行，例如：
# 0 3 * * * /bin/bash /data/www/api/scripts/backup-db.sh >> /data/www/api/scripts/backup.log 2>&1
# ==============================================================================

# --- 配置项 ---
BACKUP_DIR="/data/backups/db"    # 备份文件存储目录
CONTAINER_NAME="shou-db"       # 数据库容器名称
DB_USER="postgres"             # 数据库用户名 (对应 .env 中的 POSTGRES_USER)
DB_NAME="shou_db"              # 数据库名称 (对应 .env 中的 POSTGRES_DB)
KEEP_DAYS=7                    # 备份保留天数

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成带时间戳的文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE_NAME="backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "----------------------------------------------------------------"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始备份数据库: ${DB_NAME}"

# 执行导出与压缩
# 注意：使用 pg_dump 时不使用 -it，因为在定时任务中没有交互终端
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILE_NAME"

if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份成功: $FILE_NAME"
    echo "文件位置: $BACKUP_DIR/$FILE_NAME"
    
    # 清理过期备份
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 正在清理 ${KEEP_DAYS} 天前的旧备份..."
    find "$BACKUP_DIR" -type f -name "backup_${DB_NAME}_*.sql.gz" -mtime +"$KEEP_DAYS" -exec rm -f {} \;
    echo "清理完成。"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份失败！请检查容器状态及磁盘空间。"
    exit 1
fi

echo "----------------------------------------------------------------"
