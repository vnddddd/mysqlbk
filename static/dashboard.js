// u4eeau8868u677fu9875u9762u811au672c

// u6a21u6001u6846u70b9u51fbu5916u90e8u533au57dfu5173u95edu786eu8ba4u51fdu6570 - u9632u6b62u8befu64cdu4f5c
function setupModalCloseConfirmation(modal) {
    let clickOutsideTime = 0;
    const clickConfirmTimeout = 2000; // 2u79d2u5185u9700u8981u518du6b21u70b9u51fbu624du4f1au5173u95ed

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            const now = new Date().getTime();

            // u7b2cu4e00u6b21u70b9u51fbu6216u8d85u65f6
            if (clickOutsideTime === 0 || now - clickOutsideTime > clickConfirmTimeout) {
                clickOutsideTime = now;

                // u521bu5efau4e00u4e2au63d0u793au5143u7d20
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
                confirmToast.textContent = 'u518du6b21u70b9u51fbu7a7au767du533au57dfu5173u95edu5bf9u8bddu6846';

                modal.appendChild(confirmToast);

                // 2u79d2u540eu81eau52a8u79fbu9664u63d0u793a
                setTimeout(() => {
                    if (modal.contains(confirmToast)) {
                        modal.removeChild(confirmToast);
                    }
                    clickOutsideTime = 0; // u91cdu7f6eu65f6u95f4
                }, clickConfirmTimeout);

                console.log('u7b2cu4e00u6b21u70b9u51fbu6a21u6001u6846u5916u90e8uff0cu663eu793au786eu8ba4u63d0u793a');
            } else {
                // u7b2cu4e8cu6b21u70b9u51fbuff0cu5173u95edu6a21u6001u6846
                console.log('u5728u786eu8ba4u65f6u95f4u5185u518du6b21u70b9u51fbuff0cu5173u95edu6a21u6001u6846');
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

// u663eu793au6570u636eu5e93u914du7f6eu6a21u6001u6846
function showDatabaseModal(dbData = null) {
    // u521bu5efau6a21u6001u6846
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block'; // u786eu4fddu6a21u6001u6846u663eu793a
    modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${dbData ? 'u7f16u8f91u6570u636eu5e93' : 'u6dfbu52a0u6570u636eu5e93'}</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <form id="databaseForm">
          <div class="form-group">
            <label for="dbName">u540du79f0</label>
            <input type="text" id="dbName" name="name" value="${dbData?.name || ''}" required>
            <div class="form-hint">u4e3au6b64u6570u636eu5e93u8fdeu63a5u8d77u4e00u4e2au6613u8bb0u7684u540du79f0</div>
          </div>

          <div class="form-tabs">
            <div class="tab-header">
              <button type="button" class="tab-btn active" data-tab="simple">u7b80u6613u6a21u5f0f</button>
              <button type="button" class="tab-btn" data-tab="advanced">u9ad8u7ea7u6a21u5f0f</button>
            </div>

            <div class="tab-content active" id="simple-tab">
              <div class="form-group">
                <label for="dbConnectionString">u8fdeu63a5u5b57u7b26u4e32</label>
                <input type="text" id="dbConnectionString" name="connectionString" placeholder="user:password@host:port/database" value="">
                <div class="form-hint">u652fu6301u591au79cdu683cu5f0f:</div>
                <div class="form-hint">1. user:password@host:port/database</div>
                <div class="form-hint">2. mysql://user:password@host:port/database</div>
                <div class="form-hint">3. user:password@tcp(host:port)/database</div>
                <div class="form-hint">4. u5e26SSLu53c2u6570: mysql://user:password@host:port/database?ssl-mode=REQUIRED</div>
              </div>
            </div>

            <div class="tab-content" id="advanced-tab">
              <div class="form-group">
                <label for="dbHost">u4e3bu673au5730u5740</label>
                <input type="text" id="dbHost" name="host" value="${dbData?.host || ''}">
              </div>
              <div class="form-group">
                <label for="dbPort">u7aefu53e3</label>
                <input type="number" id="dbPort" name="port" value="${dbData?.port || '3306'}">
              </div>
              <div class="form-group">
                <label for="dbUser">u7528u6237u540d</label>
                <input type="text" id="dbUser" name="user" value="${dbData?.user || ''}">
              </div>
              <div class="form-group">
                <label for="dbPassword">u5bc6u7801</label>
                <input type="password" id="dbPassword" name="password" value="${dbData?.password || ''}">
                ${dbData ? '<div class="form-hint">u7559u7a7au8868u793au4e0du4feeu6539u5bc6u7801</div>' : ''}
              </div>
              <div class="form-group">
                <label for="dbDatabases">u6570u636eu5e93u540du79f0</label>
                <input type="text" id="dbDatabases" name="databases" value="${dbData?.databases ? dbData.databases.join(', ') : ''}">
                <div class="form-hint">u591au4e2au6570u636eu5e93u7528u9017u53f7u5206u9694</div>
              </div>
            </div>
          </div>

          <div class="form-error" id="dbFormError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">u53d6u6d88</button>
        <button type="submit" class="btn btn-primary" form="databaseForm">${dbData ? 'u4fddu5b58' : 'u6dfbu52a0'}</button>
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

// u663eu793au4e91u5b58u50a8u914du7f6eu6a21u6001u6846
function showStorageModal(storageData = null) {
    // u521bu5efau6a21u6001u6846
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block'; // u786eu4fddu6a21u6001u6846u663eu793a
    modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${storageData ? 'u7f16u8f91u5b58u50a8' : 'u6dfbu52a0u5b58u50a8'}</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <form id="storageForm">
          <div class="form-group">
            <label for="storageName">u540du79f0</label>
            <input type="text" id="storageName" name="name" value="${storageData?.name || ''}" required>
          </div>
          <div class="form-group">
            <label for="storageType">u5b58u50a8u7c7bu578b</label>
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
              ${storageData ? '<div class="form-hint">u7559u7a7au8868u793au4e0du4feeu6539u5bc6u94a5</div>' : ''}
            </div>
            <div class="form-group">
              <label for="bucketName">u5b58u50a8u6876u540du79f0</label>
              <input type="text" id="bucketName" name="bucketName" value="${storageData?.bucketName || ''}" required>
            </div>
          </div>
          <div class="form-group">
            <label for="storageActive">
              <input type="checkbox" id="storageActive" name="active" ${storageData?.active ? 'checked' : ''}>
              u8bbeu4e3au6d3bu8dc3u5b58u50a8
            </label>
            <div class="form-hint">u6d3bu8dc3u5b58u50a8u5c06u7528u4e8eu5907u4efdu6587u4ef6u4e0au4f20</div>
          </div>
          <div class="form-error" id="storageFormError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">u53d6u6d88</button>
        <button type="submit" class="btn btn-primary" form="storageForm">${storageData ? 'u4fddu5b58' : 'u6dfbu52a0'}</button>
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

// u663eu793au5907u4efdu6a21u6001u6846
function showBackupModal() {
    console.log('u6267u884c showBackupModal u51fdu6570');

    // u68c0u67e5u662fu5426u5df2u7ecfu6709u6a21u6001u6846u6253u5f00
    if (document.querySelector('.modal')) {
        console.log('u5df2u6709u6a21u6001u6846u6253u5f00uff0cu4e0du518du521bu5efau65b0u7684u6a21u6001u6846');
        return;
    }

    // u521bu5efau6a21u6001u6846
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'backupModal'; // u6dfbu52a0IDu4ee5u4fbfu4e8eu8bc6u522b
    modal.style.display = 'block'; // u786eu4fddu6a21u6001u6846u663eu793a
    modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>u6267u884cu5907u4efd</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div id="backupLoadingIndicator" class="loading-indicator">
          <div class="spinner"></div>
          <div>u52a0u8f7du4e2d...</div>
        </div>
        <form id="backupForm" style="display: none;">
          <div class="form-group">
            <label>u9009u62e9u6570u636eu5e93</label>
            <div class="checkbox-group" id="databaseCheckboxes">
              <div class="loading">u52a0u8f7du6570u636eu5e93u5217u8868...</div>
            </div>
          </div>
          <div class="form-group">
            <label for="backupStorage">u9009u62e9u5b58u50a8</label>
            <select id="backupStorage" name="storageId" class="form-select" required>
              <option value="">-- u9009u62e9u5b58u50a8 --</option>
            </select>
          </div>
          <div class="form-error" id="backupFormError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">u53d6u6d88</button>
        <button type="submit" class="btn btn-primary" form="backupForm">u5f00u59cbu5907u4efd</button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);
    console.log('u5907u4efdu6a21u6001u6846u5df2u6dfbu52a0u5230DOM');

    // u5173u95edu6a21u6001u6846
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('u5173u95edu5907u4efdu6a21u6001u6846');
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        });
    });

    // u70b9u51fbu6a21u6001u6846u5916u90e8u5173u95ed - u6dfbu52a0u786eu8ba4u673au5236u9632u6b62u8befu64cdu4f5c
    setupModalCloseConfirmation(modal);

    // u52a0u8f7du6570u636eu5e93u548cu5b58u50a8u5217u8868
    loadBackupFormData().then(() => {
        // u52a0u8f7du5b8cu6210u540euff0cu9690u85cfu52a0u8f7du6307u793au5668uff0cu663eu793au8868u5355
        const loadingIndicator = document.getElementById('backupLoadingIndicator');
        const backupForm = document.getElementById('backupForm');

        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (backupForm) backupForm.style.display = 'block';
    }).catch(error => {
        console.error('u52a0u8f7du5907u4efdu8868u5355u6570u636eu5931u8d25:', error);
        const loadingIndicator = document.getElementById('backupLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = '<div class="error-message">u52a0u8f7du6570u636eu5931u8d25uff0cu8bf7u5237u65b0u9875u9762u91cdu8bd5</div>';
        }
    });

    // u8868u5355u63d0u4ea4
    const form = document.getElementById('backupForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('u63d0u4ea4u5907u4efdu8868u5355');

            const formData = new FormData(form);
            const backupFormError = document.getElementById('backupFormError');
            backupFormError.textContent = ''; // u6e05u9664u4e4bu524du7684u9519u8befu4fe1u606f

            // u83b7u53d6u9009u4e2du7684u6570u636eu5e93
            const selectedDatabases = [];
            document.querySelectorAll('input[name="databases"]:checked').forEach(checkbox => {
                selectedDatabases.push(checkbox.value);
            });

            if (selectedDatabases.length === 0) {
                backupFormError.textContent = 'u8bf7u81f3u5c11u9009u62e9u4e00u4e2au6570u636eu5e93';
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
                    submitButton.textContent = 'u5907u4efdu4e2d...';
                }

                console.log('u53d1u9001u5907u4efdu8bf7u6c42');
                const response = await fetch('/api/backup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(formData)
                });

                console.log('u5907u4efdu8bf7u6c42u54cdu5e94u72b6u6001:', response.status);
                const data = await response.json();
                console.log('u5907u4efdu8bf7u6c42u54cdu5e94u6570u636e:', data);

                if (response.ok && data.success) {
                    // u6210u529fuff0cu5173u95edu6a21u6001u6846u5e76u5237u65b0u9875u9762
                    console.log('u5907u4efdu4efbu52a1u63d0u4ea4u6210u529f');
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                    alert('u5907u4efdu4efbu52a1u5df2u63d0u4ea4uff0cu8bf7u5728u5907u4efdu5386u53f2u4e2du67e5u770bu7ed3u679c');
                    window.location.reload();
                } else {
                    // u5931u8d25uff0cu663eu793au9519u8befu4fe1u606f
                    console.error('u5907u4efdu4efbu52a1u63d0u4ea4u5931u8d25:', data);
                    backupFormError.textContent = data.message || 'u64cdu4f5cu5931u8d25uff0cu8bf7u7a0du540eu91cdu8bd5';
                    backupFormError.style.color = 'red';
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'u5f00u59cbu5907u4efd';
                    }
                }
            } catch (error) {
                console.error('u5907u4efdu8bf7u6c42u5931u8d25:', error);
                backupFormError.textContent = `u8bf7u6c42u5931u8d25: ${error.message || 'u672au77e5u9519u8bef'}`;
                backupFormError.style.color = 'red';
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'u5f00u59cbu5907u4efd';
                }
            }
        });
    } else {
        console.error('u672au627eu5230u5907u4efdu8868u5355u5143u7d20');
    }
}

