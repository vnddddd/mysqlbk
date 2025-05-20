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

// 警告日志函数
function logWarn(message) {
  console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
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
const getScheduleHandler = async (c) => {
  const user = c.get("user");

  try {
    logInfo(`用户 ${user.username} 请求获取计划备份设置`);

    // 获取用户的计划备份配置
    const scheduleConfigResult = await kv.get(["backupSchedule", user.id]);
    let scheduleConfig = scheduleConfigResult.value || null;

    if (scheduleConfig) {
      // 确保所有必要的字段都存在
      if (typeof scheduleConfig !== 'object') {
        logError(`计划备份配置格式错误: ${JSON.stringify(scheduleConfig)}`);
        scheduleConfig = null;
      } else {
        // 确保数值类型字段正确
        if (scheduleConfig.retention) {
          scheduleConfig.retention = parseInt(scheduleConfig.retention);
        }
        if (scheduleConfig.weekday !== undefined) {
          scheduleConfig.weekday = parseInt(scheduleConfig.weekday);
        }
        if (scheduleConfig.dayOfMonth !== undefined) {
          scheduleConfig.dayOfMonth = parseInt(scheduleConfig.dayOfMonth);
        }

        logInfo(`成功获取用户 ${user.username} 的计划备份设置: ${JSON.stringify(scheduleConfig)}`);
      }
    } else {
      logInfo(`用户 ${user.username} 没有现有的计划备份设置`);
    }

    return c.json({
      success: true,
      config: scheduleConfig
    });
  } catch (error) {
    const errorMessage = `获取计划备份设置失败: ${error.message || '未知错误'}`;
    logError(errorMessage, error);

    return c.json({
      success: false,
      message: "获取计划备份设置失败，请稍后重试",
      error: error.message || '未知错误'
    }, 500);
  }
};

// 保存计划备份配置
const postScheduleHandler = async (c) => {
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

  // 记录请求内容（不包含敏感信息）
  logInfo(`收到计划备份设置请求: 用户=${user.username}, 频率=${body.frequency}, 时间=${body.time}, 保留天数=${body.retention}`);
  
  // 处理数据库ID数组 - 支持数组或单个字符串
  let databases = [];
  if (body.databases) {
    if (Array.isArray(body.databases)) {
      databases = body.databases;
    } else if (typeof body.databases === 'string') {
      databases = [body.databases];
    }
  }
  
  logInfo(`选择的数据库IDs: ${JSON.stringify(databases)}`);

  // 验证输入
  if (!body.frequency || !body.time || !body.retention) {
    logError(`计划备份设置验证失败: 缺少必要字段`);
    return c.json({ success: false, message: "缺少必要的字段" }, 400);
  }
  
  // 验证至少选择了一个数据库
  if (databases.length === 0) {
    logError(`计划备份设置验证失败: 未选择数据库`);
    return c.json({ success: false, message: "请选择至少一个数据库" }, 400);
  }

  // 根据频率验证其他字段
  if (body.frequency === 'weekly' && !body.weekday) {
    logError(`计划备份设置验证失败: 每周备份需要指定星期几`);
    return c.json({ success: false, message: "每周备份需要指定星期几" }, 400);
  }

  if (body.frequency === 'monthly' && !body.dayOfMonth) {
    logError(`计划备份设置验证失败: 每月备份需要指定日期`);
    return c.json({ success: false, message: "每月备份需要指定日期" }, 400);
  }

  // 创建计划备份配置
  const scheduleConfig = {
    frequency: body.frequency,
    time: body.time,
    retention: parseInt(body.retention),
    storageId: body.storageId,
    databases: databases,
    updatedAt: new Date().toISOString(),
    userId: user.id
  };

  // 添加频率特定字段
  if (body.frequency === 'weekly' && body.weekday) {
    scheduleConfig.weekday = parseInt(body.weekday);
  } else if (body.frequency === 'monthly' && body.dayOfMonth) {
    scheduleConfig.dayOfMonth = parseInt(body.dayOfMonth);
  }

  // 记录详细的配置信息
  logInfo(`计划备份配置详情:
    频率: ${scheduleConfig.frequency}
    时间: ${scheduleConfig.time}
    保留天数: ${scheduleConfig.retention}
    星期几: ${scheduleConfig.weekday || '不适用'}
    日期: ${scheduleConfig.dayOfMonth || '不适用'}
    用户ID: ${scheduleConfig.userId}
    更新时间: ${scheduleConfig.updatedAt}
  `);

  // 保存配置
  try {
    logInfo(`尝试保存计划备份配置: ${JSON.stringify(scheduleConfig)}`);

    // 先删除旧配置，再保存新配置，避免合并问题
    await kv.delete(["backupSchedule", user.id]);

    // 使用 atomic 操作确保写入成功
    const result = await kv.atomic()
      .set(["backupSchedule", user.id], scheduleConfig)
      .commit();

    if (!result.ok) {
      throw new Error(`KV 原子操作失败: ${result.toString()}`);
    }

    // 验证保存是否成功
    const verifyResult = await kv.get(["backupSchedule", user.id]);
    if (!verifyResult.value) {
      throw new Error("保存后无法验证配置，KV存储可能有问题");
    }

    logInfo(`用户 ${user.username} 设置了计划备份: ${body.frequency}, 保存成功`);
    logInfo(`验证保存的配置: ${JSON.stringify(verifyResult.value)}`);

    return c.json({
      success: true,
      message: "计划备份设置已保存",
      config: scheduleConfig
    });
  } catch (error) {
    const errorMessage = `保存计划备份设置失败: ${error.message || '未知错误'}`;
    logError(errorMessage, error);
    return c.json({
      success: false,
      message: "保存计划备份设置失败，请稍后重试",
      error: error.message || '未知错误'
    }, 500);
  }
};

// 注册多个路径以支持不同的URL格式
app.get("/api/backup/schedule", authMiddleware, getScheduleHandler);
app.get("/api/schedule", authMiddleware, getScheduleHandler); // 兼容旧路径
app.get("/api/schedule/backup", authMiddleware, getScheduleHandler); // 另一种可能的路径

app.post("/api/backup/schedule", authMiddleware, postScheduleHandler);
app.post("/api/schedule", authMiddleware, postScheduleHandler); // 兼容旧路径
app.post("/api/schedule/backup", authMiddleware, postScheduleHandler); // 另一种可能的路径

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
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 2000; // 2秒
  
  while (retryCount <= maxRetries) {
    try {
      // 第1步：获取授权信息
      logInfo(`B2上传 [尝试 ${retryCount+1}/${maxRetries+1}]: 获取授权`);
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
        throw new Error(`B2认证失败: ${errorData.message || errorData.code || "未知错误"} (HTTP ${authResponse.status})`);
      }

      const authData = await authResponse.json();
      logInfo(`B2上传: 授权成功，获取到apiUrl: ${authData.apiUrl.split('/').slice(0, 3).join('/')}/...`);

      // 第2步：获取上传URL
      logInfo(`B2上传: 获取上传URL`);
      const getUploadUrlUrl = `${authData.apiUrl}/b2api/v2/b2_get_upload_url`;
      const getUploadUrlResponse = await fetch(getUploadUrlUrl, {
        method: "POST",
        headers: {
          "Authorization": authData.authorizationToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bucketId: bucketName
        })
      });

      if (!getUploadUrlResponse.ok) {
        const errorData = await getUploadUrlResponse.json();
        throw new Error(`获取上传URL失败: ${errorData.message || errorData.code || "未知错误"} (HTTP ${getUploadUrlResponse.status})`);
      }

      const uploadUrlData = await getUploadUrlResponse.json();
      logInfo(`B2上传: 获取到上传URL`);

      // 第3步：上传文件
      logInfo(`B2上传: 开始上传文件 ${fileName} (${fileData.length} 字节)`);
      
      // 计算文件SHA1
      let sha1;
      // 检测环境是否支持SubtleCrypto
      if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
        logInfo(`B2上传: 使用SubtleCrypto计算SHA1`);
        // 使用WebCrypto计算SHA1
        const hashBuffer = await crypto.subtle.digest('SHA-1', fileData);
        sha1 = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        // 对于不支持SubtleCrypto的环境，使用一个简单的标识符
        sha1 = "no-sha1-" + new Date().getTime();
        logWarn(`B2上传: 当前环境不支持SHA1计算，使用时间戳替代: ${sha1}`);
      }

      const uploadStartTime = Date.now();
      const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": uploadUrlData.authorizationToken,
          "X-Bz-File-Name": encodeURIComponent(fileName),
          "Content-Type": "application/octet-stream",
          "Content-Length": fileData.length.toString(),
          "X-Bz-Content-Sha1": sha1
        },
        body: fileData
      });

      // 检查上传是否成功
      if (!uploadResponse.ok) {
        let errorMessage;
        try {
          const errorData = await uploadResponse.json();
          errorMessage = `${errorData.message || errorData.code || "未知错误"} (HTTP ${uploadResponse.status})`;
        } catch (e) {
          errorMessage = `HTTP错误 ${uploadResponse.status} ${uploadResponse.statusText}`;
        }
        
        if (retryCount < maxRetries) {
          retryCount++;
          logWarn(`B2上传失败，将在${retryDelay/1000}秒后重试 (${retryCount}/${maxRetries}): ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        throw new Error(`上传文件失败: ${errorMessage}`);
      }

      const uploadData = await uploadResponse.json();
      const uploadEndTime = Date.now();
      const uploadDuration = (uploadEndTime - uploadStartTime) / 1000;
      const uploadSpeed = (fileData.length / uploadDuration / 1024).toFixed(2);
      
      logInfo(`B2上传: 文件上传成功 ${fileName}, 耗时: ${uploadDuration.toFixed(2)}秒, 速度: ${uploadSpeed} KB/s`);
      
      return uploadData;
    } catch (error) {
      if (retryCount < maxRetries) {
        retryCount++;
        logWarn(`B2上传出错，将在${retryDelay/1000}秒后重试 (${retryCount}/${maxRetries}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        logError(`B2上传失败，已重试${maxRetries}次`, error);
        throw error;
      }
    }
  }
}

