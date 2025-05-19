// MySQL 备份管理系统 - Done 平台版本
// 集成用户界面和备份功能

// 导入必要的库
import mysql from "npm:mysql2/promise";
import { gzip } from "https://deno.land/x/compress@v0.4.5/mod.ts";
import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { serveStatic } from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { getCookie, setCookie, deleteCookie } from "https://deno.land/x/hono@v3.11.7/helper/cookie/index.ts";
import { html, raw } from "https://deno.land/x/hono@v3.11.7/helper/html/index.ts";
import { nanoid } from "https://deno.land/x/nanoid@v3.0.0/mod.ts";

// 初始化 KV 存储
const kv = await Deno.openKv();

// 简单的密码哈希函数（替代bcrypt）
async function simpleHash(password) {
  try {
    // 使用内置的 crypto 模块创建 SHA-256 哈希
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "mysql-backup-salt");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error("密码哈希生成失败:", error);
    throw new Error("密码处理失败，请稍后重试");
  }
}

// 验证密码 - 直接比较哈希值
async function verifyPassword(password, hash) {
  try {
    const passwordHash = await simpleHash(password);
    return passwordHash === hash;
  } catch (error) {
    console.error("密码验证失败:", error);
    throw new Error("密码验证失败，请稍后重试");
  }
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
  let body;

  // 尝试解析不同格式的请求体
  try {
    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await c.req.json();
    } else {
      body = await c.req.parseBody();
    }
  } catch (error) {
    console.error("解析登录请求体失败:", error);
    return c.json({ success: false, message: "无效的请求格式" }, 400);
  }

  const { username, password } = body;

  // 验证输入
  if (!username || !password) {
    console.log("登录失败: 用户名或密码为空");
    return c.json({ success: false, message: "用户名和密码不能为空" }, 400);
  }

  console.log(`尝试登录: ${username}`);

  // 从 KV 存储中获取用户
  const userResult = await kv.get(["users", username]);
  const user = userResult.value;

  if (!user) {
    console.log(`登录失败: 用户不存在 - ${username}`);
    return c.json({ success: false, message: "用户名或密码错误" }, 401);
  }

  console.log(`用户存在: ${username}, 验证密码中...`);
  console.log(`密码哈希信息: 长度=${user.passwordHash ? user.passwordHash.length : 0}`);

  // 验证密码
  try {
    const inputPasswordHash = await simpleHash(password);
    const storedPasswordHash = user.passwordHash;

    console.log(`密码哈希比较:
      - 输入密码哈希: ${inputPasswordHash.substring(0, 10)}...
      - 存储密码哈希: ${storedPasswordHash.substring(0, 10)}...
    `);

    const isValid = inputPasswordHash === storedPasswordHash;

    if (!isValid) {
      console.log(`登录失败: 密码不匹配 - ${username}`);
      return c.json({ success: false, message: "用户名或密码错误" }, 401);
    }
  } catch (error) {
    console.error(`密码验证错误:`, error);
    return c.json({ success: false, message: "验证失败，请稍后重试" }, 500);
  }

  console.log(`登录成功: ${username}`);

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
  let body;

  // 尝试解析不同格式的请求体
  try {
    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await c.req.json();
    } else {
      body = await c.req.parseBody();
    }
  } catch (error) {
    console.error("解析请求体失败:", error);
    return c.json({ success: false, message: "无效的请求格式" }, 400);
  }

  const { name, password } = body;

  // 记录请求信息（不包含密码）
  console.log("收到账户设置更新请求:", {
    username: user.username,
    name,
    hasPassword: !!password
  });

  // 获取用户完整信息
  const userResult = await kv.get(["users", user.username]);
  if (!userResult.value) {
    console.error("用户不存在:", user.username);
    return c.json({ success: false, message: "用户不存在" }, 404);
  }

  const userData = userResult.value;
  console.log("获取到用户数据:", {
    username: userData.username,
    id: userData.id,
    hasPasswordHash: !!userData.passwordHash
  });

  // 更新用户信息
  const updatedUser = {
    ...userData,
    name: name || userData.name,
    updatedAt: new Date().toISOString()
  };

  // 如果提供了新密码，更新密码
  if (password && password.trim() !== "") {
    const newPasswordHash = await simpleHash(password);
    console.log("生成新密码哈希:", {
      username: user.username,
      oldHashLength: userData.passwordHash ? userData.passwordHash.length : 0,
      newHashLength: newPasswordHash.length
    });

    updatedUser.passwordHash = newPasswordHash;
    updatedUser.passwordChanged = true; // 标记密码已修改
    console.log("用户密码已更新:", user.username);
  }

  // 保存更新后的用户信息
  try {
    await kv.set(["users", user.username], updatedUser);
    console.log("用户信息已保存到KV存储:", user.username);
  } catch (error) {
    console.error("保存用户信息失败:", error);
    return c.json({ success: false, message: "保存用户信息失败" }, 500);
  }

  // 更新会话中的用户信息
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    const sessionResult = await kv.get(["sessions", sessionId]);

    if (sessionResult.value) {
      const sessionData = sessionResult.value;
      sessionData.user.name = updatedUser.name;
      await kv.set(["sessions", sessionId], sessionData);
      console.log("会话信息已更新:", sessionId);
    }
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



