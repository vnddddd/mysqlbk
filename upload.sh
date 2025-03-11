#!/bin/bash
set -e

# 加载环境变量
# 这些环境变量将在Railway平台上设置
# B2_APPLICATION_KEY_ID: BackBlaze B2应用密钥ID
# B2_APPLICATION_KEY: BackBlaze B2应用密钥
# B2_BUCKET_NAME: BackBlaze B2存储桶名称

# 日志函数
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# 检查参数
if [ "$#" -ne 1 ]; then
  log "用法: $0 <备份文件路径>"
  exit 1
fi

BACKUP_FILE=$1
FILENAME=$(basename "$BACKUP_FILE")

# 检查环境变量是否设置
if [ -z "$B2_APPLICATION_KEY_ID" ] || [ -z "$B2_APPLICATION_KEY" ] || [ -z "$B2_BUCKET_NAME" ]; then
  log "错误: B2环境变量未设置"
  exit 1
fi

# 授权B2
log "正在授权B2..."
b2 authorize-account "$B2_APPLICATION_KEY_ID" "$B2_APPLICATION_KEY"

# 上传文件
log "正在上传 $FILENAME 到 B2 bucket: $B2_BUCKET_NAME..."
b2 upload-file "$B2_BUCKET_NAME" "$BACKUP_FILE" "mysql-backups/$FILENAME"

# 检查上传结果
if [ $? -eq 0 ]; then
  log "上传成功: $FILENAME"
else
  log "上传失败: $FILENAME"
  exit 1
fi 