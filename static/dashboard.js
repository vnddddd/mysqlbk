// u4eeau8868u677fu9875u9762u811au672c

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
    // u5bfcu822au83dcu5355u5207u6362
    const navLinks = document.querySelectorAll('.dashboard-nav a');
    const sections = document.querySelectorAll('.dashboard-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // u83b7u53d6u76eeu6807u90e8u5206u7684ID
            const targetId = link.getAttribute('href').substring(1);

            // u79fbu9664u6240u6709u6d3bu52a8u7c7b
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            // u6dfbu52a0u6d3bu52a8u7c7bu5230u5f53u524du94feu63a5u548cu76eeu6807u90e8u5206
            link.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // u7acbu5373u5907u4efdu6309u94ae
    const backupNowBtn = document.getElementById('manualBackupBtn');
    if (backupNowBtn) {
        // u79fbu9664u6240u6709u73b0u6709u7684u4e8bu4ef6u76d1u542cu5668
        const newBackupBtn = backupNowBtn.cloneNode(true);
        backupNowBtn.parentNode.replaceChild(newBackupBtn, backupNowBtn);

        // u6dfbu52a0u65b0u7684u4e8bu4ef6u76d1u542cu5668
        newBackupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // u9632u6b62u91cdu590du70b9u51fb
            if (document.querySelector('.modal')) {
                console.log('u5df2u6709u6a21u6001u6846u6253u5f00uff0cu5ffdu7565u70b9u51fb');
                return;
            }

            console.log('u6253u5f00u7acbu5373u5907u4efdu6a21u6001u6846');
            showBackupModal();
        });
    }

    // u8ba1u5212u5907u4efdu6309u94ae
    const scheduleBackupBtn = document.getElementById('scheduleBackupBtn');
    if (scheduleBackupBtn) {
        // u79fbu9664u6240u6709u73b0u6709u7684u4e8bu4ef6u76d1u542cu5668
        const newScheduleBtn = scheduleBackupBtn.cloneNode(true);
        scheduleBackupBtn.parentNode.replaceChild(newScheduleBtn, scheduleBackupBtn);

        // u6dfbu52a0u65b0u7684u4e8bu4ef6u76d1u542cu5668
        newScheduleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // u9632u6b62u91cdu590du70b9u51fb
            if (document.querySelector('.modal')) {
                console.log('u5df2u6709u6a21u6001u6846u6253u5f00uff0cu5ffdu7565u70b9u51fb');
                return;
            }

            console.log('u6253u5f00u8ba1u5212u5907u4efdu6a21u6001u6846');
            showScheduleBackupModal();
        });
    }

    // u5907u4efdu5386u53f2u64cdu4f5c
    document.addEventListener('click', (e) => {
        // u67e5u770bu5907u4efdu8be6u60c5
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

        // u4e0bu8f7du5907u4efd
        if (e.target.closest('.download-backup')) {
            const historyRow = e.target.closest('.history-row');
            const timestamp = historyRow.querySelector('.history-cell:nth-child(2)').textContent;
            const databases = historyRow.querySelector('.history-cell:nth-child(3)').textContent;

            downloadBackup(timestamp, databases);
        }
    });

    // u767bu51fau529fu80fd
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
                console.error('u767bu51fau8bf7u6c42u5931u8d25:', error);
                alert('u767bu51fau5931u8d25uff0cu8bf7u7a0du540eu91cdu8bd5');
            }
        });
    }

    // u6dfbu52a0u6570u636eu5e93u6309u94ae
    const addDatabaseBtn = document.getElementById('addDatabaseBtn');
    if (addDatabaseBtn) {
        addDatabaseBtn.addEventListener('click', () => {
            showDatabaseModal();
        });
    }

    // u6dfbu52a0u5b58u50a8u6309u94ae
    const addStorageBtn = document.getElementById('addStorageBtn');
    if (addStorageBtn) {
        addStorageBtn.addEventListener('click', () => {
            showStorageModal();
        });
    }

    // u624bu52a8u5907u4efdu6309u94ae
    const manualBackupBtn = document.getElementById('manualBackupBtn');
    if (manualBackupBtn) {
        manualBackupBtn.addEventListener('click', () => {
            showBackupModal();
        });
    }

    // u6570u636eu5e93u9879u76eeu64cdu4f5c
    document.addEventListener('click', (e) => {
        // u7f16u8f91u6570u636eu5e93
        if (e.target.closest('.edit-db')) {
            const dbItem = e.target.closest('.database-item');
            const dbId = dbItem.getAttribute('data-id');
            editDatabase(dbId);
        }

        // u6d4bu8bd5u6570u636eu5e93u8fdeu63a5
        if (e.target.closest('.test-db')) {
            const dbItem = e.target.closest('.database-item');
            const dbId = dbItem.getAttribute('data-id');
            testDatabaseConnection(dbId);
        }

        // u5220u9664u6570u636eu5e93
        if (e.target.closest('.delete-db')) {
            const dbItem = e.target.closest('.database-item');
            const dbId = dbItem.getAttribute('data-id');
            deleteDatabase(dbId);
        }

        // u7f16u8f91u5b58u50a8
        if (e.target.closest('.edit-storage')) {
            const storageItem = e.target.closest('.storage-item');
            const storageId = storageItem.getAttribute('data-id');
            editStorage(storageId);
        }

        // u6d4bu8bd5u5b58u50a8u8fdeu63a5
        if (e.target.closest('.test-storage')) {
            const storageItem = e.target.closest('.storage-item');
            const storageId = storageItem.getAttribute('data-id');
            testStorageConnection(storageId);
        }

        // u5220u9664u5b58u50a8
        if (e.target.closest('.delete-storage')) {
            const storageItem = e.target.closest('.storage-item');
            const storageId = storageItem.getAttribute('data-id');
            deleteStorage(storageId);
        }
    });



    // u8d26u6237u8bbeu7f6eu8868u5355
    const accountSettingsForm = document.getElementById('accountSettingsForm');
    if (accountSettingsForm) {
        accountSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(accountSettingsForm);
            const name = formData.get('name');
            const password = formData.get('password');

            // u9a8cu8bc1u8f93u5165
            if (!name) {
                alert('u59d3u540du4e0du80fdu4e3au7a7a');
                return;
            }

            // u5982u679cu63d0u4f9bu4e86u5bc6u7801uff0cu9a8cu8bc1u5bc6u7801u957fu5ea6
            if (password && password.length < 6) {
                alert('u5bc6u7801u957fu5ea6u81f3u5c11u4e3a6u4e2au5b57u7b26');
                return;
            }

            const settings = {
                name: name,
                password: password
            };

            console.log('u63d0u4ea4u8d26u6237u8bbeu7f6eu66f4u65b0:', { name, hasPassword: !!password });

            try {
                // u663eu793au52a0u8f7du72b6u6001
                const submitButton = accountSettingsForm.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                submitButton.textContent = 'u66f4u65b0u4e2d...';
                submitButton.disabled = true;

                const response = await fetch('/api/settings/account', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(settings)
                });

                const data = await response.json();
                console.log('u8d26u6237u8bbeu7f6eu66f4u65b0u54cdu5e94:', data);

                // u6062u590du6309u94aeu72b6u6001
                submitButton.textContent = originalText;
                submitButton.disabled = false;

                if (response.ok && data.success) {
                    alert('u8d26u6237u8bbeu7f6eu5df2u66f4u65b0' + (password ? 'uff0cu8bf7u4f7fu7528u65b0u5bc6u7801u91cdu65b0u767bu5f55' : ''));
                    // u6e05u7a7au5bc6u7801u5b57u6bb5
                    document.getElementById('accountPassword').value = '';

                    // u5982u679cu66f4u65b0u4e86u5bc6u7801uff0cu5ef6u8fdfu540eu767bu51fa
                    if (password) {
                        setTimeout(() => {
                            // u767bu51fau5e76u91cdu5b9au5411u5230u767bu5f55u9875u9762
                            fetch('/api/logout', { method: 'POST' })
                                .then(() => {
                                    window.location.href = '/login';
                                })
                                .catch(err => {
                                    console.error('u767bu51fau5931u8d25:', err);
                                    window.location.href = '/login';
                                });
                        }, 1500);
                    }
                } else {
                    alert(data.message || 'u66f4u65b0u8d26u6237u8bbeu7f6eu5931u8d25');
                }
            } catch (error) {
                console.error('u66f4u65b0u8d26u6237u8bbeu7f6eu5931u8d25:', error);
                alert('u66f4u65b0u8d26u6237u8bbeu7f6eu5931u8d25uff0cu8bf7u7a0du540eu91cdu8bd5');
            }
        });
    }

    // u5907u4efdu5386u53f2u7b5bu9009
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

    // u5173u95edu6a21u6001u6846
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    });

    // u70b9u51fbu6a21u6001u6846u5916u90e8u5173u95ed - u6dfbu52a0u786eu8ba4u673au5236u9632u6b62u8befu64cdu4f5c
    setupModalCloseConfirmation(modal);

    // u5904u7406u9009u9879u5361u5207u6362
    const tabButtons = modal.querySelectorAll('.tab-btn');
    const tabContents = modal.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // u79fbu9664u6240u6709u6d3bu52a8u7c7b
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // u6dfbu52a0u6d3bu52a8u7c7bu5230u5f53u524du6309u94aeu548cu5bf9u5e94u5185u5bb9
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // u5982u679cu662fu7f16u8f91u6a21u5f0fuff0cu9884u586bu8fdeu63a5u5b57u7b26u4e32
    if (dbData) {
        const connectionStringInput = modal.querySelector('#dbConnectionString');
        if (connectionStringInput && dbData.user && dbData.host) {
            const connectionString = `${dbData.user}:${dbData.password}@tcp(${dbData.host}:${dbData.port})/${dbData.databases.join(',')}`;
            connectionStringInput.value = connectionString;
        }
    }

    // u8fdeu63a5u5b57u7b26u4e32u89e3u6790u51fdu6570
    function parseConnectionString(connectionString) {
        try {
            console.log("u5f00u59cbu89e3u6790u8fdeu63a5u5b57u7b26u4e32:", connectionString);
            const result = {};
            let cleanString = connectionString.trim();

            // u79fbu9664u53efu80fdu7684u534fu8baeu524du7f00 (mysql://)
            if (cleanString.startsWith('mysql://')) {
                cleanString = cleanString.substring(8);
            }

            // u5904u7406u67e5u8be2u53c2u6570
            let mainPart = cleanString;
            let queryParams = {};

            if (cleanString.includes('?')) {
                const parts = cleanString.split('?');
                mainPart = parts[0];

                // u89e3u6790u67e5u8be2u53c2u6570
                if (parts[1]) {
                    const queryParts = parts[1].split('&');
                    queryParts.forEach(param => {
                        const [key, value] = param.split('=');
                        if (key && value) {
                            queryParams[key.toLowerCase()] = value;
                        }
                    });
                }

                // u5b58u50a8SSLu76f8u5173u53c2u6570
                if (queryParams['ssl-mode'] || queryParams['sslmode']) {
                    result.sslMode = queryParams['ssl-mode'] || queryParams['sslmode'];
                }
            }

            // u63d0u53d6u8ba4u8bc1u4fe1u606fu548cu4e3bu673au4fe1u606f
            const atIndex = mainPart.lastIndexOf('@');
            if (atIndex !== -1) {
                // u63d0u53d6u7528u6237u540du548cu5bc6u7801
                const authPart = mainPart.substring(0, atIndex);
                const authParts = authPart.split(':');
                result.user = authParts[0];
                result.password = authParts.length > 1 ? authParts.slice(1).join(':') : ''; // u5904u7406u5bc6u7801u4e2du53efu80fdu5305u542bu5192u53f7u7684u60c5u51b5

                // u63d0u53d6u4e3bu673au3001u7aefu53e3u548cu6570u636eu5e93
                const hostPart = mainPart.substring(atIndex + 1);

                // u68c0u67e5u662fu5426u4f7fu7528tcp(host:port)u683cu5f0f
                const tcpMatch = hostPart.match(/tcp\(([^:]+):(\d+)\)\/(.+)/);
                if (tcpMatch) {
                    result.host = tcpMatch[1];
                    result.port = tcpMatch[2];
                    result.databases = tcpMatch[3].split(',').map(db => db.trim());
                } else {
                    // u4f7fu7528u6807u51c6URLu683cu5f0f host:port/database
                    const hostPortDbParts = hostPart.split('/');

                    if (hostPortDbParts.length > 0) {
                        const hostPortPart = hostPortDbParts[0];
                        const hostPortParts = hostPortPart.split(':');

                        result.host = hostPortParts[0];
                        result.port = hostPortParts.length > 1 ? hostPortParts[1] : '3306';

                        // u63d0u53d6u6570u636eu5e93u540du79f0
                        if (hostPortDbParts.length > 1) {
                            result.databases = hostPortDbParts[1].split(',').map(db => db.trim());
                        }
                    }
                }
            }

            console.log("u89e3u6790u7ed3u679c:", result);
            return result;
        } catch (error) {
            console.error('u89e3u6790u8fdeu63a5u5b57u7b26u4e32u5931u8d25:', error);
            return null;
        }
    }

    // u8fdeu63a5u5b57u7b26u4e32u8f93u5165u53d8u5316u65f6uff0cu81eau52a8u586bu5145u9ad8u7ea7u6a21u5f0fu5b57u6bb5
    const connectionStringInput = modal.querySelector('#dbConnectionString');
    if (connectionStringInput) {
        connectionStringInput.addEventListener('input', () => {
            const connectionString = connectionStringInput.value.trim();
            if (connectionString) {
                const parsedData = parseConnectionString(connectionString);
                if (parsedData) {
                    // u586bu5145u9ad8u7ea7u6a21u5f0fu5b57u6bb5
                    if (parsedData.host) modal.querySelector('#dbHost').value = parsedData.host;
                    if (parsedData.port) modal.querySelector('#dbPort').value = parsedData.port;
                    if (parsedData.user) modal.querySelector('#dbUser').value = parsedData.user;
                    if (parsedData.password) modal.querySelector('#dbPassword').value = parsedData.password;
                    if (parsedData.databases) modal.querySelector('#dbDatabases').value = parsedData.databases.join(', ');
                }
            }
        });
    }

    // u8868u5355u63d0u4ea4
    const form = modal.querySelector('#databaseForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const dbFormError = document.getElementById('dbFormError');

        // u68c0u67e5u662fu5426u4f7fu7528u4e86u8fdeu63a5u5b57u7b26u4e32
        const connectionString = formData.get('connectionString');
        if (connectionString && connectionString.trim()) {
            const parsedData = parseConnectionString(connectionString.trim());
            if (parsedData) {
                // u4f7fu7528u89e3u6790u7684u6570u636eu66ffu6362u8868u5355u6570u636e
                if (parsedData.host) formData.set('host', parsedData.host);
                if (parsedData.port) formData.set('port', parsedData.port);
                if (parsedData.user) formData.set('user', parsedData.user);
                if (parsedData.password) formData.set('password', parsedData.password);
                if (parsedData.databases) formData.set('databases', parsedData.databases.join(', '));
            } else {
                dbFormError.textContent = 'u8fdeu63a5u5b57u7b26u4e32u683cu5f0fu65e0u6548uff0cu8bf7u68c0u67e5u540eu91cdu8bd5';
                return;
            }
        }

        // u9a8cu8bc1u5fc5u586bu5b57u6bb5
        const name = formData.get('name');
        const host = formData.get('host');
        const user = formData.get('user');
        const databases = formData.get('databases');

        if (!name || !host || !user || !databases) {
            dbFormError.textContent = 'u8bf7u586bu5199u6240u6709u5fc5u8981u5b57u6bb5';
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
                // u6210u529fuff0cu5173u95edu6a21u6001u6846u5e76u5237u65b0u9875u9762
                document.body.removeChild(modal);
                window.location.reload();
            } else {
                // u5931u8d25uff0cu663eu793au9519u8befu4fe1u606f
                dbFormError.textContent = data.message || 'u64cdu4f5cu5931u8d25uff0cu8bf7u7a0du540eu91cdu8bd5';
            }
        } catch (error) {
            console.error('u8bf7u6c42u5931u8d25:', error);
            dbFormError.textContent = 'u8bf7u6c42u5931u8d25uff0cu8bf7u7a0du540eu91cdu8bd5';
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

    // u5173u95edu6a21u6001u6846
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    });

    // u70b9u51fbu6a21u6001u6846u5916u90e8u5173u95ed - u6dfbu52a0u786eu8ba4u673au5236u9632u6b62u8befu64cdu4f5c
    setupModalCloseConfirmation(modal);

    // u8868u5355u63d0u4ea4
    const form = modal.querySelector('#storageForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const storageFormError = document.getElementById('storageFormError');

        // u5904u7406u590du9009u6846
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
                // u6210u529fuff0cu5173u95edu6a21u6001u6846u5e76u5237u65b0u9875u9762
                document.body.removeChild(modal);
                window.location.reload();
            } else {
                // u5931u8d25uff0cu663eu793au9519u8befu4fe1u606f
                storageFormError.textContent = data.message || 'u64cdu4f5cu5931u8d25uff0cu8bf7u7a0du540eu91cdu8bd5';
            }
        } catch (error) {
            console.error('u8bf7u6c42u5931u8d25:', error);
            storageFormError.textContent = 'u8bf7u6c42u5931u8d25uff0cu8bf7u7a0du540eu91cdu8bd5';
        }
    });
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

                console.log('发送备份请求');
                const response = await fetch('/api/backup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(formData)
                });

                console.log('备份请求响应状态:', response.status);
                const data = await response.json();
                console.log('备份请求响应数据:', data);

                if (response.ok && data.success) {
                    // 成功，关闭模态框并刷新页面
                    console.log('备份任务提交成功');
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                    alert('备份任务已提交，请在备份历史中查看结果');
                    window.location.reload();
                } else {
                    // 失败，显示错误信息
                    console.error('备份任务提交失败:', data);
                    backupFormError.textContent = data.message || '操作失败，请稍后重试';
                    backupFormError.style.color = 'red';
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = '开始备份';
                    }
                }
            } catch (error) {
                console.error('备份请求失败:', error);
                backupFormError.textContent = `请求失败: ${error.message || '未知错误'}`;
                backupFormError.style.color = 'red';
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = '开始备份';
                }
            }
        });
    } else {
        console.error('u672au627eu5230u5907u4efdu8868u5355u5143u7d20');
    }
}

