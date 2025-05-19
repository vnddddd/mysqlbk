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
      const settings = {
        name: formData.get('name'),
        password: formData.get('password')
      };

      try {
        const response = await fetch('/api/settings/account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        });

        const data = await response.json();

        if (response.ok && data.success) {
          alert('账户设置已更新');
          // 清空密码字段
          document.getElementById('accountPassword').value = '';
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