// 执行备份任务
async function executeBackup(task) {
  if (!task || !task.databases || !task.storage) {
    logError("备份任务无效: 缺少数据库或存储配置");
    return;
  }

  try {
    // 记录每个任务的内存使用情况
    const initialMemory = process.memoryUsage ? process.memoryUsage().heapUsed / 1024 / 1024 : 0;
    logInfo(`开始执行备份任务, 当前内存使用: ${initialMemory.toFixed(2)} MB`);

    // 为每个数据库创建单独的备份
    for (const dbConfig of task.databases) {
      for (const dbName of dbConfig.databases) {
        let backupString = null;
        let compressedData = null;
        
        try {
          // 为每个数据库记录开始时间
          const dbStartTime = Date.now();
          logInfo(`开始备份数据库: ${dbConfig.name} - ${dbName}`);

          // 在Deno环境中特殊处理
          const isDeno = typeof Deno !== 'undefined';
          if (isDeno) {
            logInfo(`检测到Deno环境，进行特殊优化`);
          }

          // 执行备份
          backupString = await fallbackBackup(
            dbConfig.host,
            dbConfig.port,
            dbConfig.user,
            dbConfig.password,
            dbName,
            dbConfig.sslMode
          );

          // 内存使用检查点
          checkMemoryUsage(`数据库 ${dbName} 备份内容生成完成`);

          // 压缩备份内容
          const textEncoder = new TextEncoder();
          const backupData = textEncoder.encode(backupString);
          // 释放原始数据，减少内存占用
          backupString = null;
          
          // 强制一次垃圾回收
          if (globalThis.gc) {
            globalThis.gc();
          }
          
          // 添加短暂延迟，给垃圾回收器时间工作
          await new Promise(resolve => setTimeout(resolve, 100));
          
          logInfo(`数据库 ${dbName} 备份完成，大小: ${formatBytes(backupData.length)} 字节`);
          
          // 进行压缩
          compressedData = await gzip(backupData);
          
          // 释放未压缩数据的引用 - 修复TypedArray不能设置length的问题
          // backupData.length = 0; // 旧代码，在TypedArray上不起作用
          // 注意：不能直接设置 backupData = null，因为它是 const 声明的
          // 让它自然离开作用域，垃圾回收器会处理
          
          // 生成文件名
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const gzipFileName = `backup-${dbName}-${timestamp}.sql.gz`;
          const b2FileName = `mysql-backups/${gzipFileName}`;

          logInfo(`数据库 ${dbName} 备份完成，大小: ${formatBytes(compressedData.length)} 字节`);

          // 上传到B2
          try {
            const uploadResult = await uploadToB2(
              compressedData,
              b2FileName,
              task.storage.applicationKeyId,
              task.storage.applicationKey,
              task.storage.bucketName
            );

            logInfo(`文件上传成功: ${b2FileName}, 大小: ${formatBytes(compressedData.length)} 字节`);
            
            // 释放压缩数据的内存
            logInfo(`释放备份数据内存: ${dbName}`);
            compressedData = null;
            
            // 主动触发垃圾回收
            if (globalThis.gc) {
              logInfo(`触发垃圾回收以释放内存`);
              globalThis.gc();
              // 短暂延迟，确保GC完成
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // 记录总执行时间
            const totalTime = (Date.now() - dbStartTime) / 1000;
            logInfo(`数据库 ${dbName} 备份成功，总耗时: ${totalTime.toFixed(2)}秒`);
            
          } catch (uploadError) {
            logError(`上传备份失败: ${dbName}`, uploadError);
            // 释放压缩数据的内存
            compressedData = null;
            // 上传失败，但不抛出异常，继续下一个数据库
          }
        } catch (dbError) {
          logError(`备份数据库失败: ${dbName}`, dbError);
          // 释放内存
          backupString = null;
          compressedData = null;
          // 当前数据库备份失败，继续下一个
          continue;
        } finally {
          // 确保释放所有引用
          backupString = null;
          compressedData = null;
          
          // 触发垃圾回收
          if (globalThis.gc) {
            globalThis.gc();
          }
          
          // 检查内存状态
          checkMemoryUsage(`数据库 ${dbName} 备份完成后`);
        }
      }
    }

    // 最终内存使用检查
    const finalMemory = process.memoryUsage ? process.memoryUsage().heapUsed / 1024 / 1024 : 0;
    logInfo(`备份任务完成, 最终内存使用: ${finalMemory.toFixed(2)} MB`);
    
    // 返回任务完成状态
    return { success: true };
  } catch (error) {
    logError("执行备份任务失败", error);
    return { success: false, error: error.message };
  }
}

// 辅助函数：检查内存使用情况
function checkMemoryUsage(label) {
  if (process.memoryUsage) {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed / 1024 / 1024;
    const heapTotal = memUsage.heapTotal / 1024 / 1024;
    const external = memUsage.external / 1024 / 1024;
    
    logInfo(`内存使用[${label}]: ${heapUsed.toFixed(2)}MB/${heapTotal.toFixed(2)}MB (${(heapUsed/heapTotal*100).toFixed(1)}%), 外部: ${external.toFixed(2)}MB`);
    
    if (heapUsed > heapTotal * 0.8) {
      logWarn(`内存使用偏高! 使用了堆内存的${(heapUsed/heapTotal*100).toFixed(1)}%`);
      // 请求垃圾回收
      if (globalThis.gc) {
        logInfo(`主动请求垃圾回收`);
        globalThis.gc();
      }
    }
  } else if (typeof Deno !== 'undefined') {
    // Deno环境中记录
    logInfo(`${label} - Deno环境，无法详细获取内存使用`);
  }
}

// 辅助函数：格式化字节大小
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i];
}