// 解析MySQL连接字符串
function parseMySQLConnectionString(connectionString) {
  try {
    console.log("开始解析连接字符串:", connectionString);
    const result = {};
    let cleanString = connectionString.trim();

    // 移除可能的协议前缀 (mysql://)
    if (cleanString.startsWith('mysql://')) {
      cleanString = cleanString.substring(8);
    }

    // 处理查询参数
    let mainPart = cleanString;
    let queryParams = {};

    if (cleanString.includes('?')) {
      const parts = cleanString.split('?');
      mainPart = parts[0];

      // 解析查询参数
      if (parts[1]) {
        const queryParts = parts[1].split('&');
        queryParts.forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) {
            queryParams[key.toLowerCase()] = value;
          }
        });
      }

      // 存储SSL相关参数
      if (queryParams['ssl-mode'] || queryParams['sslmode']) {
        result.sslMode = queryParams['ssl-mode'] || queryParams['sslmode'];
      }
    }

    // 提取认证信息和主机信息
    const atIndex = mainPart.lastIndexOf('@');
    if (atIndex !== -1) {
      // 提取用户名和密码
      const authPart = mainPart.substring(0, atIndex);
      const authParts = authPart.split(':');
      result.user = authParts[0];
      result.password = authParts.length > 1 ? authParts.slice(1).join(':') : ''; // 处理密码中可能包含冒号的情况

      // 提取主机、端口和数据库
      const hostPart = mainPart.substring(atIndex + 1);

      // 检查是否使用tcp(host:port)格式
      const tcpMatch = hostPart.match(/tcp\(([^:]+):(\d+)\)\/(.+)/);
      if (tcpMatch) {
        result.host = tcpMatch[1];
        result.port = parseInt(tcpMatch[2]);
        result.databases = tcpMatch[3].split(',').map(db => db.trim());
      } else {
        // 使用标准URL格式 host:port/database
        const hostPortDbParts = hostPart.split('/');

        if (hostPortDbParts.length > 0) {
          const hostPortPart = hostPortDbParts[0];
          const hostPortParts = hostPortPart.split(':');

          result.host = hostPortParts[0];
          result.port = hostPortParts.length > 1 ? parseInt(hostPortParts[1]) : 3306;

          // 提取数据库名称
          if (hostPortDbParts.length > 1) {
            result.databases = hostPortDbParts[1].split(',').map(db => db.trim());
          }
        }
      }
    }

    console.log("解析结果:", result);

    // 验证必要字段是否存在
    if (!result.host || !result.user || !result.databases || !result.databases.length) {
      console.warn("连接字符串解析不完整:", result);
    }

    return result;
  } catch (error) {
    console.error('解析连接字符串失败:', error);
    return null;
  }
}

// 数据库配置API
// 获取所有数据库配置
app.get("/api/databases", authMiddleware, async (c) => {
  const user = c.get("user");

  // 获取用户的数据库配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  return c.json({ success: true, databases: dbConfigs });
});

// 获取单个数据库配置
app.get("/api/databases/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // 获取用户的数据库配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  // 查找指定的配置
  const database = dbConfigs.find(config => config.id === id);
  if (!database) {
    return c.json({ success: false, message: "未找到指定的数据库配置" }, 404);
  }

  return c.json({ success: true, database });
});

