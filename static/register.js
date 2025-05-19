// 注册页面脚本
document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const registerError = document.getElementById('registerError');
  
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // 清除错误信息
      registerError.textContent = '';
      
      // 获取表单数据
      const formData = new FormData(registerForm);
      const name = formData.get('name');
      const username = formData.get('username');
      const password = formData.get('password');
      
      // 验证输入
      if (!name || !username || !password) {
        registerError.textContent = '所有字段都是必填的';
        return;
      }
      
      if (password.length < 6) {
        registerError.textContent = '密码长度至少为6个字符';
        return;
      }
      
      try {
        // 发送注册请求
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            name,
            username,
            password
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // 注册成功，显示成功消息并重定向到登录页面
          alert(data.message || '注册成功，请登录');
          window.location.href = '/login';
        } else {
          // 注册失败，显示错误信息
          registerError.textContent = data.message || '注册失败，请稍后重试';
        }
      } catch (error) {
        console.error('注册请求失败:', error);
        registerError.textContent = '注册请求失败，请稍后重试';
      }
    });
  }
  
  // 添加输入事件监听器，清除错误信息
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      registerError.textContent = '';
    });
  });
});
