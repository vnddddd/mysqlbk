#!/bin/bash
set -e

# 确保使用虚拟环境中的Python
export PATH="/opt/venv/bin:$PATH"

# 日志文件
LOG_FILE="/var/log/mysql-backup.log"

# 增强的日志函数 - 添加日志级别
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

# 检查是否有用户自定义的计划备份
check_user_schedules() {
    log_info "检查用户自定义的计划备份设置..."
    
    # 这里我们应该从KV存储中读取计划备份设置
    # 由于我们直接在bash脚本中无法访问Deno KV存储
    # 可以通过创建一个API端点来读取设置，或者从配置文件中读取
    
    # 示例：这里我们假设系统将计划备份设置写入到一个JSON文件中
    SCHEDULE_FILE="/app/data/backup_schedules.json"
    
    if [ -f "$SCHEDULE_FILE" ]; then
        log_info "找到计划备份配置文件，准备解析..."
        # 解析JSON并执行相应的备份
        # 这里需要使用例如jq等工具解析JSON
        # 根据频率、时间等执行备份
        
        # 验证JSON格式是否正确
        if ! python3 -c "import json; json.load(open('$SCHEDULE_FILE'))" 2>/dev/null; then
            log_error "计划备份配置文件格式不正确，无法解析JSON"
            return 1
        fi
        
        log_debug "计划备份配置文件格式正确，准备处理..."
    else
        log_warn "未找到用户自定义的计划备份配置文件: $SCHEDULE_FILE"
        log_info "将使用默认备份设置"
    fi
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
    log_error "缺少必要的MySQL环境变量"
    log_debug "DB_HOST=$DB_HOST, DB_USER=$DB_USER, DB_PASSWORD=*****, DB_NAMES=$DB_NAMES"
    exit 1
fi

if [ -z "$B2_APPLICATION_KEY_ID" ] || [ -z "$B2_APPLICATION_KEY" ] || [ -z "$B2_BUCKET_NAME" ]; then
    log_error "缺少必要的Backblaze B2环境变量"
    log_debug "B2_APPLICATION_KEY_ID=$B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY=*****, B2_BUCKET_NAME=$B2_BUCKET_NAME"
    exit 1
fi

# 创建日期格式的文件名
DATE=$(date +"%Y%m%d-%H%M%S")
BACKUP_DIR="/app/backups"
mkdir -p "$BACKUP_DIR"
log_debug "创建备份目录: $BACKUP_DIR"

# 测试数据库连接
log_info "测试MySQL连接 ($DB_HOST:$DB_PORT)..."
if ! mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" --connect-timeout=10 -e "SELECT 1;" &>/dev/null; then
    log_error "无法连接到MySQL服务器，请检查连接信息和认证方式"
    # 获取更详细的错误信息
    MYSQL_ERROR=$(mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" --connect-timeout=10 -e "SELECT 1;" 2>&1)
    log_error "MySQL连接错误: $MYSQL_ERROR"
    exit 1
fi

log_info "MySQL连接测试成功"

# 检查用户自定义的计划备份
check_user_schedules

# 备份每个数据库
IFS=',' read -ra DBS <<< "$DB_NAMES"
FAILED=0
BACKUP_COUNT=0
SUCCESSFUL_BACKUPS=0

log_info "开始备份 ${#DBS[@]} 个数据库: $DB_NAMES"

for DB in "${DBS[@]}"; do
    DB=$(echo "$DB" | xargs)  # 去除空格
    BACKUP_FILE="$BACKUP_DIR/backup-$DB-$DATE.sql.gz"
    ERROR_LOG="$BACKUP_DIR/error-$DB-$DATE.log"
    
    log_info "开始备份数据库: $DB => $BACKUP_FILE"
    BACKUP_COUNT=$((BACKUP_COUNT+1))
    
    # 执行备份，设置超时处理
    TIMEOUT_CMD=""
    if command -v timeout &> /dev/null; then
        TIMEOUT_CMD="timeout 3600"  # 1小时超时
        log_debug "使用timeout命令限制备份时间为1小时"
    fi
    
    # 尝试使用mysql_native_password认证执行备份
    log_debug "执行mysqldump命令备份数据库 $DB"
    $TIMEOUT_CMD mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" \
        --default-auth=mysql_native_password --column-statistics=0 --single-transaction --routines --triggers --events "$DB" 2>"$ERROR_LOG" | gzip > "$BACKUP_FILE"
    
    DUMP_STATUS=$?
    
    # 检查是否因超时而失败
    if [ $DUMP_STATUS -eq 124 ]; then
        log_error "备份数据库 $DB 失败: 操作超时(1小时)"
        FAILED=1
        continue
    fi
    
    # 检查错误日志和备份文件大小
    if [ $DUMP_STATUS -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
        # 检查备份文件是否只有头部信息（极小）
        if [ $(gzip -dc "$BACKUP_FILE" | head -20 | grep -c "MySQL dump") -gt 0 ] && [ $(stat -c%s "$BACKUP_FILE") -lt 1000 ]; then
            log_warn "数据库 $DB 备份文件异常小，可能只包含头信息，没有实际数据"
            if [ -s "$ERROR_LOG" ]; then
                log_error "备份过程中出现错误:"
                cat "$ERROR_LOG" | while read -r line; do
                    log_error "  $line"
                done
            fi
            FAILED=1
        else
            BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE")
            log_info "数据库 $DB 备份成功 (大小: $BACKUP_SIZE 字节)"
            SUCCESSFUL_BACKUPS=$((SUCCESSFUL_BACKUPS+1))
            
            if [ -f "$ERROR_LOG" ] && [ -s "$ERROR_LOG" ]; then
                log_warn "备份过程中出现警告:"
                cat "$ERROR_LOG" | while read -r line; do
                    log_warn "  $line"
                done
            else
                rm -f "$ERROR_LOG"
            fi
            
            # 上传到Backblaze B2
            log_info "开始上传备份到Backblaze B2: $B2_BUCKET_NAME"
            
            # 使用Python脚本上传到B2，增强错误处理
            python3 -c "
from b2sdk.v2 import InMemoryAccountInfo, B2Api
import sys
import os
import time

try:
    # 添加一些重试逻辑
    max_retries = 3
    retry_delay = 5  # 秒
    
    for attempt in range(max_retries):
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
            
            print(f'开始上传: {local_file} -> {b2_file_name}')
            
            file_size = os.path.getsize(local_file)
            print(f'文件大小: {file_size} 字节')
            
            uploaded_file = bucket.upload_local_file(
                local_file=local_file,
                file_name=b2_file_name,
            )
            
            print(f'上传成功: {local_file} -> {b2_file_name}')
            print(f'B2文件ID: {uploaded_file.id_}')
            break  # 成功则跳出重试循环
            
        except Exception as e:
            print(f'尝试 {attempt+1}/{max_retries} 失败: {str(e)}')
            if attempt < max_retries - 1:
                print(f'等待 {retry_delay} 秒后重试...')
                time.sleep(retry_delay)
                retry_delay *= 2  # 指数退避
            else:
                raise  # 重试耗尽，重新抛出异常
except Exception as e:
    print(f'上传失败: {str(e)}')
    sys.exit(1)
" 2>&1 | while read -r line; do
                log_info "B2上传: $line"
            done
            
            if [ ${PIPESTATUS[0]} -eq 0 ]; then
                log_info "备份成功上传到B2: $B2_BUCKET_NAME/mysql-backups/$(basename "$BACKUP_FILE")"
            else
                log_error "上传到B2失败"
                FAILED=1
            fi
        fi
    else
        log_error "数据库 $DB 备份失败"
        if [ -s "$ERROR_LOG" ]; then
            cat "$ERROR_LOG" | while read -r line; do
                log_error "  $line"
            done
        else
            log_error "  未知错误 (无错误日志)"
        fi
        FAILED=1
    fi
done

# 备份统计信息
log_info "备份统计: 总计 $BACKUP_COUNT 个数据库, 成功 $SUCCESSFUL_BACKUPS 个"

# 清理旧备份文件
if [ $BACKUP_COUNT -gt 0 ] && [ $SUCCESSFUL_BACKUPS -gt 0 ]; then
    log_info "清理$BACKUP_RETENTION_DAYS天前的本地备份文件"
    OLD_FILES=$(find "$BACKUP_DIR" -name "backup-*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS)
    if [ -n "$OLD_FILES" ]; then
        echo "$OLD_FILES" | while read -r file; do
            log_debug "删除旧备份: $file"
            rm -f "$file"
        done
        
        OLD_COUNT=$(echo "$OLD_FILES" | wc -l)
        log_info "已删除 $OLD_COUNT 个超过 $BACKUP_RETENTION_DAYS 天的旧备份文件"
    else
        log_info "没有找到超过 $BACKUP_RETENTION_DAYS 天的旧备份文件"
    fi
fi

# 返回状态
if [ $FAILED -eq 0 ]; then
    log_info "所有备份任务成功完成"
    exit 0
else
    log_error "备份过程中发生错误，有 $((BACKUP_COUNT-SUCCESSFUL_BACKUPS)) 个备份失败"
    exit 1
fi 