// 仪表板页面脚本
document.addEventListener('DOMContentLoaded', () => {
  // 导航菜单切换
  const navLinks = document.querySelectorAll('.dashboard-nav a');
  const sections = document.querySelectorAll('.dashboard-section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      // 获取目标部分的ID
      const targetId = link.getAttribute('href').substring(1);

      // 移除所有活动类
      navLinks.forEach(l => l.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      // 添加活动类到当前链接和目标部分
      link.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // 立即备份按钮
  const backupNowBtn = document.getElementById('manualBackupBtn');
  if (backupNowBtn) {
    backupNowBtn.addEventListener('click', () => {
      // 防止重复点击
      if (document.querySelector('.modal')) {
        return;
      }
      showBackupModal();
    });
  }

  // 计划备份按钮
  const scheduleBackupBtn = document.getElementById('scheduleBackupBtn');
  if (scheduleBackupBtn) {
    scheduleBackupBtn.addEventListener('click', () => {
      showScheduleBackupModal();
    });
  }

  // 备份历史操作
  document.addEventListener('click', (e) => {
    // 查看备份详情
    if (e.target.closest('.view-details')) {
      const historyRow = e.target.closest('.history-row');
      const timestamp = historyRow.querySelector('.history-cell:nth-child(2)').textContent;
      const databases = historyRow.querySelector('.history-cell:nth-child(3)').textContent;
      const size = historyRow.querySelector('.history-cell:nth-child(4)').textContent;
      const storage = historyRow.querySelector('.history-cell:nth-child(5)').textContent;
      const isSuccess = historyRow.querySelector('.status-badge').classList.contains('success');

      showBackupDetailsModal({
        timestamp,
        databases,
        size,
        storage,
        success: isSuccess
      });
    }

    // 下载备份
    if (e.target.closest('.download-backup')) {
      const historyRow = e.target.closest('.history-row');
      const timestamp = historyRow.querySelector('.history-cell:nth-child(2)').textContent;
      const databases = historyRow.querySelector('.history-cell:nth-child(3)').textContent;

      downloadBackup(timestamp, databases);
    }
  });

  // 登出功能
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/logout', {
          method: 'POST'
        });

        const data = await response.json();

        if (response.ok && data.success) {
          window.location.href = data.redirect || '/login';
        }
      } catch (error) {
        console.error('登出请求失败:', error);
        alert('登出失败，请稍后重试');
      }
    });
  }

  // 添加数据库按钮
  const addDatabaseBtn = document.getElementById('addDatabaseBtn');
  if (addDatabaseBtn) {
    addDatabaseBtn.addEventListener('click', () => {
      showDatabaseModal();
    });
  }

  // 添加存储按钮
  const addStorageBtn = document.getElementById('addStorageBtn');
  if (addStorageBtn) {
    addStorageBtn.addEventListener('click', () => {
      showStorageModal();
    });
  }

  // 手动备份按钮
  const manualBackupBtn = document.getElementById('manualBackupBtn');
  if (manualBackupBtn) {
    manualBackupBtn.addEventListener('click', () => {
      showBackupModal();
    });
  }

  // 数据库项目操作
  document.addEventListener('click', (e) => {
    // 编辑数据库
    if (e.target.closest('.edit-db')) {
      const dbItem = e.target.closest('.database-item');
      const dbId = dbItem.getAttribute('data-id');
      editDatabase(dbId);
    }

    // 测试数据库连接
    if (e.target.closest('.test-db')) {
      const dbItem = e.target.closest('.database-item');
      const dbId = dbItem.getAttribute('data-id');
      testDatabaseConnection(dbId);
    }

    // 删除数据库
    if (e.target.closest('.delete-db')) {
      const dbItem = e.target.closest('.database-item');
      const dbId = dbItem.getAttribute('data-id');
      deleteDatabase(dbId);
    }

    // 编辑存储
    if (e.target.closest('.edit-storage')) {
      const storageItem = e.target.closest('.storage-item');
      const storageId = storageItem.getAttribute('data-id');
      editStorage(storageId);
    }

    // 测试存储连接
    if (e.target.closest('.test-storage')) {
      const storageItem = e.target.closest('.storage-item');
      const storageId = storageItem.getAttribute('data-id');
      testStorageConnection(storageId);
    }

    // 删除存储
    if (e.target.closest('.delete-storage')) {
      const storageItem = e.target.closest('.storage-item');
      const storageId = storageItem.getAttribute('data-id');
      deleteStorage(storageId);
    }
  });



  // 账户设置表单
  const accountSettingsForm = document.getElementById('accountSettingsForm');
  if (accountSettingsForm) {
    accountSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(accountSettingsForm);
      const name = formData.get('name');
      const password = formData.get('password');

      // 验证输入
      if (!name) {
        alert('姓名不能为空');
        return;
      }

      // 如果提供了密码，验证密码长度
      if (password && password.length < 6) {
        alert('密码长度至少为6个字符');
        return;
      }

      const settings = {
        name: name,
        password: password
      };

      console.log('提交账户设置更新:', { name, hasPassword: !!password });

      try {
        // 显示加载状态
        const submitButton = accountSettingsForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = '更新中...';
        submitButton.disabled = true;

        const response = await fetch('/api/settings/account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        });

        const data = await response.json();
        console.log('账户设置更新响应:', data);

        // 恢复按钮状态
        submitButton.textContent = originalText;
        submitButton.disabled = false;

        if (response.ok && data.success) {
          alert('账户设置已更新' + (password ? '，请使用新密码重新登录' : ''));
          // 清空密码字段
          document.getElementById('accountPassword').value = '';

          // 如果更新了密码，延迟后登出
          if (password) {
            setTimeout(() => {
              // 登出并重定向到登录页面
              fetch('/api/logout', { method: 'POST' })
                .then(() => {
                  window.location.href = '/login';
                })
                .catch(err => {
                  console.error('登出失败:', err);
                  window.location.href = '/login';
                });
            }, 1500);
          }
        } else {
          alert(data.message || '更新账户设置失败');
        }
      } catch (error) {
        console.error('更新账户设置失败:', error);
        alert('更新账户设置失败，请稍后重试');
      }
    });
  }

  // 备份历史筛选
  const historyFilter = document.getElementById('historyFilter');
  if (historyFilter) {
    historyFilter.addEventListener('change', () => {
      const value = historyFilter.value;
      const rows = document.querySelectorAll('.history-row');

      rows.forEach(row => {
        const statusBadge = row.querySelector('.status-badge');
        const isSuccess = statusBadge.classList.contains('success');

        if (value === 'all' ||
            (value === 'success' && isSuccess) ||
            (value === 'failed' && !isSuccess)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }
});

// 显示数据库配置模态框
function showDatabaseModal(dbData = null) {
  // 创建模态框
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block'; // 确保模态框显示
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${dbData ? '编辑数据库' : '添加数据库'}</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <form id="databaseForm">
          <div class="form-group">
            <label for="dbName">名称</label>
            <input type="text" id="dbName" name="name" value="${dbData?.name || ''}" required>
            <div class="form-hint">为此数据库连接起一个易记的名称</div>
          </div>

          <div class="form-tabs">
            <div class="tab-header">
              <button type="button" class="tab-btn active" data-tab="simple">简易模式</button>
              <button type="button" class="tab-btn" data-tab="advanced">高级模式</button>
            </div>

            <div class="tab-content active" id="simple-tab">
              <div class="form-group">
                <label for="dbConnectionString">连接字符串</label>
                <input type="text" id="dbConnectionString" name="connectionString" placeholder="user:password@host:port/database" value="">
                <div class="form-hint">支持多种格式:</div>
                <div class="form-hint">1. user:password@host:port/database</div>
                <div class="form-hint">2. mysql://user:password@host:port/database</div>
                <div class="form-hint">3. user:password@tcp(host:port)/database</div>
                <div class="form-hint">4. 带SSL参数: mysql://user:password@host:port/database?ssl-mode=REQUIRED</div>
              </div>
            </div>

            <div class="tab-content" id="advanced-tab">
              <div class="form-group">
                <label for="dbHost">主机地址</label>
                <input type="text" id="dbHost" name="host" value="${dbData?.host || ''}">
              </div>
              <div class="form-group">
                <label for="dbPort">端口</label>
                <input type="number" id="dbPort" name="port" value="${dbData?.port || '3306'}">
              </div>
              <div class="form-group">
                <label for="dbUser">用户名</label>
                <input type="text" id="dbUser" name="user" value="${dbData?.user || ''}">
              </div>
              <div class="form-group">
                <label for="dbPassword">密码</label>
                <input type="password" id="dbPassword" name="password" value="${dbData?.password || ''}">
                ${dbData ? '<div class="form-hint">留空表示不修改密码</div>' : ''}
              </div>
              <div class="form-group">
                <label for="dbDatabases">数据库名称</label>
                <input type="text" id="dbDatabases" name="databases" value="${dbData?.databases ? dbData.databases.join(', ') : ''}">
                <div class="form-hint">多个数据库用逗号分隔</div>
              </div>
            </div>
          </div>

          <div class="form-error" id="dbFormError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">取消</button>
        <button type="submit" class="btn btn-primary" form="databaseForm">${dbData ? '保存' : '添加'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 关闭模态框
  const closeButtons = modal.querySelectorAll('.close-modal');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  });

  // 点击模态框外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // 处理选项卡切换
  const tabButtons = modal.querySelectorAll('.tab-btn');
  const tabContents = modal.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 移除所有活动类
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // 添加活动类到当前按钮和对应内容
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });

  // 如果是编辑模式，预填连接字符串
  if (dbData) {
    const connectionStringInput = modal.querySelector('#dbConnectionString');
    if (connectionStringInput && dbData.user && dbData.host) {
      const connectionString = `${dbData.user}:${dbData.password}@tcp(${dbData.host}:${dbData.port})/${dbData.databases.join(',')}`;
      connectionStringInput.value = connectionString;
    }
  }

  // 连接字符串解析函数
  function parseConnectionString(connectionString) {
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
          result.port = tcpMatch[2];
          result.databases = tcpMatch[3].split(',').map(db => db.trim());
        } else {
          // 使用标准URL格式 host:port/database
          const hostPortDbParts = hostPart.split('/');

          if (hostPortDbParts.length > 0) {
            const hostPortPart = hostPortDbParts[0];
            const hostPortParts = hostPortPart.split(':');

            result.host = hostPortParts[0];
            result.port = hostPortParts.length > 1 ? hostPortParts[1] : '3306';

            // 提取数据库名称
            if (hostPortDbParts.length > 1) {
              result.databases = hostPortDbParts[1].split(',').map(db => db.trim());
            }
          }
        }
      }

      console.log("解析结果:", result);
      return result;
    } catch (error) {
      console.error('解析连接字符串失败:', error);
      return null;
    }
  }

  // 连接字符串输入变化时，自动填充高级模式字段
  const connectionStringInput = modal.querySelector('#dbConnectionString');
  if (connectionStringInput) {
    connectionStringInput.addEventListener('input', () => {
      const connectionString = connectionStringInput.value.trim();
      if (connectionString) {
        const parsedData = parseConnectionString(connectionString);
        if (parsedData) {
          // 填充高级模式字段
          if (parsedData.host) modal.querySelector('#dbHost').value = parsedData.host;
          if (parsedData.port) modal.querySelector('#dbPort').value = parsedData.port;
          if (parsedData.user) modal.querySelector('#dbUser').value = parsedData.user;
          if (parsedData.password) modal.querySelector('#dbPassword').value = parsedData.password;
          if (parsedData.databases) modal.querySelector('#dbDatabases').value = parsedData.databases.join(', ');
        }
      }
    });
  }

  // 表单提交
  const form = modal.querySelector('#databaseForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const dbFormError = document.getElementById('dbFormError');

    // 检查是否使用了连接字符串
    const connectionString = formData.get('connectionString');
    if (connectionString && connectionString.trim()) {
      const parsedData = parseConnectionString(connectionString.trim());
      if (parsedData) {
        // 使用解析的数据替换表单数据
        if (parsedData.host) formData.set('host', parsedData.host);
        if (parsedData.port) formData.set('port', parsedData.port);
        if (parsedData.user) formData.set('user', parsedData.user);
        if (parsedData.password) formData.set('password', parsedData.password);
        if (parsedData.databases) formData.set('databases', parsedData.databases.join(', '));
      } else {
        dbFormError.textContent = '连接字符串格式无效，请检查后重试';
        return;
      }
    }

    // 验证必填字段
    const name = formData.get('name');
    const host = formData.get('host');
    const user = formData.get('user');
    const databases = formData.get('databases');

    if (!name || !host || !user || !databases) {
      dbFormError.textContent = '请填写所有必要字段';
      return;
    }

    try {
      const url = dbData ? `/api/databases/${dbData.id}` : '/api/databases';
      const method = dbData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 成功，关闭模态框并刷新页面
        document.body.removeChild(modal);
        window.location.reload();
      } else {
        // 失败，显示错误信息
        dbFormError.textContent = data.message || '操作失败，请稍后重试';
      }
    } catch (error) {
      console.error('请求失败:', error);
      dbFormError.textContent = '请求失败，请稍后重试';
    }
  });
}

