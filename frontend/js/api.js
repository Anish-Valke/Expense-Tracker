// Frontend API utility wrapper
const API = {
  baseUrl: 'http://localhost:5000',

  async request(url, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    // Include the token from localStorage if present as fallback
    const token = localStorage.getItem('token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      credentials: 'include', // Support cross-origin cookies
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      const response = await fetch(`${this.baseUrl}${url}`, config);
      const data = await response.json();

      if (!response.ok) {
        // If unauthorized, redirect to login page (except when verifying current user on login/signup pages)
        if (response.status === 401 && !window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('signup.html')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login.html';
          return;
        }
        
        throw new Error(data.error || 'Something went wrong');
      }

      return data;
    } catch (error) {
      console.error(`API Error on ${url}:`, error.message);
      throw error;
    }
  },

  get(url) {
    return this.request(url, { method: 'GET' });
  },

  post(url, body) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(url, body) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(url) {
    return this.request(url, { method: 'DELETE' });
  }
};