// u52a0u8f7du5907u4efdu8868u5355u6570u636e
async function loadBackupFormData() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('u5f00u59cbu52a0u8f7du5907u4efdu8868u5355u6570u636e');

            // u52a0u8f7du6570u636eu5e93u5217u8868
            console.log('u8bf7u6c42u6570u636eu5e93u5217u8868');
            const dbResponse = await fetch('/api/databases');
            const dbData = await dbResponse.json();
            console.log('u6570u636eu5e93u5217u8868u54cdu5e94:', dbData);

            const databaseCheckboxes = document.getElementById('databaseCheckboxes');
            if (!databaseCheckboxes) {
                console.error('u672au627eu5230u6570u636eu5e93u590du9009u6846u5bb9u5668u5143u7d20');
                reject(new Error('DOMu5143u7d20u672au627eu5230: databaseCheckboxes'));
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
                databaseCheckboxes.innerHTML = '<div class="empty-message">u6ca1u6709u53efu7528u7684u6570u636eu5e93u914du7f6e</div>';
            }

            // u52a0u8f7du5b58u50a8u5217u8868
            console.log('u8bf7u6c42u5b58u50a8u5217u8868');
            const storageResponse = await fetch('/api/storage');
            const storageData = await storageResponse.json();
            console.log('u5b58u50a8u5217u8868u54cdu5e94:', storageData);

            const storageSelect = document.getElementById('backupStorage');
            if (!storageSelect) {
                console.error('u672au627eu5230u5b58u50a8u9009u62e9u5668u5143u7d20');
                reject(new Error('DOMu5143u7d20u672au627eu5230: backupStorage'));
                return;
            }

            // u6e05u7a7au73b0u6709u9009u9879
            storageSelect.innerHTML = '';

            if (storageData.success && storageData.storage && storageData.storage.length > 0) {
                // u6dfbu52a0u9ed8u8ba4u9009u9879
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '-- u9009u62e9u5b58u50a8 --';
                defaultOption.disabled = true;
                storageSelect.appendChild(defaultOption);

                // u6dfbu52a0u5b58u50a8u9009u9879
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
                option.textContent = 'u6ca1u6709u53efu7528u7684u5b58u50a8u914du7f6e';
                option.disabled = true;
                option.selected = true;
                storageSelect.appendChild(option);
            }

            console.log('u5907u4efdu8868u5355u6570u636eu52a0u8f7du5b8cu6210');
            resolve();
        } catch (error) {
            console.error('u52a0u8f7du5907u4efdu8868u5355u6570u636eu5931u8d25:', error);

            const databaseCheckboxes = document.getElementById('databaseCheckboxes');
            if (databaseCheckboxes) {
                databaseCheckboxes.innerHTML = '<div class="error-message">u52a0u8f7du6570u636eu5931u8d25</div>';
            }

            reject(error);
        }
    });
}