app.post("/api/databases", authMiddleware, async (c) => {
  const user = c.get("user");
  let body;

  // 尝试解析不同格式的请求体
  try {
    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await c.req.json();
    } else {
      body = await c.req.parseBody();
    }
  } catch (error) {
    console.error("解析请求体失败:", error);
    return c.json({ success: false, message: "无效的请求格式" }, 400);
  }

  // 检查是否提供了连接字符串
  if (body.connectionString && body.connectionString.trim()) {
    console.log("检测到连接字符串，正在解析...");
    const parsedData = parseMySQLConnectionString(body.connectionString.trim());
    if (parsedData) {
      console.log("连接字符串解析结果:", parsedData);
      // 使用解析的数据填充必要字段
      body.host = parsedData.host || body.host;
      body.port = parsedData.port || body.port;
      body.user = parsedData.user || body.user;
      body.password = parsedData.password || body.password;
      if (parsedData.databases && parsedData.databases.length > 0) {
        body.databases = parsedData.databases.join(',');
      }
    } else {
      return c.json({ success: false, message: "连接字符串格式无效，请检查后重试" }, 400);
    }
  }

  // 验证输入
  if (!body.name || !body.host || !body.user || !body.databases) {
    return c.json({ success: false, message: "缺少必要的字段" }, 400);
  }

  // 获取现有配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  // 创建新配置
  const newConfig = {
    id: nanoid(),
    name: body.name,
    host: body.host,
    port: parseInt(body.port || "3306"),
    user: body.user,
    password: body.password,
    databases: body.databases.split(',').map(db => db.trim()),
    createdAt: new Date().toISOString()
  };

  // 添加SSL模式（如果有）
  if (body.sslMode) {
    newConfig.sslMode = body.sslMode;
  }

  // 添加到配置列表
  dbConfigs.push(newConfig);

  // 保存配置
  await kv.set(["dbConfigs", user.id], dbConfigs);

  return c.json({ success: true, config: newConfig });
});

app.put("/api/databases/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  let body;

  // 尝试解析不同格式的请求体
  try {
    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await c.req.json();
    } else {
      body = await c.req.parseBody();
    }
  } catch (error) {
    console.error("解析请求体失败:", error);
    return c.json({ success: false, message: "无效的请求格式" }, 400);
  }

  // 获取现有配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  // 查找要更新的配置
  const configIndex = dbConfigs.findIndex(config => config.id === id);
  if (configIndex === -1) {
    return c.json({ success: false, message: "未找到指定的数据库配置" }, 404);
  }

  // 检查是否提供了连接字符串
  if (body.connectionString && body.connectionString.trim()) {
    console.log("检测到连接字符串，正在解析...");
    const parsedData = parseMySQLConnectionString(body.connectionString.trim());
    if (parsedData) {
      console.log("连接字符串解析结果:", parsedData);
      // 使用解析的数据填充必要字段
      body.host = parsedData.host || body.host;
      body.port = parsedData.port || body.port;
      body.user = parsedData.user || body.user;
      body.password = parsedData.password || body.password;
      if (parsedData.databases && parsedData.databases.length > 0) {
        body.databases = parsedData.databases.join(',');
      }
    } else {
      return c.json({ success: false, message: "连接字符串格式无效，请检查后重试" }, 400);
    }
  }

  // 更新配置
  dbConfigs[configIndex] = {
    ...dbConfigs[configIndex],
    name: body.name || dbConfigs[configIndex].name,
    host: body.host || dbConfigs[configIndex].host,
    port: parseInt(body.port || dbConfigs[configIndex].port),
    user: body.user || dbConfigs[configIndex].user,
    // 只有在提供了新密码时才更新密码
    password: body.password ? body.password : dbConfigs[configIndex].password,
    databases: body.databases ? body.databases.split(',').map(db => db.trim()) : dbConfigs[configIndex].databases,
    updatedAt: new Date().toISOString()
  };

  // 更新SSL模式（如果有）
  if (body.sslMode !== undefined) {
    dbConfigs[configIndex].sslMode = body.sslMode;
  }

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

