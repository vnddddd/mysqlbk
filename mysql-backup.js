// MySQL 备份服务 - Done 平台版本
// 使用直接查询方式实现纯 JavaScript 的 MySQL 备份

// 导入必要的库
import mysql from "npm:mysql2/promise";
import { gzip } from "https://deno.land/x/compress@v0.4.5/mod.ts";

// 日志函数
function logInfo(message) {
  console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
}

function logError(message, error) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
  if (error) {
    console.error(`Details: ${error.message}`);
    if (error.stack) {
      console.error(`Stack: ${error.stack}`);
    }
  }
}

// 创建一个简单的 HTTP 服务器
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/backup") {
    try {
      logInfo("收到备份请求");
      const result = await performBackup();
      logInfo(`备份完成: ${JSON.stringify(result)}`);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    } catch (error) {
      logError("备份失败", error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
  } else if (path === "/health") {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } else {
    return new Response(`
      <html>
        <head>
          <title>MySQL 备份服务</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            h1, h2 {
              color: #333;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
            }
            .info {
              background-color: #f8f9fa;
              border-left: 4px solid #17a2b8;
              padding: 15px;
              margin: 20px 0;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
            }
            code {
              background-color: #f5f5f5;
              padding: 2px 4px;
              border-radius: 4px;
              font-family: monospace;
            }
            ul {
              margin-top: 10px;
            }
            .button {
              display: inline-block;
              background-color: #4CAF50;
              color: white;
              padding: 10px 15px;
              text-align: center;
              text-decoration: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
              margin-top: 20px;
            }
            .button:hover {
              background-color: #45a049;
            }
          </style>
        </head>
        <body>
          <h1>MySQL 备份服务</h1>

          <div class="info">
            <p>这是一个使用纯 JavaScript 实现的 MySQL 备份服务，不依赖系统命令。</p>
            <p>此服务使用直接查询数据库的方式生成 SQL 备份文件，适用于 Done 平台。</p>
          </div>

          <h2>API 端点</h2>
          <ul>
            <li><code>/</code> - 显示此信息页面</li>
            <li><code>/backup</code> - 执行数据库备份并返回结果</li>
            <li><code>/health</code> - 健康检查端点</li>
          </ul>

          <div class="warning">
            <p><strong>注意：</strong> 此备份方法适用于中小型数据库。对于大型数据库，建议使用支持系统命令的平台或专门的备份服务。</p>
          </div>

          <a href="/backup" class="button">执行备份</a>
        </body>
      </html>
    `, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
});

// 执行数据库备份
async function performBackup() {
  logInfo("开始执行数据库备份...");

  // 从环境变量获取数据库连接信息
  const DB_HOST = Deno.env.get("DB_HOST") || "";
  const DB_PORT = parseInt(Deno.env.get("DB_PORT") || "3306");
  const DB_USER = Deno.env.get("DB_USER") || "";
  const DB_PASSWORD = Deno.env.get("DB_PASSWORD") || "";
  const DB_NAMES = Deno.env.get("DB_NAMES") || "";

  // Backblaze B2 配置
  const B2_APPLICATION_KEY_ID = Deno.env.get("B2_APPLICATION_KEY_ID") || "";
  const B2_APPLICATION_KEY = Deno.env.get("B2_APPLICATION_KEY") || "";
  const B2_BUCKET_NAME = Deno.env.get("B2_BUCKET_NAME") || "";

  // 备份保留天数
  const BACKUP_RETENTION_DAYS = parseInt(Deno.env.get("BACKUP_RETENTION_DAYS") || "7");

  // 验证环境变量
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAMES) {
    const errorMsg = `缺少必要的数据库连接信息:
      DB_HOST=${DB_HOST ? '已设置' : '未设置'},
      DB_USER=${DB_USER ? '已设置' : '未设置'},
      DB_PASSWORD=${DB_PASSWORD ? '已设置' : '未设置'},
      DB_NAMES=${DB_NAMES ? '已设置' : '未设置'}`;
    logError(errorMsg);
    throw new Error(errorMsg);
  }

  // 验证 B2 配置
  if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
    const errorMsg = `缺少必要的 Backblaze B2 配置:
      B2_APPLICATION_KEY_ID=${B2_APPLICATION_KEY_ID ? '已设置' : '未设置'},
      B2_APPLICATION_KEY=${B2_APPLICATION_KEY ? '已设置' : '未设置'},
      B2_BUCKET_NAME=${B2_BUCKET_NAME ? '已设置' : '未设置'}`;
    logError(errorMsg);
    throw new Error(errorMsg);
  }

  logInfo("连接到数据库...");

  try {
    // 解析数据库名称列表
    const databases = DB_NAMES.split(',').map(db => db.trim());
    logInfo(`需要备份的数据库: ${databases.join(', ')}`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let allBackupContent = "";
    let failedDatabases = [];
    let successDatabases = [];

    // Done 平台不允许创建目录，所以我们将直接在内存中处理备份
    // 不再尝试创建临时目录，而是直接上传到 B2
    logInfo("Done 平台环境下，跳过本地目录创建，将直接上传到 B2");

    // 逐个备份数据库
    for (const dbName of databases) {
      // 生成文件名，不再使用本地路径
      const gzipFileName = `backup-${dbName}-${timestamp}.sql.gz`;
      const b2FileName = `mysql-backups/${gzipFileName}`; // 添加文件夹路径

      logInfo(`开始备份数据库: ${dbName}`);

      // 执行备份
      let backupString = "";

      try {
        // 直接使用查询方式备份数据库
        logInfo(`使用直接查询方式备份数据库 ${dbName}...`);
        backupString = await fallbackBackup(DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, dbName);

        // 备份成功，添加到成功列表
        successDatabases.push(dbName);

        // 压缩备份内容
        logInfo(`压缩备份内容...`);
        const textEncoder = new TextEncoder();
        const backupData = textEncoder.encode(backupString);
        const compressedData = await gzip(backupData);
        logInfo(`压缩完成，原始大小: ${backupData.length} 字节，压缩后: ${compressedData.length} 字节`);

        // 不再尝试保存到本地文件，直接上传到 B2

        // 上传到 Backblaze B2
        try {
          // 使用压缩后的数据上传，添加重试逻辑
          const maxRetries = 3;
          let retryCount = 0;
          let uploadSuccess = false;

          while (retryCount < maxRetries && !uploadSuccess) {
            try {
              await uploadToB2(compressedData, b2FileName, B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME);
              logInfo(`数据库 ${dbName} 备份已上传到 B2: ${b2FileName}`);
              uploadSuccess = true;
            } catch (retryError) {
              retryCount++;
              if (retryCount < maxRetries) {
                logInfo(`上传失败，正在进行第 ${retryCount} 次重试...`);
                // 指数退避策略，等待时间随重试次数增加
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
              } else {
                throw retryError; // 重试次数用完，抛出最后一次的错误
              }
            }
          }
        } catch (uploadError) {
          logError(`上传数据库 ${dbName} 备份到 B2 失败`, uploadError);
        }

        // 累加所有备份内容（未压缩的）
        allBackupContent += backupString;
      } catch (backupError) {
        logError(`备份数据库 ${dbName} 失败`, backupError);
        failedDatabases.push(dbName);
      }
    }

    // 清理旧备份
    try {
      await cleanupOldBackups(BACKUP_RETENTION_DAYS);
    } catch (cleanupError) {
      logError("清理旧备份失败", cleanupError);
    }

    // 返回备份结果
    logInfo(`备份完成。成功: ${successDatabases.length} 个数据库，失败: ${failedDatabases.length} 个数据库`);

    return {
      success: failedDatabases.length === 0,
      timestamp: new Date().toISOString(),
      databases: {
        total: databases.length,
        success: successDatabases,
        failed: failedDatabases
      },
      totalBackupSize: allBackupContent.length,
      message: failedDatabases.length === 0
        ? "所有数据库备份成功完成"
        : `部分数据库备份失败: ${failedDatabases.join(', ')}`
    };
  } catch (error) {
    logError("备份过程中出错", error);
    throw error;
  }
}

