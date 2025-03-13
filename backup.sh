#!/bin/bash
set -e

# 确保使用虚拟环境中的Python
export PATH="/opt/venv/bin:$PATH"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 从环境变量获取数据库连接信息
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"3306"}
DB_USER=${DB_USER:-"root"}
DB_PASSWORD=${DB_PASSWORD:-""}
DB_NAMES=${DB_NAMES:-""}  # 数据库名称，多个用逗号分隔

# Backblaze B2 配置
B2_APPLICATION_KEY_ID=${B2_APPLICATION_KEY_ID:-""}
B2_APPLICATION_KEY=${B2_APPLICATION_KEY:-""}
B2_BUCKET_NAME=${B2_BUCKET_NAME:-""}

BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-"7"}  # 本地保留天数

# 检查必要的环境变量
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAMES" ]; then
    log "错误: 缺少必要的MySQL环境变量"
    exit 1
fi

if [ -z "$B2_APPLICATION_KEY_ID" ] || [ -z "$B2_APPLICATION_KEY" ] || [ -z "$B2_BUCKET_NAME" ]; then
    log "错误: 缺少必要的Backblaze B2环境变量"
    exit 1
fi

# 创建日期格式的文件名
DATE=$(date +"%Y%m%d-%H%M%S")
BACKUP_DIR="/app/backups"
mkdir -p "$BACKUP_DIR"

# 测试数据库连接
log "测试MySQL连接..."
if ! mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" --connect-timeout=10 -e "SELECT 1;" &>/dev/null; then
    log "错误: 无法连接到MySQL服务器，请检查连接信息和认证方式"
    exit 1
fi

# 备份每个数据库
IFS=',' read -ra DBS <<< "$DB_NAMES"
FAILED=0

for DB in "${DBS[@]}"; do
    DB=$(echo "$DB" | xargs)  # 去除空格
    BACKUP_FILE="$BACKUP_DIR/backup-$DB-$DATE.sql.gz"
    ERROR_LOG="$BACKUP_DIR/error-$DB-$DATE.log"
    
    log "开始备份数据库: $DB"
    
    # 执行备份，尝试使用mysql_native_password认证
    mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" \
        --default-auth=mysql_native_password --column-statistics=0 --single-transaction --routines --triggers --events "$DB" 2>"$ERROR_LOG" | gzip > "$BACKUP_FILE"
    
    DUMP_STATUS=$?
    # 检查错误日志和备份文件大小
    if [ $DUMP_STATUS -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
        # 检查备份文件是否只有头部信息（极小）
        if [ $(gzip -dc "$BACKUP_FILE" | head -20 | grep -c "MySQL dump") -gt 0 ] && [ $(stat -c%s "$BACKUP_FILE") -lt 1000 ]; then
            log "警告: 数据库 $DB 备份文件异常小，可能只包含头信息，没有实际数据"
            cat "$ERROR_LOG"
            FAILED=1
        else
            log "数据库 $DB 备份成功，保存到: $BACKUP_FILE (大小: $(stat -c%s "$BACKUP_FILE") 字节)"
            rm -f "$ERROR_LOG"
            
            # 上传到Backblaze B2
            log "开始上传备份到Backblaze B2: $B2_BUCKET_NAME"
            
            # 使用Python脚本上传到B2
            python3 -c "
from b2sdk.v2 import InMemoryAccountInfo, B2Api
import sys
import os

try:
    # 认证B2
    info = InMemoryAccountInfo()
    b2_api = B2Api(info)
    b2_api.authorize_account('production', '$B2_APPLICATION_KEY_ID', '$B2_APPLICATION_KEY')
    
    # 获取桶
    bucket = b2_api.get_bucket_by_name('$B2_BUCKET_NAME')
    
    # 上传文件
    local_file = '$BACKUP_FILE'
    b2_file_name = 'mysql-backups/' + os.path.basename(local_file)
    
    uploaded_file = bucket.upload_local_file(
        local_file=local_file,
        file_name=b2_file_name,
    )
    
    print(f'上传成功: {local_file} -> {b2_file_name}')
except Exception as e:
    print(f'上传失败: {e}')
    sys.exit(1)
"
            if [ $? -eq 0 ]; then
                log "备份成功上传到B2: $B2_BUCKET_NAME/mysql-backups/$(basename "$BACKUP_FILE")"
            else
                log "上传到B2失败"
                FAILED=1
            fi
        fi
    else
        log "数据库 $DB 备份失败，查看错误日志:"
        cat "$ERROR_LOG"
        FAILED=1
    fi
done

# 清理旧备份文件
if [ $FAILED -eq 0 ]; then
    log "清理$BACKUP_RETENTION_DAYS天前的本地备份文件"
    find "$BACKUP_DIR" -name "backup-*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
fi

# 返回状态
if [ $FAILED -eq 0 ]; then
    log "所有备份任务成功完成"
    exit 0
else
    log "备份过程中发生错误"
    exit 1
fi 