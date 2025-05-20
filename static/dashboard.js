// 仪表板页面脚本

// 模态框点击外部区域关闭确认函数 - 防止误操作
function setupModalCloseConfirmation(modal) {
    let clickOutsideTime = 0;
    const clickConfirmTimeout = 2000; // 2秒内需要再次点击才会关闭

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            const now = new Date().getTime();

            // 第一次点击或超时
            if (clickOutsideTime === 0 || now - clickOutsideTime > clickConfirmTimeout) {
                clickOutsideTime = now;

                // 创建一个提示元素
                const confirmToast = document.createElement('div');
                confirmToast.style.position = 'absolute';
                confirmToast.style.bottom = '20px';
                confirmToast.style.left = '50%';
                confirmToast.style.transform = 'translateX(-50%)';
                confirmToast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                confirmToast.style.color = 'white';
                confirmToast.style.padding = '10px 20px';
                confirmToast.style.borderRadius = '4px';
                confirmToast.style.zIndex = '2000';
                confirmToast.textContent = '再次点击空白区域关闭对话框';

                modal.appendChild(confirmToast);

                // 2秒后自动移除提示
                setTimeout(() => {
                    if (modal.contains(confirmToast)) {
                        modal.removeChild(confirmToast);
                    }
                    clickOutsideTime = 0; // 重置时间
                }, clickConfirmTimeout);

                console.log('第一次点击模态框外部，显示确认提示');
            } else {
                // 第二次点击，关闭模态框
                console.log('在确认时间内再次点击，关闭模态框');
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            }
        }
    });
}

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
        // 移除所有现有的事件监听器
        const newBackupBtn = backupNowBtn.cloneNode(true);
        backupNowBtn.parentNode.replaceChild(newBackupBtn, backupNowBtn);

        // 添加新的事件监听器
        newBackupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 防止重复点击
            if (document.querySelector('.modal')) {
                console.log('已有模态框打开，忽略点击');
                return;
            }

            console.log('打开立即备份模态框');
            showBackupModal();
        });
    }

    // 计划备份按钮
    const scheduleBackupBtn = document.getElementById('scheduleBackupBtn');
    if (scheduleBackupBtn) {
        // 移除所有现有的事件监听器
        const newScheduleBtn = scheduleBackupBtn.cloneNode(true);
        scheduleBackupBtn.parentNode.replaceChild(newScheduleBtn, scheduleBackupBtn);

        // 添加新的事件监听器
        newScheduleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 防止重复点击
            if (document.querySelector('.modal')) {
                console.log('已有模态框打开，忽略点击');
                return;
            }

            console.log('打开计划备份模态框');
            showScheduleBackupModal();
        });
    }

    // 查看备份详情和下载备份
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

    // 退出登录
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
                console.error('退出登录失败:', error);
                alert('退出登录失败，请稍后重试');
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

    // 编辑数据库和测试数据库连接
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

            // 验证必填项
            if (!name) {
                alert('请输入用户名');
                return;
            }

            // 如果提供了密码，验证密码长度
            if (password && password.length < 6) {
                alert('密码长度至少需要6个字符');
                return;
            }

            const settings = {
                name: name,
                password: password
            };

            console.log('提交账户设置更新:', { name, hasPassword: !!password });

            try {
                // 禁用提交按钮以防止重复提交
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

                // 恢复提交按钮状态
                submitButton.textContent = originalText;
                submitButton.disabled = false;

                if (response.ok && data.success) {
                    alert('账户设置已更新' + (password ? '，请使用新密码登录' : ''));
                    // 清除密码输入框
                    document.getElementById('accountPassword').value = '';

                    // 如果更新了密码，1.5秒后自动退出登录
                    if (password) {
                        setTimeout(() => {
                            // 重定向到登录页面
                            fetch('/api/logout', { method: 'POST' })
                                .then(() => {
                                    window.location.href = '/login';
                                })
                                .catch(err => {
                                    console.error('退出登录失败:', err);
                                    window.location.href = '/login';
                                });
                        }, 1500);
                    }
                } else {
                    alert(data.message || '账户设置更新失败');
                }
            } catch (error) {
                console.error('账户设置更新失败:', error);
                alert('账户设置更新失败，请稍后重试');
            }
        });
    }

    // 历史记录过滤器
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

    // 点击模态框外部关闭 - 添加确认机制防止误操作
    setupModalCloseConfirmation(modal);

    // 处理选项卡切换
    const tabButtons = modal.querySelectorAll('.tab-btn');
    const tabContents = modal.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有活动类
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 添加活动类到当前选项卡和相应内容
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // 如果编辑数据库，预填充连接字符串
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

            // 移除可选的前缀 (mysql://)
            if (cleanString.startsWith('mysql://')) {
                cleanString = cleanString.substring(8);
            }

            // 处理主部分和查询参数
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

                // 处理SSL相关参数
                if (queryParams['ssl-mode'] || queryParams['sslmode']) {
                    result.sslMode = queryParams['ssl-mode'] || queryParams['sslmode'];
                }
            }

            // 解析用户名和密码
            const atIndex = mainPart.lastIndexOf('@');
            if (atIndex !== -1) {
                // 解析用户名和密码
                const authPart = mainPart.substring(0, atIndex);
                const authParts = authPart.split(':');
                result.user = authParts[0];
                result.password = authParts.length > 1 ? authParts.slice(1).join(':') : ''; // 处理密码中包含冒号的特殊情况

                // 解析主机和端口
                const hostPart = mainPart.substring(atIndex + 1);

                // 检查是否为TCP格式
                const tcpMatch = hostPart.match(/tcp\(([^:]+):(\d+)\)\/(.+)/);
                if (tcpMatch) {
                    result.host = tcpMatch[1];
                    result.port = tcpMatch[2];
                    result.databases = tcpMatch[3].split(',').map(db => db.trim());
                } else {
                    // 检查是否为标准URL格式 host:port/database
                    const hostPortDbParts = hostPart.split('/');

                    if (hostPortDbParts.length > 0) {
                        const hostPortPart = hostPortDbParts[0];
                        const hostPortParts = hostPortPart.split(':');

                        result.host = hostPortParts[0];
                        result.port = hostPortParts.length > 1 ? hostPortParts[1] : '3306';

                        // 解析数据库名称
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

    // 连接字符串输入变化时自动填充表单
    const connectionStringInput = modal.querySelector('#dbConnectionString');
    if (connectionStringInput) {
        connectionStringInput.addEventListener('input', () => {
            const connectionString = connectionStringInput.value.trim();
            if (connectionString) {
                const parsedData = parseConnectionString(connectionString);
                if (parsedData) {
                    // 自动填充表单
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

        // 检查是否为有效连接字符串
        const connectionString = formData.get('connectionString');
        if (connectionString && connectionString.trim()) {
            const parsedData = parseConnectionString(connectionString.trim());
            if (parsedData) {
                // 将解析后的数据添加到表单
                if (parsedData.host) formData.set('host', parsedData.host);
                if (parsedData.port) formData.set('port', parsedData.port);
                if (parsedData.user) formData.set('user', parsedData.user);
                if (parsedData.password) formData.set('password', parsedData.password);
                if (parsedData.databases) formData.set('databases', parsedData.databases.join(', '));
            } else {
                dbFormError.textContent = '无效的连接字符串格式，请检查后重试';
                return;
            }
        }

        // 验证必填项
        const name = formData.get('name');
        const host = formData.get('host');
        const user = formData.get('user');
        const databases = formData.get('databases');

        if (!name || !host || !user || !databases) {
            dbFormError.textContent = '请填写所有必填项';
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
                dbFormError.textContent = data.message || '数据库更新失败，请稍后重试';
            }
        } catch (error) {
            console.error('数据库更新失败:', error);
            dbFormError.textContent = '数据库更新失败，请稍后重试';
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

    // 点击模态框外部关闭 - 添加确认机制防止误操作
    setupModalCloseConfirmation(modal);

    // 表单提交
    const form = modal.querySelector('#storageForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const storageFormError = document.getElementById('storageFormError');

        // 处理激活状态
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
                storageFormError.textContent = data.message || '存储配置更新失败，请稍后重试';
            }
        } catch (error) {
            console.error('存储配置更新失败:', error);
            storageFormError.textContent = '存储配置更新失败，请稍后重试';
        }
    });
}

// API端点缓存和管理
const apiEndpointManager = {
    // 保存成功的API端点路径
    _successfulEndpoints: {},
    
    // 获取最佳API端点
    getBestEndpoint: function(key, fallbackEndpoints) {
        // 如果有缓存的成功端点，优先使用
        if (this._successfulEndpoints[key]) {
            return this._successfulEndpoints[key];
        }
        // 否则返回端点列表
        return fallbackEndpoints;
    },
    
    // 记录成功的端点
    setSuccessfulEndpoint: function(key, endpoint) {
        console.log(`记录成功的API端点: ${key} -> ${endpoint}`);
        this._successfulEndpoints[key] = endpoint;
        
        // 尝试持久化到localStorage
        try {
            const savedEndpoints = JSON.parse(localStorage.getItem('apiEndpoints') || '{}');
            savedEndpoints[key] = endpoint;
            localStorage.setItem('apiEndpoints', JSON.stringify(savedEndpoints));
        } catch (e) {
            console.warn('无法保存API端点到localStorage:', e);
        }
    },
    
    // 初始化，从localStorage读取之前成功的端点
    init: function() {
        try {
            const savedEndpoints = JSON.parse(localStorage.getItem('apiEndpoints') || '{}');
            this._successfulEndpoints = savedEndpoints;
            console.log('从localStorage加载的API端点:', this._successfulEndpoints);
        } catch (e) {
            console.warn('无法从localStorage读取API端点:', e);
        }
    }
};

// 初始化API端点管理器
apiEndpointManager.init();

// 优化的API请求函数 - 自动处理多端点尝试
async function fetchWithEndpoints(endpointKey, endpointPaths, options = {}) {
    const requestOptions = {
        ...options,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            ...(options.headers || {})
        }
    };

    // 获取最佳端点(单个字符串或多个端点数组)
    const endpoints = apiEndpointManager.getBestEndpoint(endpointKey, endpointPaths);
    const endpointsToTry = Array.isArray(endpoints) ? endpoints : [endpoints];
    
    if (!Array.isArray(endpoints)) {
        console.log(`使用缓存的成功端点: ${endpointKey} -> ${endpoints}`);
    }
    
    // 添加时间戳防止缓存
    const addTimestamp = (url) => {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}_t=${new Date().getTime()}`;
    };
    
    let lastError = null;
    
    // 尝试所有端点
    for (const endpoint of endpointsToTry) {
        try {
            const url = addTimestamp(endpoint);
            console.log(`尝试请求: ${url}`);
            
            // 添加超时处理
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 
                options.timeout || 10000); // 默认10秒超时
            
            const response = await fetch(url, {
                ...requestOptions,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log(`${endpoint} 响应状态: ${response.status}`);
            
            if (!response.ok) {
                // 如果使用的是缓存的端点，尝试清除缓存
                if (!Array.isArray(endpoints) && endpointPaths.length > 0) {
                    delete apiEndpointManager._successfulEndpoints[endpointKey];
                }
                
                const errorText = await response.text();
                console.warn(`端点 ${endpoint} 返回错误: ${response.status}, ${errorText}`);
                lastError = new Error(`HTTP ${response.status}: ${errorText}`);
                continue;
            }
            
            const data = await response.json();
            
            if (data.success) {
                // 记录成功的端点
                apiEndpointManager.setSuccessfulEndpoint(endpointKey, endpoint);
                return { data, endpoint };
            } else {
                const message = data.message || '服务器返回了成功状态码但操作未成功';
                console.warn(`${endpoint} 返回success=false: ${message}`);
                lastError = new Error(message);
            }
        } catch (error) {
            console.warn(`请求 ${endpoint} 失败:`, error.message);
            lastError = error;
            
            // 如果是AbortError (超时)，给出更明确的错误消息
            if (error.name === 'AbortError') {
                lastError = new Error('请求超时，服务器响应时间过长');
            }
        }
    }
    
    // 所有端点都失败了
    throw lastError || new Error('所有API端点尝试均失败');
}

// 显示备份模态框
function showBackupModal() {
    console.log('执行 showBackupModal 函数');

    // 检查是否已经有模态框打开
    if (document.querySelector('.modal')) {
        console.log('已有模态框打开，不再创建新的模态框');
        return;
    }

    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'backupModal'; // 添加ID以便于识别
    modal.style.display = 'block'; // 确保模态框显示
    modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>执行备份</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div id="backupLoadingIndicator" class="loading-indicator">
          <div class="spinner"></div>
          <div>加载中...</div>
        </div>
        <form id="backupForm" style="display: none;">
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
    console.log('备份模态框已添加到DOM');

    // 关闭模态框
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('关闭备份模态框');
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        });
    });

    // 点击模态框外部关闭 - 添加确认机制防止误操作
    setupModalCloseConfirmation(modal);

    // 加载数据库和存储列表
    loadBackupFormData().then(() => {
        // 加载完成后，隐藏加载指示器，显示表单
        const loadingIndicator = document.getElementById('backupLoadingIndicator');
        const backupForm = document.getElementById('backupForm');

        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (backupForm) backupForm.style.display = 'block';
    }).catch(error => {
        console.error('加载备份表单数据失败:', error);
        const loadingIndicator = document.getElementById('backupLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = '<div class="error-message">加载数据失败，请刷新页面重试</div>';
        }
    });

    // 表单提交
    const form = document.getElementById('backupForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('提交备份表单');

            const formData = new FormData(form);
            const backupFormError = document.getElementById('backupFormError');
            backupFormError.textContent = ''; // 清除之前的错误信息

            // 获取选中的数据库
            const selectedDatabases = [];
            document.querySelectorAll('input[name="databases"]:checked').forEach(checkbox => {
                selectedDatabases.push(checkbox.value);
            });

            if (selectedDatabases.length === 0) {
                backupFormError.textContent = '请至少选择一个数据库';
                backupFormError.style.color = 'red';
                return;
            }

            formData.delete('databases');
            selectedDatabases.forEach(db => {
                formData.append('databases', db);
            });

            try {
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = '备份中...';
                }

                // 获取选中的数据库和存储
                const storageId = formData.get('storageId');
                if (!storageId) {
                    backupFormError.textContent = '请选择一个存储配置';
                    backupFormError.style.color = 'red';
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = '开始备份';
                    }
                    return;
                }

                console.log('提交备份请求:', {
                    databases: selectedDatabases,
                    storageId
                });

                // 定义备份API端点
                const BACKUP_ENDPOINTS = [
                    '/api/backup',
                    '/api/start-backup'
                ];

                // 将FormData转换为URL编码字符串
                const formDataParams = new URLSearchParams();
                for (const [key, value] of formData.entries()) {
                    formDataParams.append(key, value);
                }

                // 使用统一的API请求函数提交表单
                const result = await fetchWithEndpoints('backupStart', BACKUP_ENDPOINTS, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formDataParams,
                    timeout: 10000 // 10秒超时
                });

                console.log('备份请求提交成功:', result.data);

                // 成功，关闭模态框
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }

                // 显示成功消息
                alert('备份已开始，请查看备份历史获取进度');
                
                // 3秒后刷新页面以显示新的备份
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } catch (error) {
                console.error('备份请求失败:', error.message);
                backupFormError.textContent = error.message || '服务器连接失败，请稍后重试';
                backupFormError.style.color = 'red';
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = '开始备份';
                }
            }
        });
    } else {
        console.error('未找到备份表单元素');
    }
}

// 加载备份表单数据
async function loadBackupFormData() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('开始加载备份表单数据');

            // 定义API端点
            const DB_ENDPOINTS = ['/api/databases'];
            const STORAGE_ENDPOINTS = ['/api/storage'];

            // 加载数据库列表
            console.log('请求数据库列表');
            try {
                const dbResult = await fetchWithEndpoints('databasesGet', DB_ENDPOINTS, {
                    method: 'GET',
                    timeout: 5000
                });
                
                const dbData = dbResult.data;
                console.log('数据库列表响应:', dbData);

                const databaseCheckboxes = document.getElementById('databaseCheckboxes');
                if (!databaseCheckboxes) {
                    console.error('未找到数据库复选框容器元素');
                    reject(new Error('DOM元素未找到: databaseCheckboxes'));
                    return;
                }

                databaseCheckboxes.innerHTML = '';

                if (dbData.success && dbData.databases && dbData.databases.length > 0) {
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
            } catch (error) {
                console.error('获取数据库列表失败:', error.message);
                const databaseCheckboxes = document.getElementById('databaseCheckboxes');
                if (databaseCheckboxes) {
                    databaseCheckboxes.innerHTML = '<div class="error-message">加载数据库列表失败</div>';
                }
            }

            // 加载存储列表
            console.log('请求存储列表');
            try {
                const storageResult = await fetchWithEndpoints('storageGet', STORAGE_ENDPOINTS, {
                    method: 'GET',
                    timeout: 5000
                });
                
                const storageData = storageResult.data;
                console.log('存储列表响应:', storageData);

                const storageSelect = document.getElementById('backupStorage');
                if (!storageSelect) {
                    console.error('未找到存储选择器元素');
                    reject(new Error('DOM元素未找到: backupStorage'));
                    return;
                }

                // 清空现有选项
                storageSelect.innerHTML = '';

                if (storageData.success && storageData.storage && storageData.storage.length > 0) {
                    // 添加默认选项
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = '-- 选择存储 --';
                    defaultOption.disabled = true;
                    storageSelect.appendChild(defaultOption);

                    // 添加存储选项
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
                    option.selected = true;
                    storageSelect.appendChild(option);
                }
            } catch (error) {
                console.error('获取存储列表失败:', error.message);
                const storageSelect = document.getElementById('backupStorage');
                if (storageSelect) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = '加载存储配置失败';
                    option.disabled = true;
                    option.selected = true;
                    storageSelect.innerHTML = '';
                    storageSelect.appendChild(option);
                }
            }

            console.log('备份表单数据加载完成');
            resolve();
        } catch (error) {
            console.error('加载备份表单数据失败:', error);
            reject(error);
        }
    });
}

// 显示计划备份模态框
function showScheduleBackupModal() {
    console.log('执行 showScheduleBackupModal 函数');

    // 检查是否已经有模态框打开
    if (document.querySelector('.modal')) {
        console.log('已有模态框打开，不再创建新的模态框');
        return;
    }

    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'scheduleBackupModal'; // 添加ID以便于识别
    modal.style.display = 'block'; // 确保模态框显示
    modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>计划备份</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div id="scheduleLoadingIndicator" class="loading-indicator">
          <div class="spinner"></div>
          <div>加载中...</div>
        </div>
        <form id="scheduleForm" style="display: none;">
          <div class="form-group">
            <label>选择数据库</label>
            <div class="checkbox-group" id="scheduleDatabaseCheckboxes">
              <div class="loading">加载数据库列表...</div>
            </div>
          </div>
          <div class="form-group">
            <label for="scheduleStorage">选择存储</label>
            <select id="scheduleStorage" name="storageId" class="form-select" required>
              <option value="">-- 选择存储 --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="scheduleCron">备份计划</label>
            <select id="scheduleCron" name="scheduleType" class="form-select" required>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          
          <div id="scheduleTimeWrapper" class="form-group">
            <label for="scheduleTime">备份时间</label>
            <input type="time" id="scheduleTime" name="scheduleTime" value="00:00" class="form-input" required>
          </div>
          
          <div id="weekdayWrapper" class="form-group" style="display: none;">
            <label for="scheduleWeekday">星期几</label>
            <select id="scheduleWeekday" name="scheduleWeekday" class="form-select">
              <option value="0">星期日</option>
              <option value="1">星期一</option>
              <option value="2">星期二</option>
              <option value="3">星期三</option>
              <option value="4">星期四</option>
              <option value="5">星期五</option>
              <option value="6">星期六</option>
            </select>
          </div>
          
          <div id="monthDayWrapper" class="form-group" style="display: none;">
            <label for="scheduleMonthDay">日期</label>
            <select id="scheduleMonthDay" name="scheduleMonthDay" class="form-select">
              ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}日</option>`).join('')}
            </select>
          </div>
          
          <div id="customCronWrapper" class="form-group" style="display: none;">
            <label for="customCron">自定义Cron表达式</label>
            <input type="text" id="customCron" name="customCron" placeholder="例如: 0 0 * * *" class="form-input">
            <div class="form-hint">格式: 分 时 日 月 星期</div>
          </div>
          
          <div class="form-group">
            <label for="retentionDays">保留天数</label>
            <input type="number" id="retentionDays" name="retentionDays" value="30" min="1" max="365" class="form-input" required>
            <div class="form-hint">超过指定天数的备份将被自动删除（本地和云端）</div>
          </div>
          <div class="form-error" id="scheduleFormError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">取消</button>
        <button type="submit" class="btn btn-primary" form="scheduleForm">保存计划</button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);
    console.log('计划备份模态框已添加到DOM');

    // 关闭模态框
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('关闭计划备份模态框');
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        });
    });

    // 点击模态框外部关闭 - 添加确认机制防止误操作
    setupModalCloseConfirmation(modal);

    // 初始化计划备份选择器
    const scheduleTypeSelector = document.getElementById('scheduleCron');
    const weekdayWrapper = document.getElementById('weekdayWrapper');
    const monthDayWrapper = document.getElementById('monthDayWrapper');
    const customCronWrapper = document.getElementById('customCronWrapper');

    if (scheduleTypeSelector) {
        scheduleTypeSelector.addEventListener('change', function () {
            // 隐藏所有相关包装器
            weekdayWrapper.style.display = 'none';
            monthDayWrapper.style.display = 'none';
            customCronWrapper.style.display = 'none';

            // 根据选择显示相应元素
            switch (this.value) {
                case 'weekly':
                    weekdayWrapper.style.display = 'block';
                    break;
                case 'monthly':
                    monthDayWrapper.style.display = 'block';
                    break;
                case 'custom':
                    customCronWrapper.style.display = 'block';
                    break;
            }
        });

        // 触发一次change事件以设置初始状态
        scheduleTypeSelector.dispatchEvent(new Event('change'));
    }

    // 加载数据库和存储列表
    loadScheduleFormData().then(() => {
        // 加载完成后，隐藏加载指示器，显示表单
        const loadingIndicator = document.getElementById('scheduleLoadingIndicator');
        const scheduleForm = document.getElementById('scheduleForm');

        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (scheduleForm) scheduleForm.style.display = 'block';
    }).catch(error => {
        console.error('加载计划备份表单数据失败:', error);
        const loadingIndicator = document.getElementById('scheduleLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = '<div class="error-message">加载数据失败，请刷新页面重试</div>';
        }
    });

    // 表单提交
    const form = document.getElementById('scheduleForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('提交计划备份表单');

            const formData = new FormData(form);
            const scheduleFormError = document.getElementById('scheduleFormError');
            scheduleFormError.textContent = ''; // 清除之前的错误信息

            // 获取选中的数据库
            const selectedDatabases = [];
            document.querySelectorAll('input[name="scheduleDatabases"]:checked').forEach(checkbox => {
                selectedDatabases.push(checkbox.value);
            });

            if (selectedDatabases.length === 0) {
                scheduleFormError.textContent = '请至少选择一个数据库';
                scheduleFormError.style.color = 'red';
                return;
            }

            try {
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = '保存中...';
                }

                // 获取表单数据并准备提交
                const scheduleType = formData.get('scheduleType');
                const scheduleTime = formData.get('scheduleTime');
                
                // 准备发送的数据
                const scheduleFormData = new FormData();
                
                // 添加数据库ID列表
                selectedDatabases.forEach(db => {
                    scheduleFormData.append('databases', db);
                });
                
                // 添加存储ID
                const storageId = formData.get('storageId');
                if (!storageId) {
                    scheduleFormError.textContent = '请选择一个存储配置';
                    scheduleFormError.style.color = 'red';
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = '保存计划';
                    }
                    return;
                }
                scheduleFormData.append('storageId', storageId);
                
                // 转换前端字段名为后端期望的字段名
                let frequency = '';
                
                switch (scheduleType) {
                    case 'daily':
                        frequency = 'daily';
                        break;
                    case 'weekly':
                        frequency = 'weekly';
                        const weekday = formData.get('scheduleWeekday') || '0';
                        scheduleFormData.append('weekday', weekday);
                        break;
                    case 'monthly':
                        frequency = 'monthly';
                        const dayOfMonth = formData.get('scheduleMonthDay') || '1';
                        scheduleFormData.append('dayOfMonth', dayOfMonth);
                        break;
                    case 'custom':
                        // 自定义cron表达式，使用daily作为后备
                        frequency = 'daily';
                        break;
                }
                
                scheduleFormData.append('frequency', frequency);
                scheduleFormData.append('time', scheduleTime);
                scheduleFormData.append('retention', formData.get('retentionDays') || '30');

                console.log('提交计划备份设置:', {
                    frequency,
                    time: scheduleTime,
                    retention: formData.get('retentionDays'),
                    databases: selectedDatabases,
                    storageId
                });

                // 将FormData转换为URL编码字符串
                const formDataParams = new URLSearchParams();
                for (const [key, value] of scheduleFormData.entries()) {
                    formDataParams.append(key, value);
                }
                
                // API端点定义
                const SCHEDULE_ENDPOINTS = [
                    '/api/schedule',
                    '/api/schedule/backup'
                ];
                
                // 使用统一的API请求函数提交表单
                const result = await fetchWithEndpoints('schedulePost', SCHEDULE_ENDPOINTS, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formDataParams,
                    timeout: 10000 // 10秒超时
                });
                
                console.log('计划备份设置提交成功:', result.data);
                
                // 成功，关闭模态框并刷新页面
                console.log('计划备份设置成功');
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
                alert('计划备份已设置');
                window.location.reload();
            } catch (error) {
                console.error('计划备份请求失败:', error.message);
                scheduleFormError.textContent = error.message || '服务器连接失败，请稍后重试';
                scheduleFormError.style.color = 'red';
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = '保存计划';
                }
            }
        });
    } else {
        console.error('未找到计划备份表单元素');
    }
}