// 显示云存储配置模态框
function showStorageModal(storageData = null) {
  // 创建模态框
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block'; // 确保模态框显示
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${storageData ? '编辑存储' : '添加存储'}</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <form id="storageForm">
          <div class="form-group">
            <label for="storageName">名称</label>
            <input type="text" id="storageName" name="name" value="${storageData?.name || ''}" required>
          </div>
          <div class="form-group">
            <label for="storageType">存储类型</label>
            <select id="storageType" name="type" class="form-select" required>
              <option value="backblaze" ${storageData?.type === 'backblaze' ? 'selected' : ''}>Backblaze B2</option>
            </select>
          </div>
          <div id="backblazeFields">
            <div class="form-group">
              <label for="applicationKeyId">Application Key ID</label>
              <input type="text" id="applicationKeyId" name="applicationKeyId" value="${storageData?.applicationKeyId || ''}" required>
            </div>
            <div class="form-group">
              <label for="applicationKey">Application Key</label>
              <input type="password" id="applicationKey" name="applicationKey" value="${storageData?.applicationKey || ''}">
              ${storageData ? '<div class="form-hint">留空表示不修改密钥</div>' : ''}
            </div>
            <div class="form-group">
              <label for="bucketName">存储桶名称</label>
              <input type="text" id="bucketName" name="bucketName" value="${storageData?.bucketName || ''}" required>
            </div>
          </div>
          <div class="form-group">
            <label for="storageActive">
              <input type="checkbox" id="storageActive" name="active" ${storageData?.active ? 'checked' : ''}>
              设为活跃存储
            </label>
            <div class="form-hint">活跃存储将用于备份文件上传</div>
          </div>
          <div class="form-error" id="storageFormError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">取消</button>
        <button type="submit" class="btn btn-primary" form="storageForm">${storageData ? '保存' : '添加'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 关闭模态框
  const closeButtons = modal.querySelectorAll('.close-modal');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  });

  // 点击模态框外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // 表单提交
  const form = modal.querySelector('#storageForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const storageFormError = document.getElementById('storageFormError');

    // 处理复选框
    formData.set('active', formData.has('active') ? 'true' : 'false');

    try {
      const url = storageData ? `/api/storage/${storageData.id}` : '/api/storage';
      const method = storageData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 成功，关闭模态框并刷新页面
        document.body.removeChild(modal);
        window.location.reload();
      } else {
        // 失败，显示错误信息
        storageFormError.textContent = data.message || '操作失败，请稍后重试';
      }
    } catch (error) {
      console.error('请求失败:', error);
      storageFormError.textContent = '请求失败，请稍后重试';
    }
  });
}

