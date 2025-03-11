FROM alpine:3.14

# 安装必要的包
RUN apk add --no-cache mysql-client bash curl python3 py3-pip tzdata

# 设置时区为亚洲/上海
RUN cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 安装B2命令行工具
RUN pip3 install --no-cache-dir b2

# 创建工作目录
WORKDIR /app

# 复制脚本
COPY backup.sh /app/
COPY upload.sh /app/
COPY start.sh /app/

# 设置执行权限
RUN chmod +x /app/backup.sh /app/upload.sh /app/start.sh

# 设置cron任务
COPY crontab /etc/crontabs/root
RUN chmod 0644 /etc/crontabs/root

# 启动命令
CMD ["/app/start.sh"] 