#!/bin/bash
set -e

# 加载环境变量
# 这些环境变量将在Railway平台上设置
# MYSQL_HOST: MySQL服务器地址
# MYSQL_PORT: MySQL服务器端口
# MYSQL_USER: MySQL用户名
# MYSQL_PASSWORD: MySQL密码
# MYSQL_DATABASE: 要备份的数据库名称（如果为空则备份所有数据库）

# 创建备份目录
BACKUP_DIR="/app/backups"
mkdir -p $BACKUP_DIR

# 设置备份文件名（使用当前日期和时间）
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/mysql_backup_$TIMESTAMP.sql.gz"

# 日志函数
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# 开始备份
log "开始MySQL备份..."

# 如果指定了数据库名称，则只备份该数据库，否则备份所有数据库
if [ -n "$MYSQL_DATABASE" ]; then
  log "备份数据库: $MYSQL_DATABASE"
  mysqldump --host=$MYSQL_HOST \
            --port=$MYSQL_PORT \
            --user=$MYSQL_USER \
            --password=$MYSQL_PASSWORD \
            --default-character-set=utf8mb4 \
            --single-transaction \
            --routines \
            --triggers \
            --events \
            $MYSQL_DATABASE | gzip > $BACKUP_FILE
else
  log "备份所有数据库"
  mysqldump --host=$MYSQL_HOST \
            --port=$MYSQL_PORT \
            --user=$MYSQL_USER \
            --password=$MYSQL_PASSWORD \
            --default-character-set=utf8mb4 \
            --all-databases \
            --single-transaction \
            --routines \
            --triggers \
            --events | gzip > $BACKUP_FILE
fi

# 检查备份是否成功
if [ $? -eq 0 ]; then
  FILESIZE=$(stat -c%s "$BACKUP_FILE")
  log "备份完成: $BACKUP_FILE (大小: $(($FILESIZE / 1024 / 1024)) MB)"
  
  # 调用上传脚本
  log "开始上传备份文件..."
  /app/upload.sh "$BACKUP_FILE"
  
  # 删除旧备份文件（保留最近7天的备份）
  find $BACKUP_DIR -name "mysql_backup_*.sql.gz" -type f -mtime +7 -delete
  log "已清理7天前的备份文件"
else
  log "备份失败!"
  exit 1
fi

log "备份流程完成" 