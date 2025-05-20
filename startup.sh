#!/bin/bash
set -e

# 确保使用虚拟环境中的Python
export PATH="/opt/venv/bin:$PATH"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 检查并执行计划备份
check_and_run_scheduled_backups() {
    log "检查计划备份设置..."
    
    # 获取计划备份配置
    local SCHEDULE_API="http://localhost:80/api/backup/export-schedules"
    local SCHEDULE_DATA=$(curl -s -H "Cookie: session=$ADMIN_SESSION" "$SCHEDULE_API")
    
    if [[ $SCHEDULE_DATA == *"success\":true"* ]]; then
        log "成功获取计划备份配置"
        
        # 解析JSON并检查是否需要执行备份
        # 这里我们使用临时文件存储JSON
        local TEMP_FILE="/tmp/schedules.json"
        echo "$SCHEDULE_DATA" > "$TEMP_FILE"
        
        # 当前时间
        local CURRENT_HOUR=$(date +"%H")
        local CURRENT_MINUTE=$(date +"%M")
        local CURRENT_WEEKDAY=$(date +"%w")  # 0-6, 星期日是0
        local CURRENT_DAY=$(date +"%d")      # 01-31
        local TODAY=$(date +"%Y%m%d")
        
        # 使用Python解析JSON并决定是否执行备份
        python3 -c "
import json
import sys
import os

try:
    with open('$TEMP_FILE', 'r') as f:
        data = json.load(f)
    
    schedules = data.get('schedules', [])
    current_hour = int('$CURRENT_HOUR')
    current_minute = int('$CURRENT_MINUTE')
    current_weekday = int('$CURRENT_WEEKDAY')
    current_day = int('$CURRENT_DAY')
    today = '$TODAY'
    
    for schedule in schedules:
        config = schedule.get('config', {})
        frequency = config.get('frequency')
        schedule_time = config.get('time', '00:00')
        hour, minute = map(int, schedule_time.split(':'))
        
        # 检查是否应该在当前时间执行
        should_run = False
        
        if frequency == 'daily':
            # 每天执行，只要当前小时和分钟匹配
            should_run = (current_hour == hour and current_minute >= minute and current_minute < minute + 10)
        
        elif frequency == 'weekly':
            # 每周执行，需要检查星期几
            weekday = int(config.get('weekday', 0))
            should_run = (current_weekday == weekday and current_hour == hour and current_minute >= minute and current_minute < minute + 10)
        
        elif frequency == 'monthly':
            # 每月执行，需要检查日期
            day_of_month = int(config.get('dayOfMonth', 1))
            should_run = (current_day == day_of_month and current_hour == hour and current_minute >= minute and current_minute < minute + 10)
        
        # 检查是否今天已经执行过
        backup_marker = f\"/tmp/backup_schedule_{schedule['userId']}_{today}\"
        
        if should_run and not os.path.exists(backup_marker):
            print(f\"EXECUTE:{schedule['userId']}:{schedule['config']['retention']}:{','.join([db['host'] for db in schedule['databases']])}:{','.join([db['user'] for db in schedule['databases']])}\")
            # 创建标记文件
            with open(backup_marker, 'w') as f:
                f.write('executed')
except Exception as e:
    print(f\"ERROR: {str(e)}\")
    sys.exit(1)
" | while IFS= read -r line; do
            if [[ $line == EXECUTE:* ]]; then
                # 解析执行指令
                IFS=':' read -ra EXEC_PARTS <<< "$line"
                USER_ID="${EXEC_PARTS[1]}"
                RETENTION="${EXEC_PARTS[2]}"
                DB_HOSTS="${EXEC_PARTS[3]}"
                DB_USERS="${EXEC_PARTS[4]}"
                
                log "执行用户 $USER_ID 的计划备份，保留天数: $RETENTION"
                
                # 调用备份脚本
                # 这里你需要根据实际情况设置环境变量和调用backup.sh
                # /app/backup.sh
                
                log "用户 $USER_ID 的计划备份已完成"
            elif [[ $line == ERROR:* ]]; then
                log "解析计划备份配置时出错: ${line#ERROR: }"
            fi
        done
        
        # 清理临时文件
        rm -f "$TEMP_FILE"
    else
        log "获取计划备份配置失败或没有配置: $SCHEDULE_DATA"
    fi
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

# 测试MySQL连接
log "测试MySQL连接..."
if ! mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" --connect-timeout=10 -e "SELECT 1;" &>/dev/null; then
    log "错误: 无法连接到MySQL服务器，请检查连接信息和认证方式"
    exit 1
fi

# 执行初始备份测试
log "执行初始备份检查..."
if /app/backup.sh; then
    log "初始备份测试成功"
    log "MySQL备份服务已成功启动"
else
    log "初始备份测试失败，请检查日志获取详细信息"
    exit 1
fi

# 初始化管理员会话令牌 - 为了访问API获取计划备份配置
ADMIN_SESSION=""
log "正在获取管理员会话令牌..."
if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
    # 登录管理员账号获取会话
    LOGIN_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" "http://localhost:80/api/login")
    
    if [[ $LOGIN_RESPONSE == *"success\":true"* ]]; then
        # 从响应中提取会话ID
        ADMIN_SESSION=$(echo "$LOGIN_RESPONSE" | grep -o '"session":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$ADMIN_SESSION" ]; then
            log "成功获取管理员会话令牌"
        else
            log "无法从登录响应中提取会话令牌"
        fi
    else
        log "管理员登录失败，无法获取计划备份配置"
    fi
else
    log "未设置ADMIN_USERNAME或ADMIN_PASSWORD环境变量，将无法获取计划备份配置"
fi

# 启动内置定时任务（不依赖系统cron）
log "启动内置定时器，检查备份计划"

# 使用内部循环替代cron
while true; do
    # 获取当前小时
    CURRENT_HOUR=$(date +"%H")
    
    # 执行默认的系统计划备份（如果未配置用户自定义计划）
    if [ "$CURRENT_HOUR" = "04" ]; then
        # 检查是否已经在今天运行过备份
        TODAY=$(date +"%Y%m%d")
        BACKUP_MARKER="/tmp/backup_executed_$TODAY"
        
        if [ ! -f "$BACKUP_MARKER" ]; then
            log "开始执行每日默认定时备份..."
            /app/backup.sh
            
            # 创建标记文件，表示今天已经执行过备份
            touch "$BACKUP_MARKER"
            log "每日默认备份完成，下次将在明天凌晨4点执行"
        fi
    fi
    
    # 检查用户自定义的计划备份
    if [ -n "$ADMIN_SESSION" ]; then
        check_and_run_scheduled_backups
    fi
    
    # 每10分钟检查一次
    sleep 600
done 