// 加载备份表单数据
async function loadBackupFormData() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('开始加载备份表单数据');

            // 加载数据库列表
            console.log('请求数据库列表');
            const dbResponse = await fetch('/api/databases');
            const dbData = await dbResponse.json();
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

            // 加载存储列表
            console.log('请求存储列表');
            const storageResponse = await fetch('/api/storage');
            const storageData = await storageResponse.json();
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

            console.log('备份表单数据加载完成');
            resolve();
        } catch (error) {
            console.error('加载备份表单数据失败:', error);

            const databaseCheckboxes = document.getElementById('databaseCheckboxes');
            if (databaseCheckboxes) {
                databaseCheckboxes.innerHTML = '<div class="error-message">加载数据失败</div>';
            }

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

                // 生成cron表达式
                const scheduleType = formData.get('scheduleType');
                const scheduleTime = formData.get('scheduleTime');
                const [hour, minute] = scheduleTime.split(':');

                let cronExpression = '';

                switch (scheduleType) {
                    case 'daily':
                        cronExpression = `${minute} ${hour} * * *`;
                        break;
                    case 'weekly':
                        const weekday = formData.get('scheduleWeekday') || '0';
                        cronExpression = `${minute} ${hour} * * ${weekday}`;
                        break;
                    case 'monthly':
                        const monthDay = formData.get('scheduleMonthDay') || '1';
                        cronExpression = `${minute} ${hour} ${monthDay} * *`;
                        break;
                    case 'custom':
                        cronExpression = formData.get('customCron') || '0 0 * * *';
                        break;
                }

                // 准备发送的数据 - 使用正确的字段名
                const scheduleFormData = new FormData();
                // 添加数据库ID
                selectedDatabases.forEach(db => {
                    scheduleFormData.append('databases', db);
                });
                scheduleFormData.append('storageId', formData.get('storageId'));
                
                // 转换前端字段名为后端期望的字段名
                // 将cron表达式拆分为frequency和time
                let frequency = '';
                let dayOfMonth = '';
                let weekday = '';
                
                switch (scheduleType) {
                    case 'daily':
                        frequency = 'daily';
                        break;
                    case 'weekly':
                        frequency = 'weekly';
                        weekday = formData.get('scheduleWeekday') || '0';
                        scheduleFormData.append('weekday', weekday);
                        break;
                    case 'monthly':
                        frequency = 'monthly';
                        dayOfMonth = formData.get('scheduleMonthDay') || '1';
                        scheduleFormData.append('dayOfMonth', dayOfMonth);
                        break;
                    case 'custom':
                        // 自定义cron表达式暂不支持，使用daily作为后备
                        frequency = 'daily';
                        break;
                }
                
                scheduleFormData.append('frequency', frequency);
                scheduleFormData.append('time', scheduleTime);
                scheduleFormData.append('retention', formData.get('retentionDays') || '30');

                console.log('发送计划备份请求');
                console.log('生成的Cron表达式:', cronExpression);
                console.log('保留天数:', formData.get('retentionDays'));

                const response = await fetch('/api/backup/schedule', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(scheduleFormData)
                });

                console.log('计划备份请求响应状态:', response.status);
                const data = await response.json();
                console.log('计划备份请求响应数据:', data);

                if (response.ok && data.success) {
                    // 成功，关闭模态框并刷新页面
                    console.log('计划备份设置成功');
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                    alert('计划备份已设置');
                    window.location.reload();
                } else {
                    // 失败，显示错误信息
                    console.error('计划备份设置失败:', data);
                    scheduleFormError.textContent = data.message || '操作失败，请稍后重试';
                    scheduleFormError.style.color = 'red';
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = '保存计划';
                    }
                }
            } catch (error) {
                console.error('计划备份请求失败:', error);
                scheduleFormError.textContent = `请求失败: ${error.message || '未知错误'}`;
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

            // 加载数据库列表
            console.log('请求数据库列表');
            const dbResponse = await fetch('/api/databases');
            const dbData = await dbResponse.json();
            console.log('数据库列表响应:', dbData);

            const databaseCheckboxes = document.getElementById('scheduleDatabaseCheckboxes');
            if (!databaseCheckboxes) {
                console.error('未找到数据库复选框容器元素');
                reject(new Error('DOM元素未找到: scheduleDatabaseCheckboxes'));
                return;
            }

            databaseCheckboxes.innerHTML = '';

            if (dbData.success && dbData.databases && dbData.databases.length > 0) {
                dbData.databases.forEach(db => {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'checkbox-item';
                    checkbox.innerHTML = `
            <label>
              <input type="checkbox" name="scheduleDatabases" value="${db.id}">
              ${db.name} (${db.databases.join(', ')})
            </label>
          `;
                    databaseCheckboxes.appendChild(checkbox);
                });
            } else {
                databaseCheckboxes.innerHTML = '<div class="empty-message">没有可用的数据库配置</div>';
            }

            // 加载存储列表
            console.log('请求存储列表');
            const storageResponse = await fetch('/api/storage');
            const storageData = await storageResponse.json();
            console.log('存储列表响应:', storageData);

            const storageSelect = document.getElementById('scheduleStorage');
            if (!storageSelect) {
                console.error('未找到存储选择器元素');
                reject(new Error('DOM元素未找到: scheduleStorage'));
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

            console.log('计划备份表单数据加载完成');
            resolve();
        } catch (error) {
            console.error('加载计划备份表单数据失败:', error);

            const databaseCheckboxes = document.getElementById('scheduleDatabaseCheckboxes');
            if (databaseCheckboxes) {
                databaseCheckboxes.innerHTML = '<div class="error-message">加载数据失败</div>';
            }

            reject(error);
        }
    });
}