// 显示备份模态框
function showBackupModal() {
  // 创建模态框
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block'; // 确保模态框显示
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>执行备份</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <form id="backupForm">
          <div class="form-group">
            <label>选择数据库</label>
            <div class="checkbox-group" id="databaseCheckboxes">
              <div class="loading">加载数据库列表...</div>
            </div>
          </div>
          <div class="form-group">
            <label for="backupStorage">选择存储</label>
            <select id="backupStorage" name="storageId" class="form-select" required>
              <option value="">-- 选择存储 --</option>
            </select>
          </div>
          <div class="form-error" id="backupFormError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">取消</button>
        <button type="submit" class="btn btn-primary" form="backupForm">开始备份</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 关闭模态框
  const closeButtons = modal.querySelectorAll('.close-modal');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  });

  // 点击模态框外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // 加载数据库和存储列表
  loadBackupFormData();

  // 表单提交
  const form = modal.querySelector('#backupForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const backupFormError = document.getElementById('backupFormError');

    // 获取选中的数据库
    const selectedDatabases = [];
    document.querySelectorAll('input[name="databases"]:checked').forEach(checkbox => {
      selectedDatabases.push(checkbox.value);
    });

    if (selectedDatabases.length === 0) {
      backupFormError.textContent = '请至少选择一个数据库';
      return;
    }

    formData.delete('databases');
    selectedDatabases.forEach(db => {
      formData.append('databases', db);
    });

    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 成功，关闭模态框并刷新页面
        document.body.removeChild(modal);
        alert('备份任务已提交，请在备份历史中查看结果');
        window.location.reload();
      } else {
        // 失败，显示错误信息
        backupFormError.textContent = data.message || '操作失败，请稍后重试';
      }
    } catch (error) {
      console.error('请求失败:', error);
      backupFormError.textContent = '请求失败，请稍后重试';
    }
  });
}

