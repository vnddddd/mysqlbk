// MySQL 备份管理系统 - Done 平台版本
// 集成用户界面和备份功能

// 导入必要的库
import mysql from "npm:mysql2/promise";
import { gzip } from "https://deno.land/x/compress@v0.4.5/mod.ts";
import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { getCookie, setCookie, deleteCookie } from "https://deno.land/x/hono@v3.11.7/helper/cookie/index.ts";
import { html } from "https://deno.land/x/hono@v3.11.7/helper/html/index.ts";
import { nanoid } from "https://deno.land/x/nanoid@v3.0.0/mod.ts";

// 初始化 KV 存储
const kv = await Deno.openKv();

// 简单的密码哈希函数（替代bcrypt）
async function simpleHash(password) {
  // 使用内置的 crypto 模块创建 SHA-256 哈希
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "mysql-backup-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// 验证密码
async function verifyPassword(password, hash) {
  const passwordHash = await simpleHash(password);
  return passwordHash === hash;
}

// 创建默认管理员账号
async function createAdminUser() {
  // 检查管理员账号是否已存在
  const adminResult = await kv.get(["users", "admin"]);

  if (!adminResult.value) {
    // 生成随机密码
    const randomPassword = Math.random().toString(36).slice(-8);

    // 创建管理员账号
    const adminUser = {
      id: "admin",
      username: "admin",
      name: "管理员",
      passwordHash: await simpleHash(randomPassword),
      createdAt: new Date().toISOString()
    };

    await kv.set(["users", "admin"], adminUser);

    // 输出管理员密码到控制台
    console.log("=================================================");
    console.log(`已创建管理员账号，用户名: admin，密码: ${randomPassword}`);
    console.log("请登录后立即修改密码");
    console.log("=================================================");

    return randomPassword;
  }

  return null;
}

// 创建 Hono 应用
const app = new Hono();

// 创建管理员账号
await createAdminUser();

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

// 中间件：检查用户是否已登录
async function authMiddleware(c, next) {
  const sessionId = getCookie(c, "session");
  if (!sessionId) {
    return c.redirect("/login");
  }

  // 从 KV 存储中获取会话
  const sessionData = await kv.get(["sessions", sessionId]);
  if (!sessionData.value) {
    deleteCookie(c, "session");
    return c.redirect("/login");
  }

  // 将用户信息添加到请求上下文
  c.set("user", sessionData.value.user);
  await next();
}

// 静态文件中间件
app.use("/static/*", serveStatic({ root: "./" }));

// 首页路由 - 重定向到仪表板或登录页面
app.get("/", async (c) => {
  const sessionId = getCookie(c, "session");
  if (!sessionId) {
    return c.redirect("/login");
  }

  const sessionData = await kv.get(["sessions", sessionId]);
  if (!sessionData.value) {
    deleteCookie(c, "session");
    return c.redirect("/login");
  }

  return c.redirect("/dashboard");
});

// 登录页面
app.get("/login", (c) => {
  return c.html(renderLoginPage());
});

// 仪表板页面
app.get("/dashboard", authMiddleware, async (c) => {
  const user = c.get("user");

  // 获取用户的数据库配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  // 获取用户的云存储配置
  const storageConfigsResult = await kv.get(["storageConfigs", user.id]);
  const storageConfigs = storageConfigsResult.value || [];

  // 获取最近的备份历史
  const backupHistoryResult = await kv.get(["backupHistory", user.id]);
  const backupHistory = backupHistoryResult.value || [];

  // 检查是否是首次登录
  const firstLogin = await isFirstLogin(user.username);

  return c.html(renderDashboard(user, dbConfigs, storageConfigs, backupHistory, firstLogin));
});

// 处理登录请求
app.post("/api/login", async (c) => {
  const { username, password } = await c.req.parseBody();

  // 验证输入
  if (!username || !password) {
    return c.json({ success: false, message: "用户名和密码不能为空" }, 400);
  }

  // 从 KV 存储中获取用户
  const userResult = await kv.get(["users", username]);
  const user = userResult.value;

  if (!user) {
    return c.json({ success: false, message: "用户名或密码错误" }, 401);
  }

  // 验证密码
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return c.json({ success: false, message: "用户名或密码错误" }, 401);
  }

  // 创建会话
  const sessionId = nanoid();
  await kv.set(["sessions", sessionId], {
    user: {
      id: user.id,
      username: user.username,
      name: user.name
    },
    createdAt: new Date().toISOString()
  });

  // 设置会话 cookie
  setCookie(c, "session", sessionId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7天
    sameSite: "Lax"
  });

  return c.json({ success: true, redirect: "/dashboard" });
});