// 测试数据库连接
app.post("/api/databases/:id/test", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // 获取数据库配置
  const dbConfigsResult = await kv.get(["dbConfigs", user.id]);
  const dbConfigs = dbConfigsResult.value || [];

  // 查找指定的配置
  const dbConfig = dbConfigs.find(config => config.id === id);
  if (!dbConfig) {
    return c.json({ success: false, message: "未找到指定的数据库配置" }, 404);
  }

  try {
    // 准备连接配置
    const connectionConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: 10000
    };

    // 添加SSL配置（如果有）
    if (dbConfig.sslMode) {
      console.log(`使用SSL模式连接: ${dbConfig.sslMode}`);
      connectionConfig.ssl = {};

      if (dbConfig.sslMode.toUpperCase() === 'REQUIRED' || dbConfig.sslMode.toUpperCase() === 'TRUE') {
        connectionConfig.ssl = { rejectUnauthorized: true };
      } else if (dbConfig.sslMode.toUpperCase() === 'PREFERRED') {
        connectionConfig.ssl = { rejectUnauthorized: false };
      }
    }

    console.log("尝试连接数据库:", {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      hasPassword: !!dbConfig.password,
      hasSSL: !!connectionConfig.ssl
    });

    // 尝试连接数据库
    const connection = await mysql.createConnection(connectionConfig);

    // 测试连接
    await connection.query("SELECT 1");

    // 关闭连接
    await connection.end();

    return c.json({
      success: true,
      message: `成功连接到 ${dbConfig.host}:${dbConfig.port}`
    });
  } catch (error) {
    logError(`测试数据库连接失败: ${dbConfig.host}:${dbConfig.port}`, error);
    return c.json({
      success: false,
      message: `连接失败: ${error.message}`
    }, 500);
  }
});

// 云存储配置API
// 获取所有存储配置
app.get("/api/storage", authMiddleware, async (c) => {
  const user = c.get("user");

  // 获取用户的存储配置
  const storageConfigsResult = await kv.get(["storageConfigs", user.id]);
  const storageConfigs = storageConfigsResult.value || [];

  return c.json({ success: true, storage: storageConfigs });
});

// 获取单个存储配置
app.get("/api/storage/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // 获取用户的存储配置
  const storageConfigsResult = await kv.get(["storageConfigs", user.id]);
  const storageConfigs = storageConfigsResult.value || [];

  // 查找指定的配置
  const storage = storageConfigs.find(config => config.id === id);
  if (!storage) {
    return c.json({ success: false, message: "未找到指定的存储配置" }, 404);
  }

  return c.json({ success: true, storage });
});

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

