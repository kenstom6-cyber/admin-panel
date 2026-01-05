// File: middleware/auth.js

// Middleware xác thực
function authMiddleware(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    
    // Nếu là API request, trả về lỗi JSON
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Nếu là web request, redirect đến login
    res.redirect('/');
}

module.exports = authMiddleware;