// 处理注册请求
app.post("/api/register", async (c) => {
  const { username, password, name } = await c.req.parseBody();

  // 验证输入
  if (!username || !password || !name) {
    return c.json({ success: false, message: "所有字段都是必填的" }, 400);
  }

  // 检查用户名是否已存在
  const existingUser = await kv.get(["users", username]);
  if (existingUser.value) {
    return c.json({ success: false, message: "用户名已存在" }, 409);
  }

  // 创建新用户
  const userId = nanoid();
  const passwordHash = await simpleHash(password);

  await kv.set(["users", username], {
    id: userId,
    username,
    name,
    passwordHash,
    createdAt: new Date().toISOString()
  });

  return c.json({ success: true, message: "注册成功，请登录" });
});

// 处理账户设置更新
app.post("/api/settings/account", authMiddleware, async (c) => {
  const user = c.get("user");
  const { name, password } = await c.req.parseBody();

  // 获取用户完整信息
  const userResult = await kv.get(["users", user.username]);
  if (!userResult.value) {
    return c.json({ success: false, message: "用户不存在" }, 404);
  }

  const userData = userResult.value;

  // 更新用户信息
  const updatedUser = {
    ...userData,
    name: name || userData.name,
    updatedAt: new Date().toISOString()
  };

  // 如果提供了新密码，更新密码
  if (password && password.trim() !== "") {
    updatedUser.passwordHash = await simpleHash(password);
    updatedUser.passwordChanged = true; // 标记密码已修改
  }

  // 保存更新后的用户信息
  await kv.set(["users", user.username], updatedUser);

  // 更新会话中的用户信息
  const sessionId = getCookie(c, "session");
  const sessionResult = await kv.get(["sessions", sessionId]);

  if (sessionResult.value) {
    const sessionData = sessionResult.value;
    sessionData.user.name = updatedUser.name;
    await kv.set(["sessions", sessionId], sessionData);
  }

  return c.json({
    success: true,
    message: "账户设置已更新",
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      name: updatedUser.name
    }
  });
});

// 处理登出请求
app.post("/api/logout", async (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    await kv.delete(["sessions", sessionId]);
    deleteCookie(c, "session");
  }
  return c.json({ success: true, redirect: "/login" });
});

// 处理备份设置更新
app.post("/api/settings/backup", authMiddleware, async (c) => {
  const user = c.get("user");
  const { backupRetentionDays, backupTime, compressionLevel } = await c.req.parseBody();

  // 验证输入
  const retentionDays = parseInt(backupRetentionDays) || 7;
  if (retentionDays < 1 || retentionDays > 365) {
    return c.json({ success: false, message: "备份保留天数必须在1-365之间" }, 400);
  }

  // 保存设置
  await kv.set(["backupSettings", user.id], {
    backupRetentionDays: retentionDays,
    backupTime: backupTime || "04:00",
    compressionLevel: parseInt(compressionLevel) || 6,
    updatedAt: new Date().toISOString(),
    updatedBy: user.username
  });

  return c.json({ success: true, message: "备份设置已更新" });
});

// 数据库配置API
app.post("/api/databases", authMiddleware, async (c) => {
  const user = c.get("user");
  const data = await c.req.parseBody();

  // 验证输入
  if (!data.name || !data.host || !data.user || !data.databases) {
    return c.json({ success: false, message: "缺少必要的字段" }, 400);
  }

  // 获取现有配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  // 创建新配置
  const newConfig = {
    id: nanoid(),
    name: data.name,
    host: data.host,
    port: parseInt(data.port || "3306"),
    user: data.user,
    password: data.password,
    databases: data.databases.split(',').map(db => db.trim()),
    createdAt: new Date().toISOString()
  };

  // 添加到配置列表
  dbConfigs.push(newConfig);

  // 保存配置
  await kv.set(["dbConfigs", user.id], dbConfigs);

  return c.json({ success: true, config: newConfig });
});

