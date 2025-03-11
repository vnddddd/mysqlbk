# MySQL自动备份方案

这是一个用于自动备份远程MySQL数据库的Docker容器方案，并将备份文件上传到BackBlaze B2云存储。

## 功能

- 每天凌晨4点自动执行全量备份
- 备份文件使用gzip压缩
- 自动上传备份到BackBlaze B2云存储
- 自动清理7天前的本地备份文件
- 自动清理30天前的日志文件
- 每小时检测MySQL连接状态

## 部署到Railway

1. 在BackBlaze B2创建账号和存储桶
   - 注册BackBlaze B2账号：https://www.backblaze.com/b2/sign-up.html
   - 创建一个存储桶用于备份
   - 创建一个应用密钥，确保有上传权限

2. 在Railway平台上配置环境变量

   必须配置以下环境变量：
   ```
   MYSQL_HOST=your-mysql-host
   MYSQL_PORT=3306
   MYSQL_USER=your-mysql-username
   MYSQL_PASSWORD=your-mysql-password
   MYSQL_DATABASE=your-database-name  # 如果留空将备份所有数据库
   
   B2_APPLICATION_KEY_ID=your-b2-application-key-id
   B2_APPLICATION_KEY=your-b2-application-key
   B2_BUCKET_NAME=your-b2-bucket-name
   ```

3. 部署到Railway
   - 从GitHub导入此仓库
   - 配置上述环境变量
   - 完成部署

## 手动触发备份

如果需要手动触发备份，可以在Railway的Shell中运行：

```
/app/backup.sh
```

## 查看备份日志

备份日志保存在 `/app/logs/backup.log` 文件中。

## 注意事项

- 确保你的MySQL用户有足够的权限执行备份
- B2免费账户提供10GB存储空间，请注意监控使用情况
- 根据你的数据库大小，可能需要调整Railway的磁盘空间配置 