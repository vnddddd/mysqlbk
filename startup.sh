#!/bin/bash
set -e

# 确保使用虚拟环境中的Python
export PATH="/opt/venv/bin:$PATH"

# 工作目录确保绝对路径
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

# 日志函数 - 增强版，添加日志级别和保存到文件
LOG_FILE="/var/log/mysql-backup.log"
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_line="[${level}] ${timestamp} - ${message}"
    
    # 输出到终端
    case "$level" in
      "ERROR") echo -e "\e[31m${log_line}\e[0m" ;;   # 红色
      "WARN")  echo -e "\e[33m${log_line}\e[0m" ;;   # 黄色
      "INFO")  echo -e "\e[32m${log_line}\e[0m" ;;   # 绿色
      "DEBUG") echo -e "\e[36m${log_line}\e[0m" ;;   # 青色
      *)       echo "$log_line" ;;
    esac
    
    # 同时保存到日志文件
    if [[ -n "$LOG_FILE" ]]; then
        echo "${log_line}" >> "$LOG_FILE"
    fi
}

# 为兼容性保留原来的log函数
log_info() {
    log "INFO" "$1"
}

log_warn() {
    log "WARN" "$1"
}

log_error() {
    log "ERROR" "$1"
}

log_debug() {
    log "DEBUG" "$1"
}

# 确保存储目录存在
ensure_directories() {
    # 创建备份和日志目录
    mkdir -p /app/backups
    mkdir -p /app/data
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    
    # 清理未删除的临时备份文件
    log_info "检查并清理可能未删除的临时备份文件..."
    OLD_BACKUP_FILES=$(find /app/backups -name "backup-*.sql.gz" -type f -mtime +1)
    if [ -n "$OLD_BACKUP_FILES" ]; then
        echo "$OLD_BACKUP_FILES" | while read -r file; do
            log_info "删除过期的临时备份文件: $file"
            rm -f "$file"
        done
        OLD_COUNT=$(echo "$OLD_BACKUP_FILES" | wc -l)
        log_info "已删除 $OLD_COUNT 个超过1天的临时备份文件"
    else
        log_info "没有找到需要清理的临时备份文件"
    fi
    
    log_info "已确保必要的目录存在"
}

# 检查并执行计划备份 - 优化版，使用缓存避免重复请求
SCHEDULE_CACHE_FILE="/tmp/schedule_cache.json"
SCHEDULE_CACHE_EXPIRY=600  # 缓存有效期10分钟