app.put("/api/databases/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const data = await c.req.parseBody();

  // 获取现有配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  // 查找要更新的配置
  const configIndex = dbConfigs.findIndex(config => config.id === id);
  if (configIndex === -1) {
    return c.json({ success: false, message: "未找到指定的数据库配置" }, 404);
  }

  // 更新配置
  dbConfigs[configIndex] = {
    ...dbConfigs[configIndex],
    name: data.name || dbConfigs[configIndex].name,
    host: data.host || dbConfigs[configIndex].host,
    port: parseInt(data.port || dbConfigs[configIndex].port),
    user: data.user || dbConfigs[configIndex].user,
    password: data.password || dbConfigs[configIndex].password,
    databases: data.databases ? data.databases.split(',').map(db => db.trim()) : dbConfigs[configIndex].databases,
    updatedAt: new Date().toISOString()
  };

  // 保存配置
  await kv.set(["dbConfigs", user.id], dbConfigs);

  return c.json({ success: true, config: dbConfigs[configIndex] });
});

app.delete("/api/databases/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // 获取现有配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  // 过滤掉要删除的配置
  const newConfigs = dbConfigs.filter(config => config.id !== id);

  // 如果长度相同，说明没有找到要删除的配置
  if (newConfigs.length === dbConfigs.length) {
    return c.json({ success: false, message: "未找到指定的数据库配置" }, 404);
  }

  // 保存配置
  await kv.set(["dbConfigs", user.id], newConfigs);

  return c.json({ success: true });
});

// 云存储配置API
app.post("/api/storage", authMiddleware, async (c) => {
  const user = c.get("user");
  const data = await c.req.parseBody();

  // 验证输入
  if (!data.name || !data.type) {
    return c.json({ success: false, message: "缺少必要的字段" }, 400);
  }

  // 获取现有配置
  const storageConfigsResult = await kv.get(["storageConfigs", user.id]);
  const storageConfigs = storageConfigsResult.value || [];

  // 创建新配置
  const newConfig = {
    id: nanoid(),
    name: data.name,
    type: data.type,
    active: data.active === "true" || data.active === true,
    createdAt: new Date().toISOString()
  };

  // 根据存储类型添加特定字段
  if (data.type === "backblaze") {
    if (!data.applicationKeyId || !data.applicationKey || !data.bucketName) {
      return c.json({ success: false, message: "缺少Backblaze B2必要的字段" }, 400);
    }

    newConfig.applicationKeyId = data.applicationKeyId;
    newConfig.applicationKey = data.applicationKey;
    newConfig.bucketName = data.bucketName;
  }

  // 添加到配置列表
  storageConfigs.push(newConfig);

  // 保存配置
  await kv.set(["storageConfigs", user.id], storageConfigs);

  return c.json({ success: true, config: newConfig });
});

app.put("/api/storage/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const data = await c.req.parseBody();

  // 获取现有配置
  const storageConfigsResult = await kv.get(["storageConfigs", user.id]);
  const storageConfigs = storageConfigsResult.value || [];

  // 查找要更新的配置
  const configIndex = storageConfigs.findIndex(config => config.id === id);
  if (configIndex === -1) {
    return c.json({ success: false, message: "未找到指定的存储配置" }, 404);
  }

  // 更新配置
  const updatedConfig = {
    ...storageConfigs[configIndex],
    name: data.name || storageConfigs[configIndex].name,
    active: data.active === "true" || data.active === true,
    updatedAt: new Date().toISOString()
  };

  // 根据存储类型更新特定字段
  if (updatedConfig.type === "backblaze") {
    updatedConfig.applicationKeyId = data.applicationKeyId || updatedConfig.applicationKeyId;
    updatedConfig.applicationKey = data.applicationKey || updatedConfig.applicationKey;
    updatedConfig.bucketName = data.bucketName || updatedConfig.bucketName;
  }

  storageConfigs[configIndex] = updatedConfig;

  // 保存配置
  await kv.set(["storageConfigs", user.id], storageConfigs);

  return c.json({ success: true, config: updatedConfig });
});

