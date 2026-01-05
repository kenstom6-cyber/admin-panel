// public/js/auth.js - Authentication helper functions

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (!data.authenticated) {
            // If not authenticated and not on login page, redirect to login
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = '/login.html';
            }
        } else if (data.authenticated && window.location.pathname.includes('login.html')) {
            // If already authenticated and on login page, redirect to dashboard
            window.location.href = '/dashboard.html';
        }
        
        return data.authenticated;
    } catch (error) {
        console.error('Auth check failed:', error);
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/login.html';
        }
        return false;
    }
}

// Login function
async function login(username, password) {
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/dashboard.html';
            return { success: true };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Network error' };
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/admin/logout', { 
            method: 'POST' 
        });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login.html';
    }
}

// Get current admin info
async function getCurrentAdmin() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        return data.admin;
    } catch (error) {
        console.error('Get admin error:', error);
        return null;
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Only run auth check for pages that need it
    if (!window.location.pathname.includes('login.html')) {
        await checkAuth();
    }
    
    // Add logout handler if logout button exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
    
    // Display admin username if element exists
    const adminNameElement = document.getElementById('adminName');
    if (adminNameElement) {
        const admin = await getCurrentAdmin();
        if (admin) {
            adminNameElement.textContent = admin.username;
        }
    }
});

// Make functions available globally
window.auth = {
    checkAuth,
    login,
    logout,
    getCurrentAdmin
};