// 定时备份功能
async function setupScheduledBackups() {
  // 每天凌晨4点执行备份
  const BACKUP_HOUR = 4;

  logInfo(`设置定时备份任务，将在每天凌晨 ${BACKUP_HOUR} 点执行`);

  // 检查是否需要执行备份的函数
  async function checkAndRunBackup() {
    const now = new Date();
    const hour = now.getHours();

    // 如果是指定的备份时间
    if (hour === BACKUP_HOUR) {
      const today = now.toISOString().substring(0, 10);
      const backupMarker = `/tmp/backup_executed_${today}`;

      try {
        // 检查今天是否已经执行过备份
        await Deno.stat(backupMarker);
        // 文件存在，今天已经备份过
      } catch {
        // 文件不存在，执行备份
        logInfo("开始执行每日定时备份...");
        try {
          const result = await performBackup();
          // 创建标记文件，表示今天已经执行过备份
          await Deno.writeTextFile(backupMarker, JSON.stringify(result));

          if (result.success) {
            logInfo(`每日备份完成，成功备份了 ${result.databases.success.length} 个数据库`);
          } else {
            logInfo(`每日备份部分完成，成功: ${result.databases.success.length} 个，失败: ${result.databases.failed.length} 个`);
          }

          logInfo("下次备份将在明天凌晨执行");
        } catch (error) {
          logError("定时备份失败", error);
        }
      }
    }
  }

  // 每10分钟检查一次
  setInterval(checkAndRunBackup, 10 * 60 * 1000);

  // 立即检查一次
  await checkAndRunBackup();
}

