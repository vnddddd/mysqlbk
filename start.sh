#!/bin/bash

# 创建必要的目录
mkdir -p /app/backups
mkdir -p /app/logs

# 输出配置信息
echo "MySQL备份服务已启动"
echo "--------------------"
echo "备份时间: 每天凌晨4点"
echo "MySQL主机: $MYSQL_HOST:$MYSQL_PORT"
echo "备份数据库: ${MYSQL_DATABASE:-'全部数据库'}"
echo "B2存储桶: $B2_BUCKET_NAME"
echo "--------------------"

# 启动crond
exec crond -f -d 8 