app.delete("/api/storage/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // 获取现有配置
  const storageConfigsResult = await kv.get(["storageConfigs", user.id]);
  const storageConfigs = storageConfigsResult.value || [];

  // 过滤掉要删除的配置
  const newConfigs = storageConfigs.filter(config => config.id !== id);

  // 如果长度相同，说明没有找到要删除的配置
  if (newConfigs.length === storageConfigs.length) {
    return c.json({ success: false, message: "未找到指定的存储配置" }, 404);
  }

  // 保存配置
  await kv.set(["storageConfigs", user.id], newConfigs);

  return c.json({ success: true });
});

// 备份执行API
app.post("/api/backup", authMiddleware, async (c) => {
  const user = c.get("user");
  const data = await c.req.parseBody();

  // 获取数据库配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  if (dbConfigs.length === 0) {
    return c.json({ success: false, message: "未找到任何数据库配置" }, 400);
  }

  // 获取存储配置
  const storageConfigsResult = await kv.get(["storageConfigs", user.id]);
  const storageConfigs = storageConfigsResult.value || [];

  const activeStorageConfigs = storageConfigs.filter(config => config.active);
  if (activeStorageConfigs.length === 0) {
    return c.json({ success: false, message: "未找到任何活跃的存储配置" }, 400);
  }

  // 获取要备份的数据库配置
  let databasesToBackup = [];
  if (data.databaseIds) {
    const databaseIds = Array.isArray(data.databaseIds) ? data.databaseIds : [data.databaseIds];
    databasesToBackup = dbConfigs.filter(config => databaseIds.includes(config.id));
  } else {
    databasesToBackup = dbConfigs;
  }

  if (databasesToBackup.length === 0) {
    return c.json({ success: false, message: "未找到指定的数据库配置" }, 400);
  }

  // 开始备份任务
  const backupId = nanoid();
  const backupTask = {
    id: backupId,
    userId: user.id,
    status: "pending",
    databases: databasesToBackup.map(db => ({
      id: db.id,
      name: db.name,
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      databases: db.databases
    })),
    storage: activeStorageConfigs[0],
    createdAt: new Date().toISOString()
  };

  // 保存备份任务
  await kv.set(["backupTasks", backupId], backupTask);

  // 异步执行备份
  executeBackup(backupTask).catch(error => {
    logError(`执行备份任务 ${backupId} 失败`, error);
  });

  return c.json({
    success: true,
    message: "备份任务已启动",
    taskId: backupId
  });
});

// 查询备份任务状态
app.get("/api/backup/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // 获取备份任务
  const backupTaskResult = await kv.get(["backupTasks", id]);
  const backupTask = backupTaskResult.value;

  if (!backupTask || backupTask.userId !== user.id) {
    return c.json({ success: false, message: "未找到指定的备份任务" }, 404);
  }

  return c.json({ success: true, task: backupTask });
});

// 获取备份历史
app.get("/api/backup/history", authMiddleware, async (c) => {
  const user = c.get("user");

  // 获取备份历史
  const backupHistoryResult = await kv.get(["backupHistory", user.id]);
  const backupHistory = backupHistoryResult.value || [];

  return c.json({ success: true, history: backupHistory });
});

