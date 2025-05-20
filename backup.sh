#!/bin/bash
set -e

# 确保使用虚拟环境中的Python
export PATH="/opt/venv/bin:$PATH"

# 日志文件
LOG_FILE="/var/log/mysql-backup.log"

# 备份开始时间
BACKUP_START_TIME=$(date +%s)

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

# 记录系统资源使用情况
log_system_resources() {
    log_debug "====== 系统资源使用情况 ======"
    
    # 记录内存使用情况
    if command -v free &> /dev/null; then
        log_debug "内存使用情况:"
        free -h | while read -r line; do
            log_debug "  $line"
        done
    fi
    
    # 记录磁盘使用情况
    if command -v df &> /dev/null; then
        log_debug "磁盘使用情况:"
        df -h | while read -r line; do
            log_debug "  $line"
        done
    fi
    
    # 记录CPU负载
    if [ -f "/proc/loadavg" ]; then
        local loadavg=$(cat /proc/loadavg)
        log_debug "CPU负载: $loadavg"
    fi
    
    # 记录当前进程的资源使用情况
    if command -v ps &> /dev/null; then
        log_debug "当前进程资源使用情况:"
        ps aux | grep -E 'mysqldump|mysql|gzip|python' | grep -v 'grep' | while read -r line; do
            log_debug "  $line"
        done
    fi
    
    log_debug "====== 系统资源使用情况结束 ======"
}

# 记录执行时间
log_execution_time() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local hours=$((duration / 3600))
    local minutes=$(( (duration % 3600) / 60 ))
    local seconds=$((duration % 60))
    
    log_info "执行时间: ${hours}小时 ${minutes}分钟 ${seconds}秒"
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
        # 验证JSON格式是否正确
        if ! python3 -c "import json; json.load(open('$SCHEDULE_FILE'))" 2>/dev/null; then
            log_error "计划备份配置文件格式不正确，无法解析JSON"
            return 1
        fi
        
        log_debug "计划备份配置文件格式正确，准备处理..."
        
        # 显示配置内容
        log_debug "计划备份配置内容:"
        cat "$SCHEDULE_FILE" | while read -r line; do
            log_debug "  $line"
        done
    else
        log_warn "未找到用户自定义的计划备份配置文件: $SCHEDULE_FILE"
        log_info "将使用默认备份设置"
    fi
}

# 记录脚本开始执行
log_info "====== 开始执行MySQL备份脚本 ======"
log_info "脚本启动时间: $(date)"
log_info "运行环境: $(uname -a)"
log_system_resources

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
log_debug "备份目录内容:"
ls -la "$BACKUP_DIR" | while read -r line; do
    log_debug "  $line"
done

# 测试数据库连接
log_info "测试MySQL连接 ($DB_HOST:$DB_PORT)..."
MYSQL_CONNECTION_START=$(date +%s)

if ! mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" --connect-timeout=10 -e "SELECT 1;" &>/dev/null; then
    log_error "无法连接到MySQL服务器，请检查连接信息和认证方式"
    # 获取更详细的错误信息
    MYSQL_ERROR=$(mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" --connect-timeout=10 -e "SELECT 1;" 2>&1)
    log_error "MySQL连接错误: $MYSQL_ERROR"
    exit 1
fi

log_info "MySQL连接测试成功 (耗时: $(($(date +%s) - MYSQL_CONNECTION_START)) 秒)"

# 收集MySQL服务器信息
log_debug "MySQL服务器信息:"
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" -e "SHOW VARIABLES LIKE 'version%';" | while read -r line; do
    log_debug "  $line"
done

# 检查用户自定义的计划备份
check_user_schedules

# 备份每个数据库
IFS=',' read -ra DBS <<< "$DB_NAMES"
FAILED=0
BACKUP_COUNT=0
SUCCESSFUL_BACKUPS=0

log_info "开始备份 ${#DBS[@]} 个数据库: $DB_NAMES"

# 每个数据库之间等待的秒数
DELAY_BETWEEN_BACKUPS=10

for DB in "${DBS[@]}"; do
    DB=$(echo "$DB" | xargs)  # 去除空格
    BACKUP_FILE="$BACKUP_DIR/backup-$DB-$DATE.sql.gz"
    ERROR_LOG="$BACKUP_DIR/error-$DB-$DATE.log"
    
    DB_BACKUP_START=$(date +%s)
    log_info "开始备份数据库: $DB => $BACKUP_FILE (开始时间: $(date))"
    BACKUP_COUNT=$((BACKUP_COUNT+1))
    
    # 对于不是第一个数据库的情况，添加延迟
    if [ $BACKUP_COUNT -gt 1 ]; then
        log_info "等待 $DELAY_BETWEEN_BACKUPS 秒后开始下一个数据库备份..."
        sleep $DELAY_BETWEEN_BACKUPS
        log_info "延迟结束，开始备份数据库: $DB"
    fi
    
    # 检查数据库是否存在
    log_debug "检查数据库 $DB 是否存在..."
    DB_EXISTS=$(mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" -e "SHOW DATABASES LIKE '$DB';" | grep -c "$DB")
    
    if [ "$DB_EXISTS" -eq 0 ]; then
        log_error "数据库 $DB 不存在！跳过此数据库的备份。"
        FAILED=1
        continue
    fi
    
    # 获取数据库大小信息
    log_debug "获取数据库 $DB 大小信息..."
    mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" -e "
    SELECT 
        table_schema AS 'Database',
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
    FROM information_schema.tables
    WHERE table_schema = '$DB'
    GROUP BY table_schema;" | while read -r line; do
        log_debug "  $line"
    done
    
    # 记录系统资源使用情况
    log_system_resources
    
    # 执行备份，设置超时处理
    TIMEOUT_CMD=""
    if command -v timeout &> /dev/null; then
        TIMEOUT_CMD="timeout 1800"  # 30分钟超时，降低单表超时时间
        log_debug "使用timeout命令限制备份时间为30分钟"
    fi
    
    # 尝试使用mysql_native_password认证执行备份
    log_debug "执行mysqldump命令备份数据库 $DB (命令开始时间: $(date))"
    MYSQLDUMP_START=$(date +%s)
    
    # 记录完整的mysqldump命令（隐藏密码）
    log_debug "执行命令: $TIMEOUT_CMD mysqldump --host=\"$DB_HOST\" --port=\"$DB_PORT\" --user=\"$DB_USER\" --password=***** --default-auth=mysql_native_password --column-statistics=0 --single-transaction --routines --triggers --events \"$DB\" | gzip > \"$BACKUP_FILE\""
    
    $TIMEOUT_CMD mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" \
        --default-auth=mysql_native_password --column-statistics=0 --single-transaction --routines --triggers --events "$DB" 2>"$ERROR_LOG" | gzip > "$BACKUP_FILE"
    
    DUMP_STATUS=$?
    MYSQLDUMP_END=$(date +%s)
    MYSQLDUMP_DURATION=$((MYSQLDUMP_END - MYSQLDUMP_START))
    
    log_debug "mysqldump命令执行完成，耗时: $MYSQLDUMP_DURATION 秒，状态码: $DUMP_STATUS"
    
    # 检查是否因超时而失败
    if [ $DUMP_STATUS -eq 124 ]; then
        log_error "备份数据库 $DB 失败: 操作超时(30分钟)"
        FAILED=1
        continue
    fi
    
    # 检查错误日志和备份文件大小
    if [ $DUMP_STATUS -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
        # 检查备份文件是否只有头部信息（极小）
        FILESIZE=$(stat -c%s "$BACKUP_FILE")
        log_debug "备份文件大小: $FILESIZE 字节"
        
        HEADER_CHECK=$(gzip -dc "$BACKUP_FILE" | head -20 | grep -c "MySQL dump")
        log_debug "文件头部检查结果: MySQL dump出现次数=$HEADER_CHECK"
        
        if [ $HEADER_CHECK -gt 0 ] && [ $FILESIZE -lt 1000 ]; then
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
            READABLE_SIZE=$(numfmt --to=iec-i --suffix=B $BACKUP_SIZE 2>/dev/null || echo "$BACKUP_SIZE 字节")
            log_info "数据库 $DB 备份成功 (大小: $READABLE_SIZE, 耗时: $MYSQLDUMP_DURATION 秒)"
            SUCCESSFUL_BACKUPS=$((SUCCESSFUL_BACKUPS+1))
            
            if [ -f "$ERROR_LOG" ] && [ -s "$ERROR_LOG" ]; then
                log_warn "备份过程中出现警告:"
                cat "$ERROR_LOG" | while read -r line; do
                    log_warn "  $line"
                done
            else
                rm -f "$ERROR_LOG"
            fi
            
            # 在备份和上传之间添加短暂延迟，让系统有时间处理
            log_info "备份完成，等待 5 秒后开始上传..."
            sleep 5
            
            # 上传到Backblaze B2
            log_info "开始上传备份到Backblaze B2: $B2_BUCKET_NAME (开始时间: $(date))"
            UPLOAD_START=$(date +%s)
            
            # 记录系统资源使用情况
            log_system_resources
            
            # 使用Python脚本上传到B2，增强错误处理
            python3 -c "
from b2sdk.v2 import InMemoryAccountInfo, B2Api
import sys
import os
import time
import traceback

try:
    # 添加一些重试逻辑
    max_retries = 3
    retry_delay = 5  # 秒
    
    for attempt in range(max_retries):
        try:
            print(f'尝试上传 - 第 {attempt+1}/{max_retries} 次')
            print(f'系统时间: {time.strftime(\"%Y-%m-%d %H:%M:%S\")}')
            
            # 认证B2
            info = InMemoryAccountInfo()
            b2_api = B2Api(info)
            print('开始B2认证...')
            b2_api.authorize_account('production', '$B2_APPLICATION_KEY_ID', '$B2_APPLICATION_KEY')
            print('B2认证成功')
            
            # 获取桶
            print(f'获取存储桶: {\"$B2_BUCKET_NAME\"}')
            bucket = b2_api.get_bucket_by_name('$B2_BUCKET_NAME')
            print(f'存储桶获取成功: {bucket.name}')
            
            # 上传文件
            local_file = '$BACKUP_FILE'
            b2_file_name = 'mysql-backups/' + os.path.basename(local_file)
            
            print(f'开始上传: {local_file} -> {b2_file_name}')
            
            file_size = os.path.getsize(local_file)
            print(f'文件大小: {file_size} 字节')
            
            upload_start = time.time()
            uploaded_file = bucket.upload_local_file(
                local_file=local_file,
                file_name=b2_file_name,
            )
            upload_end = time.time()
            upload_duration = upload_end - upload_start
            
            print(f'上传成功: {local_file} -> {b2_file_name}')
            print(f'上传耗时: {upload_duration:.2f} 秒')
            print(f'上传速度: {file_size/upload_duration/1024:.2f} KB/s')
            print(f'B2文件ID: {uploaded_file.id_}')
            
            # 上传成功后立即删除本地备份文件
            print(f'上传成功，删除本地备份文件: {local_file}')
            try:
                os.remove(local_file)
                print(f'本地备份文件已删除: {local_file}')
            except Exception as e:
                print(f'删除本地备份文件失败: {str(e)}')
            
            break  # 成功则跳出重试循环
            
        except Exception as e:
            print(f'尝试 {attempt+1}/{max_retries} 失败: {str(e)}')
            print(f'错误详情: {traceback.format_exc()}')
            if attempt < max_retries - 1:
                print(f'等待 {retry_delay} 秒后重试...')
                time.sleep(retry_delay)
                retry_delay *= 2  # 指数退避
            else:
                raise  # 重试耗尽，重新抛出异常
except Exception as e:
    print(f'上传失败: {str(e)}')
    print(f'错误详情: {traceback.format_exc()}')
    sys.exit(1)
" 2>&1 | while read -r line; do
                log_info "B2上传: $line"
            done
            
            UPLOAD_STATUS=${PIPESTATUS[0]}
            UPLOAD_END=$(date +%s)
            UPLOAD_DURATION=$((UPLOAD_END - UPLOAD_START))
            
            if [ $UPLOAD_STATUS -eq 0 ]; then
                log_info "备份成功上传到B2: $B2_BUCKET_NAME/mysql-backups/$(basename "$BACKUP_FILE") (耗时: $UPLOAD_DURATION 秒)"
            else
                log_error "上传到B2失败 (耗时: $UPLOAD_DURATION 秒, 状态码: $UPLOAD_STATUS)"
                FAILED=1
            fi
        fi
    else
        log_error "数据库 $DB 备份失败 (状态码: $DUMP_STATUS)"
        if [ -s "$ERROR_LOG" ]; then
            log_error "备份错误日志内容:"
            cat "$ERROR_LOG" | while read -r line; do
                log_error "  $line"
            done
        else
            log_error "  未知错误 (无错误日志)"
        fi
        FAILED=1
    fi
    
    DB_BACKUP_END=$(date +%s)
    DB_BACKUP_DURATION=$((DB_BACKUP_END - DB_BACKUP_START))
    log_info "数据库 $DB 备份过程完成 (总耗时: $DB_BACKUP_DURATION 秒)"
    
    # 在数据库备份循环结束时记录系统资源状态
    log_system_resources
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

# 记录最终系统资源状态
log_system_resources

# 记录脚本执行的总时间
log_info "====== 备份脚本执行完毕 ======"
log_execution_time $BACKUP_START_TIME

# 返回状态
if [ $FAILED -eq 0 ]; then
    log_info "所有备份任务成功完成"
    exit 0
else
    log_error "备份过程中发生错误，有 $((BACKUP_COUNT-SUCCESSFUL_BACKUPS)) 个备份失败"
    exit 1
fi 