// 启动定时备份
setupScheduledBackups().catch(error => {
  logError("设置定时备份失败", error);
});

// 上传备份到 Backblaze B2
async function uploadToB2(contentOrFilePath, fileName, keyId, applicationKey, bucketName) {
  logInfo(`开始上传 ${fileName} 到 Backblaze B2...`);

  try {
    // 准备内容
    let content;
    let contentType = "application/octet-stream";

    if (contentOrFilePath instanceof Uint8Array) {
      // 已经是二进制数据
      content = contentOrFilePath;
      logInfo(`使用提供的二进制数据，大小: ${content.length} 字节`);

      // 根据文件扩展名设置内容类型
      if (fileName.endsWith('.sql')) {
        contentType = "text/plain";
      } else if (fileName.endsWith('.gz')) {
        contentType = "application/gzip";
      }
    } else if (typeof contentOrFilePath === 'string' && contentOrFilePath.startsWith('/')) {
      // 是文件路径
      try {
        content = await Deno.readFile(contentOrFilePath);
        logInfo(`从文件 ${contentOrFilePath} 读取内容成功，大小: ${content.length} 字节`);

        // 根据文件扩展名设置内容类型
        if (contentOrFilePath.endsWith('.sql')) {
          contentType = "text/plain";
        } else if (contentOrFilePath.endsWith('.gz')) {
          contentType = "application/gzip";
        }
      } catch (readError) {
        logError(`读取文件 ${contentOrFilePath} 失败: ${readError.message}`);
        // 如果读取文件失败，尝试将路径字符串作为内容
        content = new TextEncoder().encode(contentOrFilePath);
        contentType = "text/plain";
      }
    } else {
      // 是字符串内容
      content = new TextEncoder().encode(contentOrFilePath);
      contentType = "text/plain";
    }

    // 步骤 1: 获取授权令牌（添加重试逻辑）
    logInfo("获取 B2 授权令牌...");

    // 定义重试函数
    async function fetchWithRetry(url, options, maxRetries = 3) {
      let lastError;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch(url, options);
          if (response.ok) {
            return response;
          }
          const errorText = await response.text();
          lastError = new Error(`请求失败: ${response.status} ${errorText}`);
        } catch (error) {
          lastError = error;
        }

        // 如果不是最后一次尝试，则等待后重试
        if (attempt < maxRetries - 1) {
          const waitTime = 1000 * Math.pow(2, attempt); // 指数退避
          logInfo(`API 请求失败，${waitTime}ms 后重试 (${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      throw lastError;
    }

    const authResponse = await fetchWithRetry("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: {
        "Authorization": `Basic ${btoa(`${keyId}:${applicationKey}`)}`
      }
    });

    const authData = await authResponse.json();
    const { authorizationToken, apiUrl } = authData;

    // 步骤 2: 获取存储桶 ID
    logInfo("获取存储桶 ID...");
    const listBucketsResponse = await fetchWithRetry(`${apiUrl}/b2api/v2/b2_list_buckets`, {
      method: "POST",
      headers: {
        "Authorization": authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accountId: authData.accountId
      })
    });

    const bucketsData = await listBucketsResponse.json();
    logInfo(`找到 ${bucketsData.buckets.length} 个存储桶`);

    // 打印所有存储桶名称，帮助调试
    for (const b of bucketsData.buckets) {
      logInfo(`存储桶: ${b.bucketName}, ID: ${b.bucketId}`);
    }

    const bucket = bucketsData.buckets.find(b => b.bucketName === bucketName);

    if (!bucket) {
      throw new Error(`未找到存储桶: ${bucketName}`);
    }

    logInfo(`使用存储桶: ${bucket.bucketName}, ID: ${bucket.bucketId}`);

    // 步骤 3: 获取上传 URL
    logInfo("获取 B2 上传 URL...");
    const getUploadUrlResponse = await fetchWithRetry(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: "POST",
      headers: {
        "Authorization": authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bucketId: bucket.bucketId
      })
    });

    const uploadUrlData = await getUploadUrlResponse.json();
    logInfo(`获取上传 URL 成功: ${JSON.stringify(uploadUrlData)}`);

    // 确保我们有上传 URL 和上传授权令牌
    if (!uploadUrlData.uploadUrl || !uploadUrlData.authorizationToken) {
      throw new Error(`获取上传 URL 成功，但缺少必要的字段: ${JSON.stringify(uploadUrlData)}`);
    }

    const uploadUrl = uploadUrlData.uploadUrl;
    const uploadAuthorizationToken = uploadUrlData.authorizationToken;

    // 步骤 3: 上传文件
    logInfo(`上传文件 ${fileName} 到 B2...`);
    logInfo(`使用上传 URL: ${uploadUrl}`);
    logInfo(`使用上传授权令牌: ${uploadAuthorizationToken.substring(0, 10)}...`);

    // 计算 SHA1 哈希值
    const contentSha1 = await calculateSha1(content);
    logInfo(`文件 SHA1: ${contentSha1}`);

    const uploadResponse = await fetchWithRetry(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": uploadAuthorizationToken,
        "Content-Type": contentType,
        "Content-Length": content.length.toString(),
        "X-Bz-File-Name": encodeURIComponent(fileName),
        "X-Bz-Content-Sha1": contentSha1
      },
      body: content
    });

    const uploadResult = await uploadResponse.json();
    logInfo(`文件 ${fileName} 上传成功，B2 文件 ID: ${uploadResult.fileId}`);

    return true;
  } catch (error) {
    logError(`上传到 B2 失败: ${error.message}`);
    throw error;
  }
}

// 计算 SHA1 哈希值
async function calculateSha1(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// 清理旧备份
async function cleanupOldBackups(retentionDays) {
  logInfo(`清理 ${retentionDays} 天前的本地备份文件和 B2 存储`);

  try {
    // 清理本地备份文件
    await cleanupLocalBackups(retentionDays);

    // 清理 B2 存储中的旧备份
    await cleanupB2Backups(retentionDays);

    return true;
  } catch (error) {
    logError(`清理旧备份失败: ${error.message}`);
    throw error;
  }
}

// 清理本地备份文件
async function cleanupLocalBackups(_retentionDays) {
  // Done 平台不支持本地文件系统操作，跳过本地备份清理
  // 使用下划线前缀表示参数未使用
  logInfo(`Done 平台环境下，跳过本地备份文件清理`);
  return true;
}

// 清理 B2 存储中的旧备份
async function cleanupB2Backups(retentionDays) {
  logInfo(`清理 ${retentionDays} 天前的 B2 存储备份...`);

  try {
    // 获取 B2 配置
    const B2_APPLICATION_KEY_ID = Deno.env.get("B2_APPLICATION_KEY_ID") || "";
    const B2_APPLICATION_KEY = Deno.env.get("B2_APPLICATION_KEY") || "";
    const B2_BUCKET_NAME = Deno.env.get("B2_BUCKET_NAME") || "";

    if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
      logInfo("B2 配置不完整，跳过 B2 存储清理");
      return false;
    }

    // 计算截止日期（毫秒时间戳）
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = cutoffDate.getTime();

    // 定义重试函数
    async function fetchWithRetry(url, options, maxRetries = 3) {
      let lastError;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch(url, options);
          if (response.ok) {
            return response;
          }
          const errorText = await response.text();
          lastError = new Error(`请求失败: ${response.status} ${errorText}`);
        } catch (error) {
          lastError = error;
        }

        // 如果不是最后一次尝试，则等待后重试
        if (attempt < maxRetries - 1) {
          const waitTime = 1000 * Math.pow(2, attempt); // 指数退避
          logInfo(`API 请求失败，${waitTime}ms 后重试 (${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      throw lastError;
    }

    // 步骤 1: 获取授权令牌
    logInfo("获取 B2 授权令牌...");
    const authResponse = await fetchWithRetry("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: {
        "Authorization": `Basic ${btoa(`${B2_APPLICATION_KEY_ID}:${B2_APPLICATION_KEY}`)}`
      }
    });

    const authData = await authResponse.json();
    const { authorizationToken, apiUrl } = authData;

    // 步骤 2: 获取存储桶 ID
    logInfo("获取存储桶 ID...");
    const listBucketsResponse = await fetchWithRetry(`${apiUrl}/b2api/v2/b2_list_buckets`, {
      method: "POST",
      headers: {
        "Authorization": authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accountId: authData.accountId
      })
    });

    const bucketsData = await listBucketsResponse.json();
    logInfo(`找到 ${bucketsData.buckets.length} 个存储桶`);

    // 打印所有存储桶名称，帮助调试
    for (const b of bucketsData.buckets) {
      logInfo(`存储桶: ${b.bucketName}, ID: ${b.bucketId}`);
    }

    const bucket = bucketsData.buckets.find(b => b.bucketName === B2_BUCKET_NAME);

    if (!bucket) {
      throw new Error(`未找到存储桶: ${B2_BUCKET_NAME}`);
    }

    // 步骤 3: 列出文件
    logInfo(`列出存储桶 ${B2_BUCKET_NAME} 中的文件...`);
    let startFileName = null;
    let filesDeleted = 0;

    while (true) {
      logInfo(`列出文件，使用存储桶 ID: ${bucket.bucketId}`);
      const listFilesResponse = await fetchWithRetry(`${apiUrl}/b2api/v2/b2_list_file_names`, {
        method: "POST",
        headers: {
          "Authorization": authorizationToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bucketId: bucket.bucketId,
          startFileName: startFileName,
          maxFileCount: 1000
        })
      });

      const filesData = await listFilesResponse.json();
      const files = filesData.files;

      // 处理文件
      for (const file of files) {
        // 检查文件是否是备份文件且超过保留期
        // 检查文件是否在 mysql-backups 文件夹中，并且是 .sql 或 .sql.gz 文件
        if (file.fileName.startsWith('mysql-backups/') &&
            (file.fileName.endsWith('.sql') || file.fileName.endsWith('.sql.gz')) &&
            file.uploadTimestamp < cutoffTimestamp) {
          // 删除文件
          logInfo(`删除旧备份文件: ${file.fileName}`);

          try {
            await fetchWithRetry(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
              method: "POST",
              headers: {
                "Authorization": authorizationToken,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                fileId: file.fileId,
                fileName: file.fileName
              })
            });

            // 如果成功删除，增加计数
            filesDeleted++;
          } catch (deleteError) {
            logError(`删除文件失败: ${file.fileName} - ${deleteError.message}`);
          }
        }
      }

      // 检查是否有更多文件
      if (filesData.nextFileName) {
        startFileName = filesData.nextFileName;
      } else {
        break;
      }
    }

    logInfo(`B2 存储清理完成，共删除 ${filesDeleted} 个旧备份文件`);
    return true;
  } catch (error) {
    logError(`清理 B2 存储备份失败: ${error.message}`);
    // 不抛出异常，让本地清理继续进行
    return false;
  }
}