// 测试存储连接
app.post("/api/storage/:id/test", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // 获取存储配置
  const storageConfigsResult = await kv.get(["storageConfigs", user.id]);
  const storageConfigs = storageConfigsResult.value || [];

  // 查找指定的配置
  const storageConfig = storageConfigs.find(config => config.id === id);
  if (!storageConfig) {
    return c.json({ success: false, message: "未找到指定的存储配置" }, 404);
  }

  try {
    // 根据存储类型测试连接
    if (storageConfig.type === "backblaze") {
      // 测试Backblaze B2连接
      const authUrl = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account";

      // 创建认证头
      const credentials = `${storageConfig.applicationKeyId}:${storageConfig.applicationKey}`;
      const encodedCredentials = btoa(credentials);

      // 发送认证请求
      const authResponse = await fetch(authUrl, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${encodedCredentials}`
        }
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        return c.json({
          success: false,
          message: `Backblaze B2认证失败: ${errorData.message || errorData.code || "未知错误"}`
        }, 500);
      }

      // 成功获取认证信息，不需要使用返回的数据
      await authResponse.json();

      return c.json({
        success: true,
        message: `成功连接到Backblaze B2，存储桶: ${storageConfig.bucketName}`
      });
    } else {
      return c.json({
        success: false,
        message: `不支持的存储类型: ${storageConfig.type}`
      }, 400);
    }
  } catch (error) {
    logError(`测试存储连接失败: ${storageConfig.type}`, error);
    return c.json({
      success: false,
      message: `连接失败: ${error.message}`
    }, 500);
  }
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

// 获取计划备份设置
app.get("/api/backup/schedule", authMiddleware, async (c) => {
  const user = c.get("user");

  // 获取用户的计划备份配置
  const scheduleConfigResult = await kv.get(["backupSchedule", user.id]);
  const scheduleConfig = scheduleConfigResult.value || null;

  return c.json({
    success: true,
    config: scheduleConfig
  });
});

// 计划备份API
app.post("/api/backup/schedule", authMiddleware, async (c) => {
  const user = c.get("user");
  let body;

  // 尝试解析不同格式的请求体
  try {
    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await c.req.json();
    } else {
      body = await c.req.parseBody();
    }
  } catch (error) {
    console.error("解析请求体失败:", error);
    return c.json({ success: false, message: "无效的请求格式" }, 400);
  }

  // 验证输入
  if (!body.frequency || !body.time || !body.retention) {
    return c.json({ success: false, message: "缺少必要的字段" }, 400);
  }

  // 根据频率验证其他字段
  if (body.frequency === 'weekly' && !body.weekday) {
    return c.json({ success: false, message: "每周备份需要指定星期几" }, 400);
  }

  if (body.frequency === 'monthly' && !body.dayOfMonth) {
    return c.json({ success: false, message: "每月备份需要指定日期" }, 400);
  }

  // 创建计划备份配置
  const scheduleConfig = {
    frequency: body.frequency,
    time: body.time,
    retention: parseInt(body.retention),
    updatedAt: new Date().toISOString(),
    userId: user.id
  };

  // 添加频率特定字段
  if (body.frequency === 'weekly') {
    scheduleConfig.weekday = parseInt(body.weekday);
  } else if (body.frequency === 'monthly') {
    scheduleConfig.dayOfMonth = parseInt(body.dayOfMonth);
  }

  // 保存配置
  try {
    await kv.set(["backupSchedule", user.id], scheduleConfig);
    logInfo(`用户 ${user.username} 设置了计划备份: ${body.frequency}`);

    return c.json({
      success: true,
      message: "计划备份设置已保存",
      config: scheduleConfig
    });
  } catch (error) {
    logError(`保存计划备份设置失败:`, error);
    return c.json({ success: false, message: "保存计划备份设置失败，请稍后重试" }, 500);
  }
});

// 下载备份API
app.get("/api/backup/download", authMiddleware, async (c) => {
  const user = c.get("user");
  const date = c.req.query("date");
  const databases = c.req.query("databases");

  if (!date || !databases) {
    return c.json({ success: false, message: "缺少必要的参数" }, 400);
  }

  try {
    // 获取备份历史
    const backupHistoryResult = await kv.get(["backupHistory", user.id]);
    const backupHistory = backupHistoryResult.value || [];

    // 查找匹配的备份记录
    const dbNames = databases.split('_');
    const backupRecord = backupHistory.find(record => {
      const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
      const requestDate = date.replace(/-/g, '-');
      return recordDate.includes(requestDate) &&
             dbNames.every(db => record.databases.includes(db));
    });

    if (!backupRecord || !backupRecord.fileUrl) {
      return c.json({ success: false, message: "未找到指定的备份文件" }, 404);
    }

    // 获取文件内容（这里需要根据实际存储方式调整）
    // 如果是B2存储，需要获取下载URL
    if (backupRecord.storageType === 'backblaze') {
      // 获取存储配置
      const storageConfigsResult = await kv.get(["storageConfigs", user.id]);
      const storageConfigs = storageConfigsResult.value || [];
      const storage = storageConfigs.find(s => s.id === backupRecord.storageId);

      if (!storage) {
        return c.json({ success: false, message: "未找到存储配置" }, 404);
      }

      // 获取B2授权
      const authUrl = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account";
      const credentials = `${storage.applicationKeyId}:${storage.applicationKey}`;
      const encodedCredentials = btoa(credentials);

      const authResponse = await fetch(authUrl, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${encodedCredentials}`
        }
      });

      if (!authResponse.ok) {
        return c.json({ success: false, message: "获取存储授权失败" }, 500);
      }

      const authData = await authResponse.json();

      // 获取文件下载URL
      const downloadUrl = `${authData.downloadUrl}/file/${storage.bucketName}/${backupRecord.fileUrl}`;

      // 重定向到下载URL
      return c.redirect(downloadUrl);
    } else {
      // 本地存储或其他存储方式
      return c.json({ success: false, message: "不支持的存储类型" }, 400);
    }
  } catch (error) {
    logError(`下载备份失败:`, error);
    return c.json({ success: false, message: `下载失败: ${error.message}` }, 500);
  }
});

