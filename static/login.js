// 登录页面脚本
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // 清除错误信息
      loginError.textContent = '';

      // 获取表单数据
      const formData = new FormData(loginForm);
      const username = formData.get('username');
      const password = formData.get('password');

      // 验证输入
      if (!username || !password) {
        loginError.textContent = '用户名和密码不能为空';
        return;
      }

      // 禁用登录按钮，显示加载状态
      const submitButton = loginForm.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.textContent = '登录中...';
      submitButton.disabled = true;

      try {
        console.log('尝试登录:', { username, passwordLength: password.length });

        // 发送登录请求 - 使用JSON格式
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password
          })
        });

        const data = await response.json();
        console.log('登录响应:', { success: data.success, status: response.status });

        if (response.ok && data.success) {
          // 登录成功，重定向到仪表板
          loginError.textContent = '';
          submitButton.textContent = '登录成功，正在跳转...';
          window.location.href = data.redirect || '/dashboard';
        } else {
          // 登录失败，显示错误信息
          loginError.textContent = data.message || '登录失败，请检查用户名和密码';
          submitButton.textContent = originalText;
          submitButton.disabled = false;
        }
      } catch (error) {
        console.error('登录请求失败:', error);
        loginError.textContent = '登录请求失败，请稍后重试';
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }
    });
  }

  // 添加输入事件监听器，清除错误信息
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      loginError.textContent = '';
    });
  });
});