// 加载备份表单数据
async function loadBackupFormData() {
  try {
    // 加载数据库列表
    const dbResponse = await fetch('/api/databases');
    const dbData = await dbResponse.json();

    const databaseCheckboxes = document.getElementById('databaseCheckboxes');
    databaseCheckboxes.innerHTML = '';

    if (dbData.success && dbData.databases.length > 0) {
      dbData.databases.forEach(db => {
        const checkbox = document.createElement('div');
        checkbox.className = 'checkbox-item';
        checkbox.innerHTML = `
          <label>
            <input type="checkbox" name="databases" value="${db.id}">
            ${db.name} (${db.databases.join(', ')})
          </label>
        `;
        databaseCheckboxes.appendChild(checkbox);
      });
    } else {
      databaseCheckboxes.innerHTML = '<div class="empty-message">没有可用的数据库配置</div>';
    }

    // 加载存储列表
    const storageResponse = await fetch('/api/storage');
    const storageData = await storageResponse.json();

    const storageSelect = document.getElementById('backupStorage');

    if (storageData.success && storageData.storage.length > 0) {
      storageData.storage.forEach(storage => {
        const option = document.createElement('option');
        option.value = storage.id;
        option.textContent = storage.name;
        if (storage.active) {
          option.selected = true;
        }
        storageSelect.appendChild(option);
      });
    } else {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '没有可用的存储配置';
      option.disabled = true;
      storageSelect.innerHTML = '';
      storageSelect.appendChild(option);
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    document.getElementById('databaseCheckboxes').innerHTML = '<div class="error-message">加载数据失败</div>';
  }
}

// 编辑数据库
async function editDatabase(dbId) {
  try {
    const response = await fetch(`/api/databases/${dbId}`);
    const data = await response.json();

    if (response.ok && data.success) {
      showDatabaseModal(data.database);
    } else {
      alert(data.message || '获取数据库信息失败');
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('获取数据库信息失败，请稍后重试');
  }
}

// 测试数据库连接
async function testDatabaseConnection(dbId) {
  try {
    const response = await fetch(`/api/databases/${dbId}/test`, {
      method: 'POST'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      alert('连接成功: ' + data.message);
    } else {
      alert('连接失败: ' + (data.message || '未知错误'));
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('测试连接失败，请稍后重试');
  }
}

// 删除数据库
async function deleteDatabase(dbId) {
  if (!confirm('确定要删除此数据库配置吗？此操作不可撤销。')) {
    return;
  }

  try {
    const response = await fetch(`/api/databases/${dbId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      alert('数据库配置已删除');
      window.location.reload();
    } else {
      alert(data.message || '删除失败');
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('删除失败，请稍后重试');
  }
}

// 编辑存储
async function editStorage(storageId) {
  try {
    const response = await fetch(`/api/storage/${storageId}`);
    const data = await response.json();

    if (response.ok && data.success) {
      showStorageModal(data.storage);
    } else {
      alert(data.message || '获取存储信息失败');
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('获取存储信息失败，请稍后重试');
  }
}

// 测试存储连接
async function testStorageConnection(storageId) {
  try {
    const response = await fetch(`/api/storage/${storageId}/test`, {
      method: 'POST'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      alert('连接成功: ' + data.message);
    } else {
      alert('连接失败: ' + (data.message || '未知错误'));
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('测试连接失败，请稍后重试');
  }
}

// 删除存储
async function deleteStorage(storageId) {
  if (!confirm('确定要删除此存储配置吗？此操作不可撤销。')) {
    return;
  }

  try {
    const response = await fetch(`/api/storage/${storageId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (response.ok && data.success) {
      alert('存储配置已删除');
      window.location.reload();
    } else {
      alert(data.message || '删除失败');
    }
  } catch (error) {
    console.error('请求失败:', error);
    alert('删除失败，请稍后重试');
  }
}

// 显示计划备份模态框
async function showScheduleBackupModal() {
  // 创建模态框
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block'; // 确保模态框显示
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>计划备份设置</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div id="scheduleLoadingIndicator" class="loading-indicator">
          <div class="spinner"></div>
          <div>加载中...</div>
        </div>
        <form id="scheduleBackupForm" style="display: none;">
          <div class="form-group">
            <label for="backupFrequency">备份频率</label>
            <select id="backupFrequency" name="frequency" class="form-control">
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>

          <div class="form-group" id="weekdayGroup" style="display: none;">
            <label for="backupWeekday">星期几</label>
            <select id="backupWeekday" name="weekday" class="form-control">
              <option value="1">星期一</option>
              <option value="2">星期二</option>
              <option value="3">星期三</option>
              <option value="4">星期四</option>
              <option value="5">星期五</option>
              <option value="6">星期六</option>
              <option value="0">星期日</option>
            </select>
          </div>

          <div class="form-group" id="dayOfMonthGroup" style="display: none;">
            <label for="backupDayOfMonth">日期</label>
            <select id="backupDayOfMonth" name="dayOfMonth" class="form-control">
              ${Array.from({length: 28}, (_, i) => `<option value="${i+1}">${i+1}日</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="backupTime">时间</label>
            <input type="time" id="backupTime" name="time" class="form-control" value="03:00" required>
          </div>

          <div class="form-group">
            <label for="backupRetention">保留天数</label>
            <input type="number" id="backupRetention" name="retention" class="form-control" min="1" value="7" required>
            <div class="form-hint">备份将自动保留指定天数，超过天数的备份将被自动删除</div>
          </div>

          <div class="form-error" id="scheduleFormError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">取消</button>
        <button type="submit" class="btn btn-primary" form="scheduleBackupForm">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 关闭模态框
  const closeButtons = modal.querySelectorAll('.close-modal');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  });

  // 点击模态框外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // 获取现有的计划备份设置
  try {
    const response = await fetch('/api/backup/schedule');
    const data = await response.json();

    // 隐藏加载指示器，显示表单
    document.getElementById('scheduleLoadingIndicator').style.display = 'none';
    document.getElementById('scheduleBackupForm').style.display = 'block';

    // 如果有现有配置，填充表单
    if (data.success && data.config) {
      const config = data.config;

      // 设置频率
      const frequencySelect = document.getElementById('backupFrequency');
      frequencySelect.value = config.frequency;

      // 设置星期几（如果适用）
      if (config.frequency === 'weekly' && config.weekday !== undefined) {
        document.getElementById('weekdayGroup').style.display = 'block';
        document.getElementById('backupWeekday').value = config.weekday;
      }

      // 设置日期（如果适用）
      if (config.frequency === 'monthly' && config.dayOfMonth !== undefined) {
        document.getElementById('dayOfMonthGroup').style.display = 'block';
        document.getElementById('backupDayOfMonth').value = config.dayOfMonth;
      }

      // 设置时间
      if (config.time) {
        document.getElementById('backupTime').value = config.time;
      }

      // 设置保留天数
      if (config.retention) {
        document.getElementById('backupRetention').value = config.retention;
      }
    }
  } catch (error) {
    console.error('获取计划备份设置失败:', error);
    document.getElementById('scheduleLoadingIndicator').style.display = 'none';
    document.getElementById('scheduleBackupForm').style.display = 'block';
    document.getElementById('scheduleFormError').textContent = '获取现有设置失败，显示默认值';
  }

  // 根据频率显示/隐藏相关选项
  const frequencySelect = document.getElementById('backupFrequency');
  const weekdayGroup = document.getElementById('weekdayGroup');
  const dayOfMonthGroup = document.getElementById('dayOfMonthGroup');

  frequencySelect.addEventListener('change', () => {
    const value = frequencySelect.value;
    weekdayGroup.style.display = value === 'weekly' ? 'block' : 'none';
    dayOfMonthGroup.style.display = value === 'monthly' ? 'block' : 'none';
  });

  // 表单提交
  const form = document.getElementById('scheduleBackupForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const scheduleFormError = document.getElementById('scheduleFormError');

    try {
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = '保存中...';

      const response = await fetch('/api/backup/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          frequency: formData.get('frequency'),
          weekday: formData.get('weekday'),
          dayOfMonth: formData.get('dayOfMonth'),
          time: formData.get('time'),
          retention: formData.get('retention')
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('计划备份设置已保存');
        document.body.removeChild(modal);
        window.location.reload();
      } else {
        scheduleFormError.textContent = data.message || '保存计划备份设置失败';
        submitButton.disabled = false;
        submitButton.textContent = '保存';
      }
    } catch (error) {
      console.error('保存计划备份设置失败:', error);
      scheduleFormError.textContent = '保存计划备份设置失败，请稍后重试';
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = false;
      submitButton.textContent = '保存';
    }
  });
}

// 显示备份详情模态框
function showBackupDetailsModal(backupInfo) {
  // 创建模态框
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block'; // 确保模态框显示
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>备份详情</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="backup-details">
          <div class="detail-item">
            <div class="detail-label">状态:</div>
            <div class="detail-value">
              <span class="status-badge ${backupInfo.success ? 'success' : 'error'}">
                ${backupInfo.success ? '成功' : '失败'}
              </span>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">时间:</div>
            <div class="detail-value">${backupInfo.timestamp}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">数据库:</div>
            <div class="detail-value">${backupInfo.databases}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">大小:</div>
            <div class="detail-value">${backupInfo.size}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">存储:</div>
            <div class="detail-value">${backupInfo.storage}</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">关闭</button>
        ${backupInfo.success ? `<button type="button" class="btn btn-primary" id="downloadBackupBtn">下载备份</button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 关闭模态框
  const closeButtons = modal.querySelectorAll('.close-modal');
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  });

  // 点击模态框外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // 下载备份按钮
  const downloadBtn = document.getElementById('downloadBackupBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      downloadBackup(backupInfo.timestamp, backupInfo.databases);
      document.body.removeChild(modal);
    });
  }
}

// 下载备份文件
async function downloadBackup(timestamp, databases) {
  try {
    // 解析时间戳和数据库名称
    const date = new Date(timestamp);
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const dbNames = databases.split(',').map(db => db.trim()).join('_');

    // 构建下载URL
    const downloadUrl = `/api/backup/download?date=${formattedDate}&databases=${encodeURIComponent(dbNames)}`;

    // 创建一个隐藏的a标签并触发下载
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `backup_${formattedDate}_${dbNames}.sql.gz`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    console.error('下载备份失败:', error);
    alert('下载备份失败，请稍后重试');
  }
}