// 上传文件到Backblaze B2
async function uploadToB2(fileData, fileName, applicationKeyId, applicationKey, bucketName) {
  try {
    // 第1步：获取授权信息
    const authUrl = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account";

    // 创建认证头
    const credentials = `${applicationKeyId}:${applicationKey}`;
    const encodedCredentials = btoa(credentials);

    const authResponse = await fetch(authUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${encodedCredentials}`
      }
    });

    if (!authResponse.ok) {
      const errorData = await authResponse.json();
      throw new Error(`B2认证失败: ${errorData.message || errorData.code || "未知错误"}`);
    }

    const authData = await authResponse.json();

    // 第2步：获取上传URL
    const getUploadUrlUrl = `${authData.apiUrl}/b2api/v2/b2_get_upload_url`;

    // 首先获取bucket ID
    const listBucketsUrl = `${authData.apiUrl}/b2api/v2/b2_list_buckets`;
    const listBucketsResponse = await fetch(listBucketsUrl, {
      method: "POST",
      headers: {
        "Authorization": authData.authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accountId: authData.accountId
      })
    });

    if (!listBucketsResponse.ok) {
      const errorData = await listBucketsResponse.json();
      throw new Error(`获取存储桶列表失败: ${errorData.message || errorData.code || "未知错误"}`);
    }

    const bucketsData = await listBucketsResponse.json();
    const bucket = bucketsData.buckets.find(b => b.bucketName === bucketName);

    if (!bucket) {
      throw new Error(`未找到存储桶: ${bucketName}`);
    }

    const bucketId = bucket.bucketId;

    // 获取上传URL
    const getUploadUrlResponse = await fetch(getUploadUrlUrl, {
      method: "POST",
      headers: {
        "Authorization": authData.authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bucketId: bucketId
      })
    });

    if (!getUploadUrlResponse.ok) {
      const errorData = await getUploadUrlResponse.json();
      throw new Error(`获取上传URL失败: ${errorData.message || errorData.code || "未知错误"}`);
    }

    const uploadUrlData = await getUploadUrlResponse.json();

    // 第3步：上传文件
    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": uploadUrlData.authorizationToken,
        "Content-Type": "application/octet-stream",
        "Content-Length": fileData.length.toString(),
        "X-Bz-File-Name": encodeURIComponent(fileName),
        "X-Bz-Content-Sha1": "do_not_verify" // 在生产环境中应该计算实际的SHA1
      },
      body: fileData
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(`文件上传失败: ${errorData.message || errorData.code || "未知错误"}`);
    }

    const uploadResult = await uploadResponse.json();
    logInfo(`文件上传成功: ${fileName}, 大小: ${fileData.length} 字节`);

    return uploadResult;
  } catch (error) {
    logError(`上传到B2失败: ${fileName}`, error);
    throw error;
  }
}

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
            dbName,
            dbConfig.sslMode
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

// 使用直接查询方式备份MySQL数据库
async function fallbackBackup(host, port, user, password, database, sslMode) {
  try {
    logInfo(`使用直接查询方式备份数据库: ${database}`);

    // 准备连接配置
    const connectionConfig = {
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true
    };

    // 添加SSL配置（如果有）
    if (sslMode) {
      logInfo(`使用SSL模式连接: ${sslMode}`);
      connectionConfig.ssl = {};

      if (sslMode.toUpperCase() === 'REQUIRED' || sslMode.toUpperCase() === 'TRUE') {
        connectionConfig.ssl = { rejectUnauthorized: true };
      } else if (sslMode.toUpperCase() === 'PREFERRED') {
        connectionConfig.ssl = { rejectUnauthorized: false };
      }
    }

    // 创建数据库连接
    const connection = await mysql.createConnection(connectionConfig);

    // 获取所有表
    const [tables] = await connection.query("SHOW TABLES");
    const tableNames = tables.map(table => Object.values(table)[0]);

    // 构建备份头
    let backupContent = `-- MySQL备份 - 数据库: ${database}\n`;
    backupContent += `-- 生成时间: ${new Date().toISOString()}\n`;
    backupContent += `-- 服务器版本: ${host}:${port}\n\n`;

    backupContent += `SET NAMES utf8mb4;\n`;
    backupContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    // 获取每个表的创建语句和数据
    for (const tableName of tableNames) {
      // 获取表结构
      const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createTableSql = createTable[0]['Create Table'];

      backupContent += `-- ----------------------------\n`;
      backupContent += `-- 表结构 \`${tableName}\`\n`;
      backupContent += `-- ----------------------------\n`;
      backupContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      backupContent += `${createTableSql};\n\n`;

      // 获取表数据
      const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);

      if (rows.length > 0) {
        backupContent += `-- ----------------------------\n`;
        backupContent += `-- 表数据 \`${tableName}\`\n`;
        backupContent += `-- ----------------------------\n`;

        // 构建INSERT语句
        const columns = Object.keys(rows[0]);
        const columnList = columns.map(col => `\`${col}\``).join(', ');

        // 分批处理数据，避免生成过大的SQL语句
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);

          backupContent += `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n`;

          const valueStrings = batch.map(row => {
            const values = columns.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'number') return value;
              if (typeof value === 'boolean') return value ? 1 : 0;
              if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
              return `'${String(value).replace(/'/g, "''")}'`;
            });
            return `(${values.join(', ')})`;
          });

          backupContent += valueStrings.join(',\n') + ';\n\n';
        }
      }
    }

    backupContent += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    // 关闭连接
    await connection.end();

    logInfo(`数据库 ${database} 备份完成，大小: ${backupContent.length} 字节`);
    return backupContent;
  } catch (error) {
    logError(`备份数据库 ${database} 失败`, error);
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
          ${firstLogin ? raw(`
          <div class="alert alert-warning">
            <strong>首次登录提示：</strong> 您正在使用系统生成的初始密码登录，请立即前往系统设置修改您的密码以确保账户安全。
          </div>
          `) : ''}
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
              ${backupHistory.length > 0 ? raw(backupHistory.slice(0, 5).map(history => `
                <div class="activity-item">
                  <div class="activity-icon ${history.success ? 'success' : 'error'}"></div>
                  <div class="activity-details">
                    <div class="activity-title">${history.success ? '备份成功' : '备份失败'}: ${history.databases.join(', ')}</div>
                    <div class="activity-time">${new Date(history.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              `).join('')) : raw(`
                <div class="empty-state">
                  <div class="empty-icon"></div>
                  <h3>暂无活动记录</h3>
                  <p>执行备份后，活动记录将显示在这里</p>
                </div>
              `)}
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
            ${dbConfigs.length > 0 ? raw(dbConfigs.map(db => `
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
                  <button class="btn btn-icon edit-db" title="编辑">编辑</button>
                  <button class="btn btn-icon test-db" title="测试连接">测试</button>
                  <button class="btn btn-icon delete-db" title="删除">删除</button>
                </div>
              </div>
            `).join('')) : raw(`
              <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>暂无数据库配置</h3>
                <p>点击"添加数据库"按钮开始配置您的第一个数据库连接</p>
              </div>
            `)}
          </div>
        </section>

        <section id="storage" class="dashboard-section">
          <h2>云存储配置</h2>
          <div class="section-header">
            <p>管理备份文件的云存储目标位置</p>
            <button id="addStorageBtn" class="btn btn-primary">添加存储</button>
          </div>

          <div class="storage-list">
            ${storageConfigs.length > 0 ? raw(storageConfigs.map(storage => `
              <div class="storage-item" data-id="${storage.id}">
                <div class="storage-info">
                  <h3>${storage.name}</h3>
                  <div class="storage-details">
                    <span>类型: ${storage.type}</span>
                    ${storage.type === 'backblaze' ? raw(`
                      <span>存储桶: ${storage.bucketName}</span>
                    `) : ''}
                    <span>状态: ${storage.active ? '活跃' : '未激活'}</span>
                  </div>
                </div>
                <div class="storage-actions">
                  <button class="btn btn-icon edit-storage" title="编辑">编辑</button>
                  <button class="btn btn-icon test-storage" title="测试连接">测试</button>
                  <button class="btn btn-icon delete-storage" title="删除">删除</button>
                </div>
              </div>
            `).join('')) : raw(`
              <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>暂无存储配置</h3>
                <p>点击"添加存储"按钮开始配置您的第一个云存储连接</p>
              </div>
            `)}
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
            ${backupHistory.length > 0 ? raw(`
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
                      <button class="btn btn-icon view-details" title="查看详情">详情</button>
                      ${history.success ? `<button class="btn btn-icon download-backup" title="下载备份">下载</button>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            `) : raw(`
              <div class="empty-state">
                <div class="empty-icon"></div>
                <h3>暂无备份历史</h3>
                <p>执行备份后，历史记录将显示在这里</p>
              </div>
            `)}
          </div>
        </section>

        <section id="settings" class="dashboard-section">
          <h2>系统设置</h2>

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
