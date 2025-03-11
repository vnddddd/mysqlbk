#!/bin/bash
set -e

# 日志函数
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 配置信息 (从环境变量中获取)
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"3306"}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

# 备份目录
BACKUP_DIR="/app/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# 检查环境变量
if [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
  log "错误: 缺少必要的环境变量 (DB_USER, DB_PASSWORD, DB_NAME)"
  exit 1
fi

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 执行备份
log "开始备份数据库 ${DB_NAME}..."
mysqldump --host=${DB_HOST} --port=${DB_PORT} --user=${DB_USER} --password=${DB_PASSWORD} \
  --single-transaction --quick --lock-tables=false ${DB_NAME} | gzip > ${BACKUP_FILE}

# 检查备份是否成功
if [ $? -eq 0 ] && [ -f "${BACKUP_FILE}" ]; then
  FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  log "备份成功: ${BACKUP_FILE} (${FILESIZE})"
  
  # 清理旧备份 (保留最近7天)
  find ${BACKUP_DIR} -name "*.sql.gz" -type f -mtime +7 -delete
  log "已清理超过7天的旧备份"
  
  # 上传到AWS S3 (如果配置了S3)
  if [ ! -z "${S3_BUCKET}" ]; then
    log "开始上传备份到 S3: ${S3_BUCKET}"
    aws s3 cp ${BACKUP_FILE} s3://${S3_BUCKET}/mysql-backups/
    if [ $? -eq 0 ]; then
      log "备份已成功上传到 S3: s3://${S3_BUCKET}/mysql-backups/$(basename ${BACKUP_FILE})"
    else
      log "上传到 S3 失败"
    fi
  fi
  
  # 上传到Backblaze B2 (如果配置了B2)
  if [ ! -z "${B2_BUCKET}" ] && [ ! -z "${B2_KEY_ID}" ] && [ ! -z "${B2_APP_KEY}" ]; then
    log "开始上传备份到 Backblaze B2: ${B2_BUCKET}"
    export B2_APPLICATION_KEY_ID=${B2_KEY_ID}
    export B2_APPLICATION_KEY=${B2_APP_KEY}
    
    # 授权B2
    b2 authorize-account
    
    # 上传文件
    b2 upload-file ${B2_BUCKET} ${BACKUP_FILE} mysql-backups/$(basename ${BACKUP_FILE})
    if [ $? -eq 0 ]; then
      log "备份已成功上传到 B2: ${B2_BUCKET}/mysql-backups/$(basename ${BACKUP_FILE})"
    else
      log "上传到 B2 失败"
    fi
  fi
  
  exit 0
else
  log "备份失败"
  exit 1
fi 