// 执行备份任务
async function executeBackup(task) {
  try {
    // 更新任务状态为进行中
    await kv.set(["backupTasks", task.id], {
      ...task,
      status: "running",
      startedAt: new Date().toISOString()
    });

    // 准备存储配置
    const storage = task.storage;
    let B2_APPLICATION_KEY_ID = "";
    let B2_APPLICATION_KEY = "";
    let B2_BUCKET_NAME = "";

    if (storage.type === "backblaze") {
      B2_APPLICATION_KEY_ID = storage.applicationKeyId;
      B2_APPLICATION_KEY = storage.applicationKey;
      B2_BUCKET_NAME = storage.bucketName;
    }

    // 执行每个数据库的备份
    const results = [];
    const successDatabases = [];
    const failedDatabases = [];
    let totalBackupSize = 0;

    for (const dbConfig of task.databases) {
      for (const dbName of dbConfig.databases) {
        try {
          logInfo(`开始备份数据库: ${dbConfig.name} - ${dbName}`);

          // 执行备份
          const backupString = await fallbackBackup(
            dbConfig.host,
            dbConfig.port,
            dbConfig.user,
            dbConfig.password,
            dbName
          );

          // 压缩备份内容
          const textEncoder = new TextEncoder();
          const backupData = textEncoder.encode(backupString);
          const compressedData = await gzip(backupData);

          // 生成文件名
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const gzipFileName = `backup-${dbName}-${timestamp}.sql.gz`;
          const b2FileName = `mysql-backups/${gzipFileName}`;

          // 上传到云存储
          if (storage.type === "backblaze") {
            await uploadToB2(
              compressedData,
              b2FileName,
              B2_APPLICATION_KEY_ID,
              B2_APPLICATION_KEY,
              B2_BUCKET_NAME
            );
          }

          // 记录结果
          results.push({
            database: dbName,
            success: true,
            size: backupData.length,
            compressedSize: compressedData.length,
            filename: b2FileName
          });

          successDatabases.push(dbName);
          totalBackupSize += backupData.length;

          logInfo(`数据库 ${dbName} 备份成功`);
        } catch (error) {
          logError(`备份数据库 ${dbName} 失败`, error);

          results.push({
            database: dbName,
            success: false,
            error: error.message
          });

          failedDatabases.push(dbName);
        }
      }
    }

    // 更新任务状态为完成
    const completedTask = {
      ...task,
      status: failedDatabases.length === 0 ? "completed" : "partial",
      results,
      successDatabases,
      failedDatabases,
      totalBackupSize,
      completedAt: new Date().toISOString()
    };

    await kv.set(["backupTasks", task.id], completedTask);

    // 添加到备份历史
    const backupHistoryResult = await kv.get(["backupHistory", task.userId]);
    const backupHistory = backupHistoryResult.value || [];

    const historyEntry = {
      id: task.id,
      timestamp: new Date().toISOString(),
      success: failedDatabases.length === 0,
      databases: [...successDatabases, ...failedDatabases],
      successDatabases,
      failedDatabases,
      totalBackupSize,
      storage: storage.name,
      results
    };

    backupHistory.unshift(historyEntry);

    // 只保留最近100条历史记录
    if (backupHistory.length > 100) {
      backupHistory.length = 100;
    }

    await kv.set(["backupHistory", task.userId], backupHistory);

    return completedTask;
  } catch (error) {
    logError(`执行备份任务失败`, error);

    // 更新任务状态为失败
    await kv.set(["backupTasks", task.id], {
      ...task,
      status: "failed",
      error: error.message,
      completedAt: new Date().toISOString()
    });

    throw error;
  }
}

// 辅助函数：格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 启动服务器
Deno.serve(app.fetch);

// 渲染登录页面
function renderLoginPage() {
  return html`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录 - MySQL 备份管理系统</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body class="login-page">
  <div class="login-container">
    <div class="login-form-container">
      <h1>MySQL 备份管理系统</h1>
      <div class="login-form">
        <h2>管理员登录</h2>
        <form id="loginForm">
          <div class="form-group">
            <label for="username">用户名</label>
            <input type="text" id="username" name="username" value="admin" required>
            <div class="form-hint">默认用户名: admin</div>
          </div>
          <div class="form-group">
            <label for="password">密码</label>
            <input type="password" id="password" name="password" required>
            <div class="form-hint">首次登录请使用控制台显示的随机密码</div>
          </div>
          <div class="form-error" id="loginError"></div>
          <button type="submit" class="btn btn-primary">登录</button>
        </form>
        <div class="form-footer">
          <p>系统自动创建管理员账号，请查看控制台日志获取初始密码</p>
        </div>
      </div>
    </div>
  </div>
  <script src="/static/login.js"></script>
</body>
</html>
  `;
}

// 检查是否是首次登录（使用默认密码）
async function isFirstLogin(username) {
  const userResult = await kv.get(["users", username]);
  if (!userResult.value) return false;

  // 检查是否有passwordChanged标记
  return !userResult.value.passwordChanged;
}

