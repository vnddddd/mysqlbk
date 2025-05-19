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
      
      try {
        // 发送登录请求
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            username,
            password
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // 登录成功，重定向到仪表板
          window.location.href = data.redirect || '/dashboard';
        } else {
          // 登录失败，显示错误信息
          loginError.textContent = data.message || '登录失败，请检查用户名和密码';
        }
      } catch (error) {
        console.error('登录请求失败:', error);
        loginError.textContent = '登录请求失败，请稍后重试';
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