// 备用备份方法：直接查询数据库生成备份
async function fallbackBackup(host, port, user, password, database) {
  logInfo(`使用备用方法备份数据库 ${database}...`);

  // 创建数据库连接
  const connection = await mysql.createConnection({
    host: host,
    port: port,
    user: user,
    password: password,
    database: database
  });

  try {
    logInfo("连接到数据库...");

    // 获取所有表
    const [tables] = await connection.query("SHOW TABLES");
    const tableNames = tables.map(table => Object.values(table)[0]);

    logInfo(`找到 ${tableNames.length} 个表`);

    // 创建备份文件内容
    let backupContent = `-- MySQL 数据库备份\n`;
    backupContent += `-- 生成时间: ${new Date().toISOString()}\n`;
    backupContent += `-- 数据库: ${database}\n\n`;

    backupContent += `-- 创建数据库\n`;
    backupContent += `CREATE DATABASE IF NOT EXISTS \`${database}\`;\n`;
    backupContent += `USE \`${database}\`;\n\n`;

    // 处理每个表
    for (const tableName of tableNames) {
      logInfo(`处理表: ${tableName}`);

      // 获取表结构
      const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createTableSql = createTable[0]['Create Table'];

      backupContent += `-- 表结构: ${tableName}\n`;
      backupContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      backupContent += `${createTableSql};\n\n`;

      // 获取表数据
      const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);

      if (rows.length > 0) {
        backupContent += `-- 表数据: ${tableName}\n`;

        // 分批处理数据，每批 1000 行
        const batchSize = 1000;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);

          // 获取列名
          const columns = Object.keys(batch[0]);

          // 生成 INSERT 语句
          backupContent += `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES\n`;

          // 生成值
          const values = batch.map(row => {
            const rowValues = columns.map(column => {
              const value = row[column];
              if (value === null) return 'NULL';
              if (typeof value === 'number') return value;
              if (typeof value === 'boolean') return value ? 1 : 0;
              if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
              return `'${String(value).replace(/'/g, "''")}'`;
            });
            return `(${rowValues.join(', ')})`;
          });

          backupContent += values.join(",\n");
          backupContent += `;\n\n`;
        }
      }
    }

    logInfo("备用备份方法完成");
    return backupContent;
  } finally {
    // 关闭数据库连接
    await connection.end();
  }
}