// 渲染仪表板页面
function renderDashboard(user, dbConfigs, storageConfigs, backupHistory, firstLogin = false) {
  return html`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>仪表板 - MySQL 备份管理系统</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body class="dashboard-page">
  <div class="dashboard-container">
    <header class="dashboard-header">
      <div class="logo">
        <h1>MySQL 备份管理系统</h1>
      </div>
      <div class="user-info">
        <span>欢迎，${user.name}</span>
        <button id="logoutBtn" class="btn btn-text">退出</button>
      </div>
    </header>

    <div class="dashboard-content">
      <nav class="dashboard-nav">
        <ul>
          <li><a href="#overview" class="active">概览</a></li>
          <li><a href="#databases">数据库配置</a></li>
          <li><a href="#storage">云存储配置</a></li>
          <li><a href="#history">备份历史</a></li>
          <li><a href="#settings">系统设置</a></li>
        </ul>
      </nav>

      <main class="dashboard-main">
        <section id="overview" class="dashboard-section active">
          <h2>系统概览</h2>
          ${firstLogin ? `
          <div class="alert alert-warning">
            <strong>首次登录提示：</strong> 您正在使用系统生成的初始密码登录，请立即前往 <a href="#settings">系统设置</a> 修改您的密码以确保账户安全。
          </div>
          ` : ''}
          <div class="overview-cards">
            <div class="card">
              <h3>数据库</h3>
              <div class="card-value">${dbConfigs.length}</div>
              <p>已配置数据库</p>
            </div>
            <div class="card">
              <h3>云存储</h3>
              <div class="card-value">${storageConfigs.length}</div>
              <p>已配置存储</p>
            </div>
            <div class="card">
              <h3>备份</h3>
              <div class="card-value">${backupHistory.length}</div>
              <p>历史备份</p>
            </div>
            <div class="card">
              <h3>状态</h3>
              <div class="card-value status-ok">正常</div>
              <p>系统状态</p>
            </div>
          </div>

          <div class="action-buttons">
            <button id="manualBackupBtn" class="btn btn-primary">立即备份</button>
            <button id="scheduleBackupBtn" class="btn btn-secondary">计划备份</button>
          </div>

          <div class="recent-activity">
            <h3>最近活动</h3>
            <div class="activity-list">
              ${backupHistory.slice(0, 5).map(history => `
                <div class="activity-item">
                  <div class="activity-icon ${history.success ? 'success' : 'error'}"></div>
                  <div class="activity-details">
                    <div class="activity-title">${history.success ? '备份成功' : '备份失败'}: ${history.databases.join(', ')}</div>
                    <div class="activity-time">${new Date(history.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>

        <section id="databases" class="dashboard-section">
          <h2>数据库配置</h2>
          <div class="section-header">
            <p>管理需要备份的MySQL数据库连接信息</p>
            <button id="addDatabaseBtn" class="btn btn-primary">添加数据库</button>
          </div>

          <div class="database-list">
            ${dbConfigs.length > 0 ? dbConfigs.map(db => `
              <div class="database-item" data-id="${db.id}">
                <div class="database-info">
                  <h3>${db.name}</h3>
                  <div class="database-details">
                    <span>主机: ${db.host}:${db.port}</span>
                    <span>用户: ${db.user}</span>
                    <span>数据库: ${db.databases.join(', ')}</span>
                  </div>
                </div>
                <div class="database-actions">
                  <button class="btn btn-icon edit-db" title="编辑"><span class="icon-edit"></span></button>
                  <button class="btn btn-icon test-db" title="测试连接"><span class="icon-test"></span></button>
                  <button class="btn btn-icon delete-db" title="删除"><span class="icon-delete"></span></button>
                </div>
              </div>
            `).join('') : `
              <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>暂无数据库配置</h3>
                <p>点击"添加数据库"按钮开始配置您的第一个数据库连接</p>
              </div>
            `}
          </div>
        </section>

        <section id="storage" class="dashboard-section">
          <h2>云存储配置</h2>
          <div class="section-header">
            <p>管理备份文件的云存储目标位置</p>
            <button id="addStorageBtn" class="btn btn-primary">添加存储</button>
          </div>

          <div class="storage-list">
            ${storageConfigs.length > 0 ? storageConfigs.map(storage => `
              <div class="storage-item" data-id="${storage.id}">
                <div class="storage-info">
                  <h3>${storage.name}</h3>
                  <div class="storage-details">
                    <span>类型: ${storage.type}</span>
                    ${storage.type === 'backblaze' ? `
                      <span>存储桶: ${storage.bucketName}</span>
                    ` : ''}
                    <span>状态: ${storage.active ? '<span class="status-active">活跃</span>' : '<span class="status-inactive">未激活</span>'}</span>
                  </div>
                </div>
                <div class="storage-actions">
                  <button class="btn btn-icon edit-storage" title="编辑"><span class="icon-edit"></span></button>
                  <button class="btn btn-icon test-storage" title="测试连接"><span class="icon-test"></span></button>
                  <button class="btn btn-icon delete-storage" title="删除"><span class="icon-delete"></span></button>
                </div>
              </div>
            `).join('') : `
              <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>暂无存储配置</h3>
                <p>点击"添加存储"按钮开始配置您的第一个云存储连接</p>
              </div>
            `}
          </div>
        </section>

        <section id="history" class="dashboard-section">
          <h2>备份历史</h2>
          <div class="section-header">
            <p>查看所有备份任务的执行历史和状态</p>
            <div class="filter-controls">
              <select id="historyFilter" class="form-select">
                <option value="all">全部</option>
                <option value="success">成功</option>
                <option value="failed">失败</option>
              </select>
            </div>
          </div>

          <div class="history-list">
            ${backupHistory.length > 0 ? `
              <div class="history-table">
                <div class="history-header">
                  <div class="history-cell">状态</div>
                  <div class="history-cell">时间</div>
                  <div class="history-cell">数据库</div>
                  <div class="history-cell">大小</div>
                  <div class="history-cell">存储</div>
                  <div class="history-cell">操作</div>
                </div>
                ${backupHistory.map(history => `
                  <div class="history-row">
                    <div class="history-cell">
                      <span class="status-badge ${history.success ? 'success' : 'error'}">
                        ${history.success ? '成功' : '失败'}
                      </span>
                    </div>
                    <div class="history-cell">${new Date(history.timestamp).toLocaleString()}</div>
                    <div class="history-cell">${history.databases.join(', ')}</div>
                    <div class="history-cell">${formatFileSize(history.totalBackupSize)}</div>
                    <div class="history-cell">${history.storage || '-'}</div>
                    <div class="history-cell">
                      <button class="btn btn-icon view-details" title="查看详情"><span class="icon-details"></span></button>
                      ${history.success ? `<button class="btn btn-icon download-backup" title="下载备份"><span class="icon-download"></span></button>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>暂无备份历史</h3>
                <p>执行备份后，历史记录将显示在这里</p>
              </div>
            `}
          </div>
        </section>

        <section id="settings" class="dashboard-section">
          <h2>系统设置</h2>

          <div class="settings-card">
            <h3>备份设置</h3>
            <form id="backupSettingsForm" class="settings-form">
              <div class="form-group">
                <label for="backupRetentionDays">备份保留天数</label>
                <input type="number" id="backupRetentionDays" name="backupRetentionDays" min="1" max="365" value="7">
                <div class="form-hint">超过此天数的备份文件将被自动删除</div>
              </div>

              <div class="form-group">
                <label for="backupTime">自动备份时间</label>
                <input type="time" id="backupTime" name="backupTime" value="04:00">
                <div class="form-hint">每天自动执行备份的时间</div>
              </div>

              <div class="form-group">
                <label for="compressionLevel">压缩级别</label>
                <select id="compressionLevel" name="compressionLevel" class="form-select">
                  <option value="1">低 (最快)</option>
                  <option value="6" selected>中等 (平衡)</option>
                  <option value="9">高 (最小体积)</option>
                </select>
                <div class="form-hint">备份文件的压缩级别，影响备份速度和文件大小</div>
              </div>

              <button type="submit" class="btn btn-primary">保存设置</button>
            </form>
          </div>

          <div class="settings-card">
            <h3>账户设置</h3>
            <form id="accountSettingsForm" class="settings-form">
              <div class="form-group">
                <label for="accountName">姓名</label>
                <input type="text" id="accountName" name="name" value="${user.name}">
              </div>

              <div class="form-group">
                <label for="accountUsername">用户名</label>
                <input type="text" id="accountUsername" name="username" value="${user.username}" disabled>
                <div class="form-hint">用户名不可更改</div>
              </div>

              <div class="form-group">
                <label for="accountPassword">新密码</label>
                <input type="password" id="accountPassword" name="password">
                <div class="form-hint">留空表示不修改密码</div>
              </div>

              <button type="submit" class="btn btn-primary">更新账户</button>
            </form>
          </div>
        </section>
      </main>
    </div>
  </div>
  <script src="/static/dashboard.js"></script>
</body>
</html>
  `;
}