check_and_run_scheduled_backups() {
    log_info "检查计划备份设置..."
    
    # 检查缓存是否有效
    local refresh_cache=true
    if [[ -f "$SCHEDULE_CACHE_FILE" ]]; then
        local cache_age=$(($(date +%s) - $(stat -c %Y "$SCHEDULE_CACHE_FILE")))
        if [[ $cache_age -lt $SCHEDULE_CACHE_EXPIRY ]]; then
            log_debug "使用缓存的计划备份配置 (${cache_age}秒前更新)"
            refresh_cache=false
        else
            log_debug "缓存已过期 (${cache_age}秒), 重新获取"
        fi
    fi
    
    # 如果需要，刷新缓存
    if [[ "$refresh_cache" = true ]]; then
        # 获取计划备份配置
        local SCHEDULE_API="http://localhost:80/api/backup/export-schedules"
        log_debug "请求API: $SCHEDULE_API"
        
        local SCHEDULE_DATA=$(curl -s -H "Cookie: session=$ADMIN_SESSION" "$SCHEDULE_API")
        
        if [[ $SCHEDULE_DATA == *"success\":true"* ]]; then
            log_info "成功获取计划备份配置"
            echo "$SCHEDULE_DATA" > "$SCHEDULE_CACHE_FILE"
        else
            log_warn "获取计划备份配置失败或没有配置"
            log_debug "API响应: ${SCHEDULE_DATA:0:200}..."
            return 1
        fi
    fi
    
    # 从缓存读取数据
    local SCHEDULE_DATA=$(cat "$SCHEDULE_CACHE_FILE")
    
    # 解析JSON并检查是否需要执行备份
    # 这里使用Python来处理复杂的JSON解析和日期/时间比较
    local TEMP_FILE="/tmp/schedules.json"
    echo "$SCHEDULE_DATA" > "$TEMP_FILE"
    
    # 当前时间
    local CURRENT_HOUR=$(date +"%H")
    local CURRENT_MINUTE=$(date +"%M")
    local CURRENT_WEEKDAY=$(date +"%w")  # 0-6, 星期日是0
    local CURRENT_DAY=$(date +"%d")      # 01-31
    local TODAY=$(date +"%Y%m%d")
    
    log_debug "当前时间: ${CURRENT_HOUR}:${CURRENT_MINUTE}, 星期${CURRENT_WEEKDAY}, ${CURRENT_DAY}日"
    
    # 使用Python解析JSON并决定是否执行备份
    python3 -c "
import json
import sys
import os
import traceback

try:
    with open('$TEMP_FILE', 'r') as f:
        data = json.load(f)
    
    schedules = data.get('schedules', [])
    print(f'找到 {len(schedules)} 个计划备份配置')
    
    current_hour = int('$CURRENT_HOUR')
    current_minute = int('$CURRENT_MINUTE')
    current_weekday = int('$CURRENT_WEEKDAY')
    current_day = int('$CURRENT_DAY')
    today = '$TODAY'
    
    for i, schedule in enumerate(schedules):
        try:
            config = schedule.get('config', {})
            frequency = config.get('frequency')
            schedule_time = config.get('time', '00:00')
            hour, minute = map(int, schedule_time.split(':'))
            
            user_id = schedule.get('userId', 'unknown')
            username = schedule.get('username', 'unknown')
            
            print(f'检查计划 #{i+1}: 用户={username}, 频率={frequency}, 时间={schedule_time}')
            
            # 检查是否应该在当前时间执行
            should_run = False
            reason = ''
            
            if frequency == 'daily':
                # 每天执行，只要当前小时和分钟匹配
                should_run = (current_hour == hour and current_minute >= minute and current_minute < minute + 10)
                reason = f'每天 {hour}:{minute:02d}'
            
            elif frequency == 'weekly':
                # 每周执行，需要检查星期几
                weekday = int(config.get('weekday', 0))
                should_run = (current_weekday == weekday and current_hour == hour and current_minute >= minute and current_minute < minute + 10)
                weekday_names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
                reason = f'每周{weekday_names[weekday]} {hour}:{minute:02d}'
            
            elif frequency == 'monthly':
                # 每月执行，需要检查日期
                day_of_month = int(config.get('dayOfMonth', 1))
                should_run = (current_day == day_of_month and current_hour == hour and current_minute >= minute and current_minute < minute + 10)
                reason = f'每月{day_of_month}日 {hour}:{minute:02d}'
                
            backup_marker = f\"/tmp/backup_schedule_{user_id}_{today}\"
            
            if os.path.exists(backup_marker):
                print(f'今天已经执行过此计划 ({reason})')
                continue
                
            if should_run:
                print(f'需要执行计划备份: {reason}')
                # 数据库配置
                databases = schedule.get('databases', [])
                storage = schedule.get('storage', {})
                retention = config.get('retention', 7)
                
                # 输出执行指令，将被bash脚本捕获
                print(f\"EXECUTE:{user_id}:{retention}:{','.join([db.get('host', 'localhost') for db in databases])}:{','.join([db.get('user', 'root') for db in databases])}:{','.join([','.join(db.get('databases', [])) for db in databases])}:{storage.get('type', 'local')}:{storage.get('bucketName', '')}:{storage.get('applicationKeyId', '')}:{storage.get('applicationKey', '')}\")
                
                # 创建标记文件
                with open(backup_marker, 'w') as f:
                    f.write(f'executed at {hour}:{minute}')
            else:
                print(f'当前时间不匹配计划时间 ({reason})')
                
        except Exception as e:
            print(f\"WARNING: 处理计划 #{i+1} 时出错: {str(e)}\")
            traceback.print_exc()
except Exception as e:
    print(f\"ERROR: {str(e)}\")
    traceback.print_exc()
    sys.exit(1)
" 2>&1 | while IFS= read -r line; do
        if [[ $line == EXECUTE:* ]]; then
            # 解析执行指令
            IFS=':' read -ra EXEC_PARTS <<< "$line"
            USER_ID="${EXEC_PARTS[1]}"
            RETENTION="${EXEC_PARTS[2]}"
            DB_HOSTS="${EXEC_PARTS[3]}"
            DB_USERS="${EXEC_PARTS[4]}"
            DB_NAMES="${EXEC_PARTS[5]}"
            STORAGE_TYPE="${EXEC_PARTS[6]}"
            BUCKET_NAME="${EXEC_PARTS[7]}"
            APP_KEY_ID="${EXEC_PARTS[8]}"
            APP_KEY="${EXEC_PARTS[9]}"
            
            log_info "执行用户 $USER_ID 的计划备份, 保留天数: $RETENTION"
            log_info "数据库: $DB_NAMES"
            log_info "存储类型: $STORAGE_TYPE, 存储桶: $BUCKET_NAME"
            
            # 设置环境变量并调用备份脚本
            (
                export DB_HOST="$DB_HOSTS"
                export DB_USER="$DB_USERS"
                export DB_NAMES="$DB_NAMES"
                export BACKUP_RETENTION_DAYS="$RETENTION"
                
                # 如果使用云存储，设置相关环境变量
                if [[ "$STORAGE_TYPE" == "backblaze" && -n "$BUCKET_NAME" ]]; then
                    export B2_APPLICATION_KEY_ID="$APP_KEY_ID"
                    export B2_APPLICATION_KEY="$APP_KEY"
                    export B2_BUCKET_NAME="$BUCKET_NAME"
                fi
                
                log_info "开始执行备份脚本..."
                if /app/backup.sh; then
                    log_info "用户 $USER_ID 的计划备份成功完成"
                else
                    log_error "用户 $USER_ID 的计划备份失败，退出代码: $?"
                fi
            )
        elif [[ $line == ERROR:* ]]; then
            log_error "解析计划备份配置时出错: ${line#ERROR: }"
        elif [[ $line == WARNING:* ]]; then
            log_warn "${line#WARNING: }"
        else
            log_debug "$line"
        fi
    done
    
    # 清理临时文件
    rm -f "$TEMP_FILE"
    return 0
}

# 使用HTTP监控自己的健康状态
start_health_check_server() {
    log_info "启动健康检查HTTP服务器..."
    
    # 使用Python实现简单的HTTP服务器
    python3 -m http.server 8080 --bind 127.0.0.1 &
    HEALTH_SERVER_PID=$!
    
    log_info "健康检查服务器已启动，PID: $HEALTH_SERVER_PID"
}

# 主函数
main() {
    log_info "MySQL 备份服务启动中..."
    
    # 确保必要的目录存在
    ensure_directories
    
    # 检查环境变量
    log_info "验证环境变量配置..."
    if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAMES" ]; then
        log_error "错误: 缺少必要的MySQL环境变量"
        log_info "请确保设置以下环境变量:"
        log_info "- DB_HOST: MySQL主机地址"
        log_info "- DB_PORT: MySQL端口 (默认: 3306)"
        log_info "- DB_USER: MySQL用户名"
        log_info "- DB_PASSWORD: MySQL密码"
        log_info "- DB_NAMES: 要备份的数据库名称，多个用逗号分隔"
        exit 1
    fi
    
    if [ -z "$B2_APPLICATION_KEY_ID" ] || [ -z "$B2_APPLICATION_KEY" ] || [ -z "$B2_BUCKET_NAME" ]; then
        log_warn "警告: 缺少Backblaze B2环境变量，只会执行本地备份"
    }
    
    log_info "环境变量:"
    log_info "- BACKUP_RETENTION_DAYS: ${BACKUP_RETENTION_DAYS:-7} (本地备份保留天数)"
    log_info "- DB_HOST: $DB_HOST"
    log_info "- DB_PORT: ${DB_PORT:-3306}"
    log_info "- DB_USER: $DB_USER"
    log_info "- DB_NAMES: $DB_NAMES"
    
    # 测试MySQL连接
    log_info "测试MySQL连接..."
    if ! mysql --host="$DB_HOST" --port="${DB_PORT:-3306}" --user="$DB_USER" --password="$DB_PASSWORD" --connect-timeout=10 -e "SELECT 1;" &>/dev/null; then
        log_error "错误: 无法连接到MySQL服务器，请检查连接信息和认证方式"
        exit 1
    }
    
    # 初始化管理员会话令牌 - 为了访问API获取计划备份配置
    ADMIN_SESSION=""
    log_info "正在获取管理员会话令牌..."
    if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
        # 登录管理员账号获取会话
        LOGIN_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" "http://localhost:80/api/login")
        
        if [[ $LOGIN_RESPONSE == *"success\":true"* ]]; then
            # 从响应中提取会话ID
            ADMIN_SESSION=$(echo "$LOGIN_RESPONSE" | grep -o '"session":"[^"]*"' | cut -d'"' -f4)
            if [ -n "$ADMIN_SESSION" ]; then
                log_info "成功获取管理员会话令牌"
            } else {
                log_warn "无法从登录响应中提取会话令牌"
            }
        } else {
            log_warn "管理员登录失败，无法获取计划备份配置"
            log_debug "登录响应: ${LOGIN_RESPONSE:0:100}..."
        }
    } else {
        log_warn "未设置ADMIN_USERNAME或ADMIN_PASSWORD环境变量，将无法获取计划备份配置"
    }
    
    # 执行初始备份测试
    log_info "执行初始备份检查..."
    if /app/backup.sh; then
        log_info "初始备份测试成功"
        log_info "MySQL备份服务已成功启动"
    } else {
        log_error "初始备份测试失败，请检查日志获取详细信息"
        exit 1
    }
    
    # 启动健康检查服务器
    start_health_check_server
    
    # 启动内置定时任务（不依赖系统cron）
    log_info "启动内置定时器，检查备份计划"
    
    # 使用内部循环替代cron
    while true; do
        # 获取当前时间
        CURRENT_TIME=$(date +"%H:%M")
        CURRENT_HOUR=$(date +"%H")
        CURRENT_DATE=$(date +"%Y-%m-%d")
        
        log_debug "当前时间: $CURRENT_DATE $CURRENT_TIME"
        
        # 执行默认的系统计划备份（如果未配置用户自定义计划）
        if [ "$CURRENT_HOUR" = "04" ]; then
            # 检查是否已经在今天运行过备份
            TODAY=$(date +"%Y%m%d")
            BACKUP_MARKER="/tmp/backup_executed_$TODAY"
            
            if [ ! -f "$BACKUP_MARKER" ]; then
                log_info "开始执行每日默认定时备份..."
                
                # 记录开始时间
                BACKUP_START_TIME=$(date +%s)
                
                # 执行备份
                if /app/backup.sh; then
                    BACKUP_END_TIME=$(date +%s)
                    BACKUP_DURATION=$((BACKUP_END_TIME - BACKUP_START_TIME))
                    
                    # 创建标记文件，表示今天已经执行过备份
                    touch "$BACKUP_MARKER"
                    log_info "每日默认备份完成，耗时: ${BACKUP_DURATION}秒, 下次将在明天凌晨4点执行"
                } else {
                    log_error "每日默认备份失败"
                }
            }
        }
        
        # 检查用户自定义的计划备份
        if [ -n "$ADMIN_SESSION" ]; then
            check_and_run_scheduled_backups
        }
        
        # 每5分钟检查一次
        log_debug "休眠300秒..."
        sleep 300
    done
}

# 执行主函数
main 