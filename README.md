# MySQL 远程数据库自动备份工具

这个工具可以自动备份远程MySQL数据库并上传到Backblaze B2云存储，专为在Railway等容器平台上运行设计。

## 功能特点

- 每天凌晨4点自动执行全量备份
- 支持备份多个数据库
- 自动上传备份到Backblaze B2云存储
- 自动清理本地旧备份文件
- 容器启动时执行初始备份测试

## 准备工作

### 1. 创建Backblaze B2账号和存储桶

1. 注册/登录[Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html)账号（提供10GB免费存储空间）
2. 创建一个新的存储桶用于备份存储
3. 创建应用密钥:
   - 进入"App Keys"页面
   - 点击"Add a New Application Key"
   - 为密钥命名（例如"mysql-backup"）
   - 选择刚创建的存储桶
   - 设置权限为"Read and Write"
   - 记下生成的`keyID`和`applicationKey`

### 2. 准备环境变量

需要设置以下环境变量:

- `DB_HOST`: MySQL主机地址
- `DB_PORT`: MySQL端口 (默认: 3306)
- `DB_USER`: MySQL用户名
- `DB_PASSWORD`: MySQL密码
- `DB_NAMES`: 要备份的数据库名称，多个用逗号分隔
- `B2_APPLICATION_KEY_ID`: Backblaze B2应用密钥ID
- `B2_APPLICATION_KEY`: Backblaze B2应用密钥
- `B2_BUCKET_NAME`: Backblaze B2存储桶名称
- `BACKUP_RETENTION_DAYS`: 本地备份保留天数 (默认: 7)

## 部署指南

### 在Railway上部署

1. 在Railway上创建新项目
2. 添加此仓库作为代码源
3. 添加必要的环境变量
4. 部署项目

### 本地测试

1. 安装Docker
2. 构建Docker镜像:
   ```
   docker build -t mysql-backup .
   ```
3. 运行容器:
   ```
   docker run -d \
     -e DB_HOST=your-mysql-host \
     -e DB_PORT=3306 \
     -e DB_USER=your-user \
     -e DB_PASSWORD=your-password \
     -e DB_NAMES=db1,db2 \
     -e B2_APPLICATION_KEY_ID=your-key-id \
     -e B2_APPLICATION_KEY=your-application-key \
     -e B2_BUCKET_NAME=your-bucket-name \
     -e BACKUP_RETENTION_DAYS=7 \
     mysql-backup
   ```

## 日志查看

可以通过以下命令查看备份日志:

```
docker logs <container_id>
```

在Railway上，直接在Railway提供的日志界面查看。

## 备份文件

备份文件格式为: `backup-<数据库名>-<日期时间>.sql.gz`

例如: `backup-mydb-20230101-040000.sql.gz`

## 故障排除

- 确保MySQL用户有足够的权限执行备份
- 验证Backblaze B2应用密钥是否有效
- 确保容器有足够的磁盘空间执行备份
- 检查网络连接是否允许连接到MySQL服务器和Backblaze B2

## 注意事项

- 确保数据库用户只有必要的读取权限，不要使用管理员账号
- 定期验证备份文件的完整性
- Backblaze B2免费层提供10GB存储空间，超出部分需要付费 