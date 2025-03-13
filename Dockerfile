FROM mysql:8.0-debian

# 安装必要的软件包
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    python3 \
    python3-pip \
    tzdata \
    cron \
    && pip3 install --no-cache-dir b2sdk

# 设置时区为中国标准时间
ENV TZ=Asia/Shanghai

# 创建备份目录
RUN mkdir -p /app/backups

# 复制脚本到容器
COPY backup.sh /app/
COPY startup.sh /app/

# 设置脚本执行权限
RUN chmod +x /app/backup.sh /app/startup.sh

# 设置定时任务
RUN echo "0 4 * * * /app/backup.sh >> /app/backup.log 2>&1" > /etc/cron.d/mysql-backup && \
    chmod 0644 /etc/cron.d/mysql-backup && \
    crontab /etc/cron.d/mysql-backup

# 工作目录
WORKDIR /app

# 启动命令
CMD ["/app/startup.sh"] 