// u663eu793au8ba1u5212u5907u4efdu6a21u6001u6846
function showScheduleBackupModal() {
    console.log('u6267u884c showScheduleBackupModal u51fdu6570');

    // u68c0u67e5u662fu5426u5df2u7ecfu6709u6a21u6001u6846u6253u5f00
    if (document.querySelector('.modal')) {
        console.log('u5df2u6709u6a21u6001u6846u6253u5f00uff0cu4e0du518du521bu5efau65b0u7684u6a21u6001u6846');
        return;
    }

    // u521bu5efau6a21u6001u6846
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'scheduleBackupModal'; // u6dfbu52a0IDu4ee5u4fbfu4e8eu8bc6u522b
    modal.style.display = 'block'; // u786eu4fddu6a21u6001u6846u663eu793a
    modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>u8ba1u5212u5907u4efd</h3>
        <button class="modal-close close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div id="scheduleLoadingIndicator" class="loading-indicator">
          <div class="spinner"></div>
          <div>u52a0u8f7du4e2d...</div>
        </div>
        <form id="scheduleForm" style="display: none;">
          <div class="form-group">
            <label>u9009u62e9u6570u636eu5e93</label>
            <div class="checkbox-group" id="scheduleDatabaseCheckboxes">
              <div class="loading">u52a0u8f7du6570u636eu5e93u5217u8868...</div>
            </div>
          </div>
          <div class="form-group">
            <label for="scheduleStorage">u9009u62e9u5b58u50a8</label>
            <select id="scheduleStorage" name="storageId" class="form-select" required>
              <option value="">-- u9009u62e9u5b58u50a8 --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="scheduleCron">u5907u4efdu8ba1u5212</label>
            <select id="scheduleCron" name="scheduleType" class="form-select" required>
              <option value="daily">u6bcfu5929</option>
              <option value="weekly">u6bcfu5468</option>
              <option value="monthly">u6bcfu6708</option>
              <option value="custom">u81eau5b9au4e49</option>
            </select>
          </div>
          
          <div id="scheduleTimeWrapper" class="form-group">
            <label for="scheduleTime">u5907u4efdu65f6u95f4</label>
            <input type="time" id="scheduleTime" name="scheduleTime" value="00:00" class="form-input" required>
          </div>
          
          <div id="weekdayWrapper" class="form-group" style="display: none;">
            <label for="scheduleWeekday">u661fu671fu51e0</label>
            <select id="scheduleWeekday" name="scheduleWeekday" class="form-select">
              <option value="0">u661fu671fu65e5</option>
              <option value="1">u661fu671fu4e00</option>
              <option value="2">u661fu671fu4e8c</option>
              <option value="3">u661fu671fu4e09</option>
              <option value="4">u661fu671fu56db</option>
              <option value="5">u661fu671fu4e94</option>
              <option value="6">u661fu671fu516d</option>
            </select>
          </div>
          
          <div id="monthDayWrapper" class="form-group" style="display: none;">
            <label for="scheduleMonthDay">u65e5u671f</label>
            <select id="scheduleMonthDay" name="scheduleMonthDay" class="form-select">
              ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}u65e5</option>`).join('')}
            </select>
          </div>
          
          <div id="customCronWrapper" class="form-group" style="display: none;">
            <label for="customCron">u81eau5b9au4e49Cronu8868u8fbeu5f0f</label>
            <input type="text" id="customCron" name="customCron" placeholder="u4f8bu5982: 0 0 * * *" class="form-input">
            <div class="form-hint">u683cu5f0f: u5206 u65f6 u65e5 u6708 u661fu671f</div>
          </div>
          
          <div class="form-group">
            <label for="retentionDays">u4fddu7559u5929u6570</label>
            <input type="number" id="retentionDays" name="retentionDays" value="30" min="1" max="365" class="form-input" required>
            <div class="form-hint">u8d85u8fc7u6307u5b9au5929u6570u7684u5907u4efdu5c06u88abu81eau52a8u5220u9664uff08u672cu5730u548cu4e91u7aefuff09</div>
          </div>
          <div class="form-error" id="scheduleFormError"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal">u53d6u6d88</button>
        <button type="submit" class="btn btn-primary" form="scheduleForm">u4fddu5b58u8ba1u5212</button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);
    console.log('u8ba1u5212u5907u4efdu6a21u6001u6846u5df2u6dfbu52a0u5230DOM');

    // u5173u95edu6a21u6001u6846
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('u5173u95edu8ba1u5212u5907u4efdu6a21u6001u6846');
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        });
    });

    // u70b9u51fbu6a21u6001u6846u5916u90e8u5173u95ed - u6dfbu52a0u786eu8ba4u673au5236u9632u6b62u8befu64cdu4f5c
    setupModalCloseConfirmation(modal);

    // u521du59cbu5316u8ba1u5212u5907u4efdu9009u62e9u5668
    const scheduleTypeSelector = document.getElementById('scheduleCron');
    const weekdayWrapper = document.getElementById('weekdayWrapper');
    const monthDayWrapper = document.getElementById('monthDayWrapper');
    const customCronWrapper = document.getElementById('customCronWrapper');

    if (scheduleTypeSelector) {
        scheduleTypeSelector.addEventListener('change', function () {
            // u9690u85cfu6240u6709u76f8u5173u5305u88c5u5668
            weekdayWrapper.style.display = 'none';
            monthDayWrapper.style.display = 'none';
            customCronWrapper.style.display = 'none';

            // u6839u636eu9009u62e9u663eu793au76f8u5e94u5143u7d20
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

        // u89e6u53d1u4e00u6b21changeu4e8bu4ef6u4ee5u8bbeu7f6eu521du59cbu72b6u6001
        scheduleTypeSelector.dispatchEvent(new Event('change'));
    }

    // u52a0u8f7du6570u636eu5e93u548cu5b58u50a8u5217u8868
    loadScheduleFormData().then(() => {
        // u52a0u8f7du5b8cu6210u540euff0cu9690u85cfu52a0u8f7du6307u793au5668uff0cu663eu793au8868u5355
        const loadingIndicator = document.getElementById('scheduleLoadingIndicator');
        const scheduleForm = document.getElementById('scheduleForm');

        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (scheduleForm) scheduleForm.style.display = 'block';
    }).catch(error => {
        console.error('u52a0u8f7du8ba1u5212u5907u4efdu8868u5355u6570u636eu5931u8d25:', error);
        const loadingIndicator = document.getElementById('scheduleLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = '<div class="error-message">u52a0u8f7du6570u636eu5931u8d25uff0cu8bf7u5237u65b0u9875u9762u91cdu8bd5</div>';
        }
    });

    // u8868u5355u63d0u4ea4
    const form = document.getElementById('scheduleForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('u63d0u4ea4u8ba1u5212u5907u4efdu8868u5355');

            const formData = new FormData(form);
            const scheduleFormError = document.getElementById('scheduleFormError');
            scheduleFormError.textContent = ''; // u6e05u9664u4e4bu524du7684u9519u8befu4fe1u606f

            // u83b7u53d6u9009u4e2du7684u6570u636eu5e93
            const selectedDatabases = [];
            document.querySelectorAll('input[name="scheduleDatabases"]:checked').forEach(checkbox => {
                selectedDatabases.push(checkbox.value);
            });

            if (selectedDatabases.length === 0) {
                scheduleFormError.textContent = 'u8bf7u81f3u5c11u9009u62e9u4e00u4e2au6570u636eu5e93';
                scheduleFormError.style.color = 'red';
                return;
            }

            try {
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = 'u4fddu5b58u4e2d...';
                }

                // u751fu6210cronu8868u8fbeu5f0f
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

                // u51c6u5907u53d1u9001u7684u6570u636e
                const scheduleData = {
                    databases: selectedDatabases,
                    storageId: formData.get('storageId'),
                    cron: cronExpression,
                    retentionDays: parseInt(formData.get('retentionDays') || '30')
                };

                console.log('u53d1u9001u8ba1u5212u5907u4efdu8bf7u6c42');
                console.log('u751fu6210u7684Cronu8868u8fbeu5f0f:', cronExpression);
                console.log('u4fddu7559u5929u6570:', formData.get('retentionDays'));
                console.log('u5373u5c06u53d1u9001u7684u6570u636e:', scheduleData);

                const response = await fetch('/api/schedule', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(scheduleData)
                });

                console.log('u8ba1u5212u5907u4efdu8bf7u6c42u54cdu5e94u72b6u6001:', response.status);
                const data = await response.json();
                console.log('u8ba1u5212u5907u4efdu8bf7u6c42u54cdu5e94u6570u636e:', data);

                if (response.ok && data.success) {
                    // u6210u529fuff0cu5173u95edu6a21u6001u6846u5e76u5237u65b0u9875u9762
                    console.log('u8ba1u5212u5907u4efdu8bbeu7f6eu6210u529f');
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                    alert('u8ba1u5212u5907u4efdu5df2u8bbeu7f6e');
                    window.location.reload();
                } else {
                    // u5931u8d25uff0cu663eu793au9519u8befu4fe1u606f
                    console.error('u8ba1u5212u5907u4efdu8bbeu7f6eu5931u8d25:', data);
                    scheduleFormError.textContent = data.message || 'u64cdu4f5cu5931u8d25uff0cu8bf7u7a0du540eu91cdu8bd5';
                    scheduleFormError.style.color = 'red';
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'u4fddu5b58u8ba1u5212';
                    }
                }
            } catch (error) {
                console.error('u8ba1u5212u5907u4efdu8bf7u6c42u5931u8d25:', error);
                scheduleFormError.textContent = `u8bf7u6c42u5931u8d25: ${error.message || 'u672au77e5u9519u8bef'}`;
                scheduleFormError.style.color = 'red';
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'u4fddu5b58u8ba1u5212';
                }
            }
        });
    } else {
        console.error('u672au627eu5230u8ba1u5212u5907u4efdu8868u5355u5143u7d20');
    }
}

// u52a0u8f7du8ba1u5212u5907u4efdu8868u5355u6570u636e
async function loadScheduleFormData() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('u5f00u59cbu52a0u8f7du8ba1u5212u5907u4efdu8868u5355u6570u636e');

            // u52a0u8f7du6570u636eu5e93u5217u8868
            console.log('u8bf7u6c42u6570u636eu5e93u5217u8868');
            const dbResponse = await fetch('/api/databases');
            const dbData = await dbResponse.json();
            console.log('u6570u636eu5e93u5217u8868u54cdu5e94:', dbData);

            const databaseCheckboxes = document.getElementById('scheduleDatabaseCheckboxes');
            if (!databaseCheckboxes) {
                console.error('u672au627eu5230u6570u636eu5e93u590du9009u6846u5bb9u5668u5143u7d20');
                reject(new Error('DOMu5143u7d20u672au627eu5230: scheduleDatabaseCheckboxes'));
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
                databaseCheckboxes.innerHTML = '<div class="empty-message">u6ca1u6709u53efu7528u7684u6570u636eu5e93u914du7f6e</div>';
            }

            // u52a0u8f7du5b58u50a8u5217u8868
            console.log('u8bf7u6c42u5b58u50a8u5217u8868');
            const storageResponse = await fetch('/api/storage');
            const storageData = await storageResponse.json();
            console.log('u5b58u50a8u5217u8868u54cdu5e94:', storageData);

            const storageSelect = document.getElementById('scheduleStorage');
            if (!storageSelect) {
                console.error('u672au627eu5230u5b58u50a8u9009u62e9u5668u5143u7d20');
                reject(new Error('DOMu5143u7d20u672au627eu5230: scheduleStorage'));
                return;
            }

            // u6e05u7a7au73b0u6709u9009u9879
            storageSelect.innerHTML = '';

            if (storageData.success && storageData.storage && storageData.storage.length > 0) {
                // u6dfbu52a0u9ed8u8ba4u9009u9879
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '-- u9009u62e9u5b58u50a8 --';
                defaultOption.disabled = true;
                storageSelect.appendChild(defaultOption);

                // u6dfbu52a0u5b58u50a8u9009u9879
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
                option.textContent = 'u6ca1u6709u53efu7528u7684u5b58u50a8u914du7f6e';
                option.disabled = true;
                option.selected = true;
                storageSelect.appendChild(option);
            }

            console.log('u8ba1u5212u5907u4efdu8868u5355u6570u636eu52a0u8f7du5b8cu6210');
            resolve();
        } catch (error) {
            console.error('u52a0u8f7du8ba1u5212u5907u4efdu8868u5355u6570u636eu5931u8d25:', error);

            const databaseCheckboxes = document.getElementById('scheduleDatabaseCheckboxes');
            if (databaseCheckboxes) {
                databaseCheckboxes.innerHTML = '<div class="error-message">u52a0u8f7du6570u636eu5931u8d25</div>';
            }

            reject(error);
        }
    });
}