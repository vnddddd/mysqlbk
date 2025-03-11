#!/bin/bash
set -e

# 日志函数
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 确保脚本可执行
chmod +x /app/scripts/backup.sh

# 配置cron任务 - 每天凌晨4点执行备份
log "配置定时备份任务 (每天凌晨4点)"
echo "0 4 * * * /app/scripts/backup.sh >> /app/backups/backup.log 2>&1" > /etc/cron.d/mysql-backup
chmod 0644 /etc/cron.d/mysql-backup
crontab /etc/cron.d/mysql-backup

# 启动cron服务
log "启动cron服务"
service cron start

# 立即执行一次备份以验证配置是否正确
log "立即执行一次初始备份以验证配置"
/app/scripts/backup.sh >> /app/backups/backup.log 2>&1

# 保持容器运行
log "备份服务已启动，容器将持续运行"
tail -f /app/backups/backup.log 