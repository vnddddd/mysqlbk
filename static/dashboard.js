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

  // 备份设置表单
  const backupSettingsForm = document.getElementById('backupSettingsForm');
  if (backupSettingsForm) {
    backupSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(backupSettingsForm);
      const settings = {
        backupRetentionDays: formData.get('backupRetentionDays'),
        backupTime: formData.get('backupTime'),
        compressionLevel: formData.get('compressionLevel')
      };

      try {
        const response = await fetch('/api/settings/backup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        });

        const data = await response.json();

        if (response.ok && data.success) {
          alert('备份设置已保存');
        } else {
          alert(data.message || '保存设置失败');
        }
      } catch (error) {
        console.error('保存设置失败:', error);
        alert('保存设置失败，请稍后重试');
      }
    });
  }

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
          </div>
          <div class="form-group">
            <label for="dbHost">主机地址</label>
            <input type="text" id="dbHost" name="host" value="${dbData?.host || ''}" required>
          </div>
          <div class="form-group">
            <label for="dbPort">端口</label>
            <input type="number" id="dbPort" name="port" value="${dbData?.port || '3306'}" required>
          </div>
          <div class="form-group">
            <label for="dbUser">用户名</label>
            <input type="text" id="dbUser" name="user" value="${dbData?.user || ''}" required>
          </div>
          <div class="form-group">
            <label for="dbPassword">密码</label>
            <input type="password" id="dbPassword" name="password" value="${dbData?.password || ''}">
            ${dbData ? '<div class="form-hint">留空表示不修改密码</div>' : ''}
          </div>
          <div class="form-group">
            <label for="dbDatabases">数据库名称</label>
            <input type="text" id="dbDatabases" name="databases" value="${dbData?.databases.join(', ') || ''}" required>
            <div class="form-hint">多个数据库用逗号分隔</div>
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

  // 表单提交
  const form = modal.querySelector('#databaseForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const dbFormError = document.getElementById('dbFormError');

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