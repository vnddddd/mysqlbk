#!/bin/bash
set -e

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 从环境变量获取数据库连接信息
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"3306"}
DB_USER=${DB_USER:-"root"}
DB_PASSWORD=${DB_PASSWORD:-""}
DB_NAMES=${DB_NAMES:-""}

# Backblaze B2 配置
B2_APPLICATION_KEY_ID=${B2_APPLICATION_KEY_ID:-""}
B2_APPLICATION_KEY=${B2_APPLICATION_KEY:-""}
B2_BUCKET_NAME=${B2_BUCKET_NAME:-""}

BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-"7"}

# 检查必要的环境变量
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAMES" ]; then
    log "错误: 缺少必要的MySQL环境变量"
    exit 1
fi

if [ -z "$B2_APPLICATION_KEY_ID" ] || [ -z "$B2_APPLICATION_KEY" ] || [ -z "$B2_BUCKET_NAME" ]; then
    log "错误: 缺少必要的Backblaze B2环境变量"
    exit 1
fi

# 创建备份目录
DATE=$(date +"%Y%m%d-%H%M%S")
BACKUP_DIR="/app/backups"
mkdir -p "$BACKUP_DIR"

# 备份每个数据库
IFS=',' read -ra DBS <<< "$DB_NAMES"
FAILED=0

for DB in "${DBS[@]}"; do
    DB=$(echo "$DB" | xargs)
    TEMP_FILE="$BACKUP_DIR/backup-$DB-$DATE.sql"
    BACKUP_FILE="$BACKUP_DIR/backup-$DB-$DATE.sql.gz"
    
    log "开始备份数据库: $DB"
    
    # 检查数据库连接
    mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" -e "USE $DB; SHOW TABLES;" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        log "无法连接数据库 $DB 或数据库为空"
        FAILED=1
        continue
    fi

    # 执行备份
    mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" \
        --default-auth=mysql_native_password \
        --single-transaction --routines --triggers --events "$DB" > "$TEMP_FILE" 2> "$BACKUP_DIR/error-$DB-$DATE.log"
    
    if [ $? -eq 0 ] && [ -s "$TEMP_FILE" ]; then
        gzip "$TEMP_FILE"
        if [ $? -eq 0 ]; then
            log "数据库 $DB 备份成功，保存到: $BACKUP_FILE"
            
            # 上传到Backblaze B2
            if [ -s "$BACKUP_FILE" ]; then
                log "开始上传备份到Backblaze B2: $B2_BUCKET_NAME"
                python3 -c "
from b2sdk.v2 import InMemoryAccountInfo, B2Api
import sys, os
try:
    info = InMemoryAccountInfo()
    b2_api = B2Api(info)
    b2_api.authorize_account('production', '$B2_APPLICATION_KEY_ID', '$B2_APPLICATION_KEY')
    bucket = b2_api.get_bucket_by_name('$B2_BUCKET_NAME')
    local_file = '$BACKUP_FILE'
    b2_file_name = 'mysql-backups/' + os.path.basename(local_file)
    bucket.upload_local_file(local_file=local_file, file_name=b2_file_name)
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
            else
                log "备份文件 $BACKUP_FILE 为空，跳过上传"
                FAILED=1
            fi
        else
            log "压缩备份文件失败"
            FAILED=1
        fi
    else
        log "数据库 $DB 备份失败，错误详情见: $BACKUP_DIR/error-$DB-$DATE.log"
        cat "$BACKUP_DIR/error-$DB-$DATE.log"
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