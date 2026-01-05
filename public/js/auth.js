// File: public/js/auth.js

// Kiểm tra authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (!data.authenticated && window.location.pathname !== '/') {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

// Logout
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Kiểm tra khi trang tải
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname !== '/') {
        checkAuth();
    }
});