// 使用直接查询方式备份MySQL数据库
async function fallbackBackup(host, port, user, password, database, sslMode) {
  try {
    logInfo(`使用直接查询方式备份数据库: ${database}`);

    // 准备连接配置 - 修复timeout选项问题
    const connectionConfig = {
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
      // 只使用支持的超时设置
      connectTimeout: 30000, // 30秒连接超时
      // 移除不支持的timeout选项
      dateStrings: true // 避免日期转换问题
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

    // 设置语句超时（如果支持）
    try {
      // 对连接设置会话变量，增加语句超时
      await connection.query("SET SESSION max_execution_time=3600000"); // 1小时超时(毫秒)
      logInfo(`已为数据库 ${database} 设置查询超时: 3600秒`);
    } catch (err) {
      logWarn(`无法为数据库 ${database} 设置查询超时: ${err.message}`);
    }

    // 获取所有表
    const [tables] = await connection.query("SHOW TABLES");
    const tableNames = tables.map(table => Object.values(table)[0]);
    
    logInfo(`数据库 ${database} 中发现 ${tableNames.length} 个表`);

    // 预先评估数据库大小
    try {
      const [dbSizeResult] = await connection.query(`
        SELECT 
          SUM(data_length + index_length) AS total_size,
          COUNT(*) AS table_count,
          SUM(table_rows) AS estimated_rows
        FROM information_schema.tables
        WHERE table_schema = ?`, [database]);
      
      if (dbSizeResult && dbSizeResult[0]) {
        const totalSizeMB = Math.round(dbSizeResult[0].total_size / (1024 * 1024) * 100) / 100;
        const estimatedRows = dbSizeResult[0].estimated_rows;
        logInfo(`数据库 ${database} 估计大小: ${totalSizeMB} MB, 估计总行数: ${estimatedRows || 'Unknown'}`);
      }
    } catch (err) {
      logWarn(`无法评估数据库 ${database} 大小: ${err.message}`);
    }

    // 构建备份头
    let backupContent = `-- MySQL备份 - 数据库: ${database}\n`;
    backupContent += `-- 生成时间: ${new Date().toISOString()}\n`;
    backupContent += `-- 服务器版本: ${host}:${port}\n\n`;

    backupContent += `SET NAMES utf8mb4;\n`;
    backupContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    // 获取每个表的创建语句和数据
    let tableCount = 0;
    for (const tableName of tableNames) {
      tableCount++;
      const startTime = Date.now();
      
      // 预先评估表大小
      try {
        const [tableSizeResult] = await connection.query(`
          SELECT 
            table_rows,
            data_length + index_length AS size
          FROM information_schema.tables 
          WHERE table_schema = ? AND table_name = ?`, 
          [database, tableName]);
        
        if (tableSizeResult && tableSizeResult[0]) {
          const tableSizeMB = Math.round(tableSizeResult[0].size / (1024 * 1024) * 100) / 100;
          const estimatedRows = tableSizeResult[0].table_rows || 'Unknown';
          logInfo(`备份表 ${database}.${tableName} (${tableCount}/${tableNames.length}) - 估计大小: ${tableSizeMB} MB, 估计行数: ${estimatedRows}`);
        } else {
          logInfo(`备份表 ${database}.${tableName} (${tableCount}/${tableNames.length})`);
        }
      } catch (err) {
        logWarn(`无法评估表 ${tableName} 大小: ${err.message}`);
        logInfo(`备份表 ${database}.${tableName} (${tableCount}/${tableNames.length})`);
      }
      
      try {
      // 获取表结构
      const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createTableSql = createTable[0]['Create Table'];

      backupContent += `-- ----------------------------\n`;
      backupContent += `-- 表结构 \`${tableName}\`\n`;
      backupContent += `-- ----------------------------\n`;
      backupContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      backupContent += `${createTableSql};\n\n`;

        // 检查表行数，对大表使用分页查询
        let totalRows = 0;
        
        // 获取表的主键或唯一键信息，用于有序分页
        let primaryKeyColumn = 'id'; // 默认主键
        try {
          const [keysResult] = await connection.query(`
            SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' 
            LIMIT 1`, [database, tableName]);
            
          if (keysResult && keysResult.length > 0) {
            primaryKeyColumn = keysResult[0].COLUMN_NAME;
            logInfo(`表 ${tableName} 使用主键: ${primaryKeyColumn} 进行分页查询`);
          } else {
            // 尝试查找第一个唯一键
            const [uniqueKeysResult] = await connection.query(`
              SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE 
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
              AND POSITION_IN_UNIQUE_CONSTRAINT IS NOT NULL 
              LIMIT 1`, [database, tableName]);
              
            if (uniqueKeysResult && uniqueKeysResult.length > 0) {
              primaryKeyColumn = uniqueKeysResult[0].COLUMN_NAME;
              logInfo(`表 ${tableName} 没有主键，使用唯一键: ${primaryKeyColumn} 进行分页查询`);
            } else {
              logInfo(`表 ${tableName} 没有找到主键或唯一键，将使用LIMIT分页`);
              primaryKeyColumn = null;
            }
          }
        } catch (err) {
          logWarn(`获取表 ${tableName} 主键信息失败: ${err.message}`);
          primaryKeyColumn = null;
        }
        
        // 先尝试计算行数 
        try {
          const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
          totalRows = countResult[0].count;
          logInfo(`表 ${tableName} 包含 ${totalRows} 行数据`);
        } catch (countError) {
          logWarn(`无法计算表 ${tableName} 的行数: ${countError.message}`);
          // 如果无法计算行数，就假设有数据，尝试查询
          totalRows = 1;
        }

        if (totalRows > 0) {
        backupContent += `-- ----------------------------\n`;
        backupContent += `-- 表数据 \`${tableName}\`\n`;
        backupContent += `-- ----------------------------\n`;

          // 使用分页策略处理大表
          const pageSize = 500; // 每页减少到500行，适应Deno Deploy限制
          const totalPages = Math.ceil(totalRows / pageSize);
          
          if (totalPages > 1) {
            logInfo(`表 ${tableName} 数据量较大，将分 ${totalPages} 页处理，每页 ${pageSize} 行`);
          }

          // 对于大表使用分页查询
          let currentPage = 0;
          let hasMoreData = true;
          let lastId = 0; // 用于主键分页
          
          while (hasMoreData) {
            currentPage++;
            let query;
            let queryParams = [];
            
            // 根据是否有主键选择分页策略
            if (primaryKeyColumn && totalRows > pageSize) {
              query = `SELECT * FROM \`${tableName}\` WHERE \`${primaryKeyColumn}\` > ? ORDER BY \`${primaryKeyColumn}\` LIMIT ?`;
              queryParams = [lastId, pageSize];
            } else {
              query = `SELECT * FROM \`${tableName}\` LIMIT ?, ?`;
              queryParams = [(currentPage - 1) * pageSize, pageSize];
            }
            
            // 记录每个查询的开始时间
            const queryStartTime = Date.now();
            logInfo(`开始查询第 ${currentPage}/${totalPages} 页数据 (${tableName})`);
            
            try {
              // 使用Promise.race实现更可靠的超时机制
              const queryTimeout = 5 * 60 * 1000; // 减少到5分钟，适应Deno Deploy环境
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                  reject(new Error(`查询超时，已运行超过${queryTimeout/1000}秒`));
                }, queryTimeout);
              });
              
              const queryPromise = connection.query({
                sql: query,
                timeout: 300000 // 5分钟超时
              }, queryParams);
              
              // 使用Promise.race确保不会永久卡住
              const [rows] = await Promise.race([queryPromise, timeoutPromise]);
              
              const queryDuration = (Date.now() - queryStartTime) / 1000;
              logInfo(`查询第 ${currentPage} 页完成，获取了 ${rows.length} 行，耗时 ${queryDuration.toFixed(2)}秒`);
              
              // 如果没有获取到数据，就结束循环
              if (rows.length === 0) {
                hasMoreData = false;
                continue;
              }
              
              // 记录最后一个主键值，用于下一次查询
              if (primaryKeyColumn && rows.length > 0) {
                lastId = rows[rows.length - 1][primaryKeyColumn];
              }

              // 构建INSERT语句 - 减小批次大小
              const columns = Object.keys(rows[0]);
              const columnList = columns.map(col => `\`${col}\``).join(', ');

              // 分批处理数据，减小每批次大小
              const batchSize = 50; // 减小到50行每批次
              let batchCount = 0;
              for (let i = 0; i < rows.length; i += batchSize) {
                batchCount++;
                const batch = rows.slice(i, i + batchSize);

                // 预先计算大致SQL大小
                let estimatedSize = `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n`.length;
                let sqlChunk = `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n`;
                
                const valueStrings = [];
                for (const row of batch) {
                  const values = columns.map(col => {
                    const value = row[col];
                    if (value === null) return 'NULL';
                    if (typeof value === 'number') return value;
                    if (typeof value === 'boolean') return value ? 1 : 0;
                    if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
                    return `'${String(value).replace(/'/g, "''")}'`;
                  });
                  valueStrings.push(`(${values.join(', ')})`);
                }

                sqlChunk += valueStrings.join(',\n') + ';\n\n';
                backupContent += sqlChunk;
                
                // 立即释放临时变量
                sqlChunk = null;
                
                // 每处理完一个批次触发垃圾回收
                if (batchCount % 5 === 0 && globalThis.gc) {
                  globalThis.gc();
                }
              }
              
              // 主动释放这一页的数据引用，帮助垃圾回收
              const rowsLength = rows.length;
              // 清空rows引用 - 不能直接设置length=0，可能是TypedArray
              // rows.length = 0; // 这可能导致TypeError
              // 不能设置 rows = null，因为它是 const 声明的
              // 让垃圾回收器在变量离开作用域时处理
              
              // 在批量插入较大的表时提供进度反馈
              const progressPercent = Math.min(100, Math.round((currentPage * pageSize) / totalRows * 100));
              logInfo(`表 ${tableName} 处理进度: ${progressPercent}% (已处理 ${currentPage * pageSize} 行)`);
              
              // 对于大表，在每页处理完后触发GC，减少内存压力
              if (rowsLength >= pageSize/2 && globalThis.gc) {
                logInfo(`触发垃圾回收，释放第 ${currentPage} 页数据的内存`);
                globalThis.gc();
              }
              
              // 强制短暂暂停，给JS引擎垃圾回收的机会
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // 如果不是使用主键分页，或者获取的数据量少于页大小，表示没有更多数据了
              if (!primaryKeyColumn || rowsLength < pageSize) {
                hasMoreData = false;
              }
            } catch (queryError) {
              const queryDuration = (Date.now() - queryStartTime) / 1000;
              logError(`查询第 ${currentPage} 页失败，耗时 ${queryDuration.toFixed(2)}秒: ${queryError.message}`);
              
              if (queryDuration >= 9 * 60) { // 如果查询运行了接近10分钟
                logWarn(`表 ${tableName} 第 ${currentPage} 页查询超时，跳过此页`);
                
                // 如果使用主键分页，尝试跳过当前范围
                if (primaryKeyColumn) {
                  try {
                    // 尝试获取比当前lastId大的下一个主键值
                    const [nextIdResult] = await connection.query(
                      `SELECT \`${primaryKeyColumn}\` FROM \`${tableName}\` WHERE \`${primaryKeyColumn}\` > ? ORDER BY \`${primaryKeyColumn}\` LIMIT 1 OFFSET ${pageSize}`, 
                      [lastId]
                    );
                    
                    if (nextIdResult && nextIdResult.length > 0) {
                      // 找到了下一个可用的ID，跳过当前范围
                      const newLastId = nextIdResult[0][primaryKeyColumn];
                      logWarn(`跳过当前主键范围 ${lastId} - ${newLastId}`);
                      lastId = newLastId;
                      continue; // 继续下一次循环
                    }
                  } catch (skipError) {
                    logError(`尝试跳过范围失败: ${skipError.message}`);
                  }
                }
                
                // 如果无法使用主键跳过，或者跳过失败，尝试进入下一页
                if (currentPage < totalPages) {
                  currentPage++; // 尝试跳过这一页
                  continue;
                }
              }
              
              // 如果不是超时或者无法跳过，结束循环
              logError(`由于查询错误，停止处理表 ${tableName}: ${queryError.message}`);
              hasMoreData = false;
              continue;
            }
          }
        } else {
          logInfo(`表 ${tableName} 没有数据`);
        }
        
        const elapsedTime = (Date.now() - startTime) / 1000;
        logInfo(`表 ${tableName} 备份完成，耗时: ${elapsedTime.toFixed(2)}秒`);
        
        // 在每个表处理完后触发垃圾回收
        if (globalThis.gc) {
          globalThis.gc();
        }
      } catch (tableError) {
        logError(`备份表 ${tableName} 失败: ${tableError.message}`, tableError);
        backupContent += `-- 备份表 ${tableName} 失败: ${tableError.message}\n\n`;
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

// 清理旧备份
async function cleanupOldBackups(retentionDays, userId) {
  logInfo(`清理 ${retentionDays} 天前的备份记录`);

  try {
    // 如果提供了用户ID，只清理该用户的备份历史
    if (userId) {
      const backupHistoryResult = await kv.get(["backupHistory", userId]);
      let backupHistory = backupHistoryResult.value || [];

      // 计算截止日期
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // 过滤掉旧备份
      const newHistory = backupHistory.filter(record => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= cutoffDate;
      });

      // 如果有记录被删除，更新历史
      if (newHistory.length < backupHistory.length) {
        await kv.set(["backupHistory", userId], newHistory);
        logInfo(`已清理用户 ${userId} 的 ${backupHistory.length - newHistory.length} 条旧备份记录`);
      }
    }

    return true;
  } catch (error) {
    logError(`清理旧备份失败: ${error.message || '未知错误'}`, error);
    return false;
  }
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

// 导出计划备份设置为JSON文件
app.get("/api/backup/export-schedules", authMiddleware, async (c) => {
  try {
    logInfo(`导出所有计划备份设置到JSON文件`);

    // 获取所有用户
    const usersPrefix = ["users"];
    const usersEntries = await kv.list({ prefix: usersPrefix });
    
    const schedules = [];
    
    // 遍历所有用户
    for await (const entry of usersEntries) {
      const userId = entry.key[1];
      const username = entry.value.username;
      
      // 获取用户的计划备份设置
      const scheduleConfigResult = await kv.get(["backupSchedule", userId]);
      const scheduleConfig = scheduleConfigResult.value;
      
      if (scheduleConfig) {
        // 获取用户的数据库配置
        const dbConfigsResult = await kv.get(["dbConfigs", userId]);
        const dbConfigs = dbConfigsResult.value || [];
        
        // 获取用户的存储配置
        const storageConfigsResult = await kv.get(["storageConfigs", userId]);
        const storageConfigs = storageConfigsResult.value || [];
        
        // 找到与计划关联的数据库和存储
        const databases = scheduleConfig.databases.map(dbId => {
          const dbConfig = dbConfigs.find(db => db.id === dbId);
          if (!dbConfig) return null;
          
          return {
            name: dbConfig.name,
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            databases: dbConfig.databases,
            sslMode: dbConfig.sslMode
          };
        }).filter(db => db !== null);
        
        const storage = storageConfigs.find(s => s.id === scheduleConfig.storageId);
        
        if (databases.length > 0 && storage) {
          schedules.push({
            userId,
            username,
            config: {
              frequency: scheduleConfig.frequency,
              time: scheduleConfig.time,
              weekday: scheduleConfig.weekday,
              dayOfMonth: scheduleConfig.dayOfMonth,
              retention: scheduleConfig.retention
            },
            databases,
            storage: {
              type: storage.type,
              applicationKeyId: storage.applicationKeyId,
              applicationKey: storage.applicationKey,
              bucketName: storage.bucketName
            }
          });
        }
      }
    }
    
    // 创建JSON格式的输出
    const scheduleJson = JSON.stringify(schedules, null, 2);
    
    // 在生产环境中，这里应该将JSON写入到文件系统
    // 对于Deno Deploy等无法写入文件系统的环境，需要考虑其他方式
    
    // 返回JSON
    logInfo(`成功导出 ${schedules.length} 个计划备份配置`);
    return c.json({
      success: true,
      schedules,
      message: `成功导出 ${schedules.length} 个计划备份配置`
    });
  } catch (error) {
    const errorMessage = `导出计划备份设置失败: ${error.message || '未知错误'}`;
    logError(errorMessage, error);
    
    return c.json({
      success: false,
      message: errorMessage,
      error: error.message || '未知错误'
    }, 500);
  }
});