// 加载计划备份表单数据
async function loadScheduleFormData() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('开始加载计划备份表单数据');
            
            // API端点定义
            const SCHEDULE_ENDPOINTS = [
                '/api/schedule',
                '/api/schedule/backup'
            ];
            
            // 使用统一的API请求函数获取计划备份设置
            let savedConfig = null;
            let result;
            
            try {
                // 获取计划备份设置
                result = await fetchWithEndpoints('scheduleGet', SCHEDULE_ENDPOINTS, {
                    method: 'GET',
                    timeout: 5000 // 5秒超时
                });
                
                if (result.data.config) {
                    savedConfig = result.data.config;
                    console.log('成功获取计划备份设置:', savedConfig);
                } else {
                    console.log('未找到已保存的计划备份设置');
                }
            } catch (error) {
                console.warn('获取计划备份设置失败:', error.message);
                // 这里我们继续执行，因为即使没有已保存的设置，我们仍然可以加载表单
            }
            
            // 获取数据库列表
            try {
                console.log('请求数据库列表');
                const dbResult = await fetchWithEndpoints('databasesGet', ['/api/databases'], {
                    method: 'GET'
                });
                
                const dbData = dbResult.data;
                console.log('数据库列表响应:', dbData);
                
                const databaseCheckboxes = document.getElementById('scheduleDatabaseCheckboxes');
                if (!databaseCheckboxes) {
                    throw new Error('DOM元素未找到: scheduleDatabaseCheckboxes');
                }
                
                databaseCheckboxes.innerHTML = '';
                
                // 如果有已保存的数据库列表，获取它们的ID
                const savedDatabaseIds = savedConfig?.databases || [];
                console.log('已保存的数据库IDs:', savedDatabaseIds);
                
                if (dbData.success && dbData.databases && dbData.databases.length > 0) {
                    dbData.databases.forEach(db => {
                        const checkbox = document.createElement('div');
                        checkbox.className = 'checkbox-item';
                        // 如果数据库ID在已保存列表中，则选中它
                        const isChecked = savedDatabaseIds.includes(db.id) ? 'checked' : '';
                        checkbox.innerHTML = `
                <label>
                  <input type="checkbox" name="scheduleDatabases" value="${db.id}" ${isChecked}>
                  ${db.name} (${db.databases.join(', ')})
                </label>
              `;
                        databaseCheckboxes.appendChild(checkbox);
                    });
                } else {
                    databaseCheckboxes.innerHTML = '<div class="empty-message">没有可用的数据库配置</div>';
                }
            } catch (error) {
                console.error('获取数据库列表失败:', error.message);
                reject(error);
                return;
            }
            
            // 获取存储列表
            try {
                console.log('请求存储列表');
                const storageResult = await fetchWithEndpoints('storageGet', ['/api/storage'], {
                    method: 'GET'
                });
                
                const storageData = storageResult.data;
                console.log('存储列表响应:', storageData);
                
                const storageSelect = document.getElementById('scheduleStorage');
                if (!storageSelect) {
                    throw new Error('DOM元素未找到: scheduleStorage');
                }
                
                // 清空现有选项
                storageSelect.innerHTML = '';
                
                if (storageData.success && storageData.storage && storageData.storage.length > 0) {
                    // 添加默认选项
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = '-- 选择存储 --';
                    defaultOption.disabled = true;
                    storageSelect.appendChild(defaultOption);
                    
                    // 添加存储选项
                    storageData.storage.forEach(storage => {
                        const option = document.createElement('option');
                        option.value = storage.id;
                        option.textContent = storage.name;
                        
                        // 如果有已保存的存储ID，使用它；否则使用活跃的存储
                        if ((savedConfig && storage.id === savedConfig.storageId) || 
                            (!savedConfig && storage.active)) {
                            option.selected = true;
                        }
                        
                        storageSelect.appendChild(option);
                    });
                } else {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = '没有可用的存储配置';
                    option.disabled = true;
                    option.selected = true;
                    storageSelect.appendChild(option);
                }
            } catch (error) {
                console.error('获取存储列表失败:', error.message);
                reject(error);
                return;
            }
            
            // 如果有保存的配置，设置其他表单字段
            if (savedConfig) {
                console.log('正在填充已保存的配置到表单:', savedConfig);
                
                // 设置备份频率
                const scheduleTypeSelect = document.getElementById('scheduleCron');
                if (scheduleTypeSelect) {
                    let scheduleType = 'daily'; // 默认日常
                    
                    switch (savedConfig.frequency) {
                        case 'daily':
                            scheduleType = 'daily';
                            break;
                        case 'weekly':
                            scheduleType = 'weekly';
                            break;
                        case 'monthly':
                            scheduleType = 'monthly';
                            break;
                        default:
                            console.log('未知的频率类型:', savedConfig.frequency, '使用默认值daily');
                            scheduleType = 'daily';
                            break;
                    }
                    
                    console.log('设置备份频率为:', scheduleType);
                    scheduleTypeSelect.value = scheduleType;
                    // 触发change事件以显示相应的子选项
                    scheduleTypeSelect.dispatchEvent(new Event('change'));
                } else {
                    console.error('未找到备份频率选择器');
                }
                
                // 设置备份时间
                const scheduleTimeInput = document.getElementById('scheduleTime');
                if (scheduleTimeInput && savedConfig.time) {
                    console.log('设置备份时间为:', savedConfig.time);
                    scheduleTimeInput.value = savedConfig.time;
                } else {
                    console.error('未找到备份时间输入框或时间值为空');
                }
                
                // 设置星期几（如果是每周备份）
                if (savedConfig.frequency === 'weekly' && savedConfig.weekday !== undefined) {
                    const weekdaySelect = document.getElementById('scheduleWeekday');
                    if (weekdaySelect) {
                        console.log('设置星期几为:', savedConfig.weekday.toString());
                        weekdaySelect.value = savedConfig.weekday.toString();
                    } else {
                        console.error('未找到星期几选择器');
                    }
                }
                
                // 设置日期（如果是每月备份）
                if (savedConfig.frequency === 'monthly' && savedConfig.dayOfMonth !== undefined) {
                    const monthDaySelect = document.getElementById('scheduleMonthDay');
                    if (monthDaySelect) {
                        console.log('设置月日期为:', savedConfig.dayOfMonth.toString());
                        monthDaySelect.value = savedConfig.dayOfMonth.toString();
                    } else {
                        console.error('未找到月日期选择器');
                    }
                }
                
                // 设置保留天数
                const retentionInput = document.getElementById('retentionDays');
                if (retentionInput && savedConfig.retention) {
                    console.log('设置保留天数为:', savedConfig.retention.toString());
                    retentionInput.value = savedConfig.retention.toString();
                } else {
                    console.error('未找到保留天数输入框或保留天数值为空');
                }
                
                // 确保相关的容器显示或隐藏
                updateScheduleFormVisibility(savedConfig.frequency);
            } else {
                console.log('没有找到已保存的计划备份配置');
            }
            
            console.log('计划备份表单数据加载完成');
            resolve();
        } catch (error) {
            console.error('加载计划备份表单数据失败:', error);
            
            const databaseCheckboxes = document.getElementById('scheduleDatabaseCheckboxes');
            if (databaseCheckboxes) {
                databaseCheckboxes.innerHTML = `<div class="error-message">
                  <h4>加载数据失败</h4>
                  <p>${error.message || '未知错误'}</p>
                  <p>请检查网络连接或刷新页面重试</p>
                </div>`;
            }
            
            reject(error);
        }
    });
}

// 辅助函数：根据频率更新表单UI元素的可见性
function updateScheduleFormVisibility(frequency) {
    const weekdayWrapper = document.getElementById('weekdayWrapper');
    const monthDayWrapper = document.getElementById('monthDayWrapper');
    const customCronWrapper = document.getElementById('customCronWrapper');
    
    // 默认隐藏所有相关容器
    if (weekdayWrapper) weekdayWrapper.style.display = 'none';
    if (monthDayWrapper) monthDayWrapper.style.display = 'none';
    if (customCronWrapper) customCronWrapper.style.display = 'none';
    
    // 根据频率显示相应容器
    switch (frequency) {
        case 'weekly':
            if (weekdayWrapper) weekdayWrapper.style.display = 'block';
            break;
        case 'monthly':
            if (monthDayWrapper) monthDayWrapper.style.display = 'block';
            break;
        case 'custom':
            if (customCronWrapper) customCronWrapper.style.display = 'block';
            break;
    }
}