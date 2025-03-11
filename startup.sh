#!/bin/bash
set -e

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "MySQL 备份服务启动中..."

# 检查环境变量
log "验证环境变量配置..."
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAMES" ]; then
    log "错误: 缺少必要的MySQL环境变量"
    log "请确保设置以下环境变量:"
    log "- DB_HOST: MySQL主机地址"
    log "- DB_PORT: MySQL端口 (默认: 3306)"
    log "- DB_USER: MySQL用户名"
    log "- DB_PASSWORD: MySQL密码"
    log "- DB_NAMES: 要备份的数据库名称，多个用逗号分隔"
    exit 1
fi

if [ -z "$B2_APPLICATION_KEY_ID" ] || [ -z "$B2_APPLICATION_KEY" ] || [ -z "$B2_BUCKET_NAME" ]; then
    log "错误: 缺少必要的Backblaze B2环境变量"
    log "请确保设置以下环境变量:"
    log "- B2_APPLICATION_KEY_ID: Backblaze B2应用密钥ID"
    log "- B2_APPLICATION_KEY: Backblaze B2应用密钥"
    log "- B2_BUCKET_NAME: Backblaze B2存储桶名称"
    exit 1
fi

log "- BACKUP_RETENTION_DAYS: 本地备份保留天数 (默认: 7)"

# 启动crond
log "启动定时任务服务..."
crond -b -l 8

# 执行初始备份测试
log "执行初始备份检查..."
if /app/backup.sh; then
    log "初始备份测试成功，定时任务已设置为每天凌晨4点运行"
    log "MySQL备份服务已成功启动"
else
    log "初始备份测试失败，请检查日志获取详细信息"
    exit 1
fi

# 保持容器运行
log "服务已启动，容器将持续运行"
# 使用tail命令保持容器运行
tail -f /dev/null 