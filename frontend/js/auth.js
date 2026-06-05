document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const alertContainer = document.getElementById('alert-container');
  const alertText = document.getElementById('alert-text');

  // Helper to show alert messages
  const showAlert = (message, type = 'danger') => {
    alertText.textContent = message;
    alertContainer.className = `alert alert-${type}`;
    alertContainer.style.display = 'flex';
  };

  // Helper to hide alerts
  const hideAlert = () => {
    alertContainer.style.display = 'none';
  };

  // If token is found, verify session and auto-redirect to dashboard
  const checkSession = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const res = await API.get('/api/auth/me');
        if (res.success) {
          window.location.href = '/index.html';
        }
      } catch (err) {
        // Clear invalid session tokens
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  };

  checkSession();

  // Handle Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        return showAlert('Please enter all fields');
      }

      try {
        const data = await API.post('/api/auth/login', { email, password });
        if (data.success) {
          // Store token & user data in localStorage
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          window.location.href = '/index.html';
        }
      } catch (error) {
        showAlert(error.message || 'Login failed. Please check your credentials.');
      }
    });
  }

  // Handle Signup Submission
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const username = document.getElementById('username').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (!username || !email || !password || !confirmPassword) {
        return showAlert('Please fill out all fields');
      }

      if (password.length < 6) {
        return showAlert('Password must be at least 6 characters long');
      }

      if (password !== confirmPassword) {
        return showAlert('Passwords do not match');
      }

      try {
        const data = await API.post('/api/auth/register', { username, email, password });
        if (data.success) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          showAlert('Registration successful! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = '/index.html';
          }, 1500);
        }
      } catch (error) {
        showAlert(error.message || 'Registration failed. Please try again.');
      }
    });
  }
});
