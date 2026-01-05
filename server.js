require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware đơn giản
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ========== DATABASE ĐƠN GIẢN ==========
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Helper functions đơn giản
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// ========== KHỞI TẠO DATABASE ==========
async function initDatabase() {
    console.log('🔄 Khởi tạo database...');
    
    try {
        // Tạo bảng admin (đơn giản)
        await dbRun(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )`);
        
        // Tạo bảng keys (đơn giản)
        await dbRun(`CREATE TABLE IF NOT EXISTS keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            owner TEXT,
            status TEXT DEFAULT 'active',
            usage_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Kiểm tra admin
        const adminCheck = await dbGet("SELECT COUNT(*) as count FROM admin_users WHERE username = 'admin'");
        
        if (adminCheck.count === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await dbRun(
                "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
                ['admin', hashedPassword]
            );
            console.log('✅ Đã tạo admin: admin / admin123');
        }
        
        console.log('✅ Database ready');
        return true;
    } catch (error) {
        console.error('❌ Database error:', error);
        return false;
    }
}

// ========== SIMPLE AUTH SYSTEM ==========
// Sử dụng localStorage để lưu trạng thái đăng nhập (đơn giản nhất)

// Middleware kiểm tra đăng nhập (chỉ cho API)
function checkAuth(req, res, next) {
    // Với demo, chúng ta sẽ trust client (đơn giản)
    // Trong thực tế cần token hoặc session
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
    }
    
    // Đơn giản: chỉ kiểm tra nếu header có "admin"
    if (authHeader.includes('admin')) {
        next();
    } else {
        res.status(401).json({ error: 'Chưa đăng nhập' });
    }
}

// ========== ROUTES ==========

// Trang chủ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ========== API ROUTES ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        message: 'Admin Key Panel đang hoạt động'
    });
});

// Login API (đơn giản)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('Login attempt:', username);
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập username và password' });
        }
        
        const user = await dbGet(
            "SELECT * FROM admin_users WHERE username = ?",
            [username]
        );
        
        if (!user) {
            return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Mật khẩu không đúng' });
        }
        
        console.log('✅ Login successful:', username);
        
        // Trả về success - client sẽ lưu vào localStorage
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username
            },
            message: 'Đăng nhập thành công'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Logout API
app.post('/api/logout', (req, res) => {
    res.json({ success: true, message: 'Đăng xuất thành công' });
});

// Get all keys (cần đăng nhập)
app.get('/api/keys', checkAuth, async (req, res) => {
    try {
        const keys = await dbAll(
            "SELECT * FROM keys ORDER BY created_at DESC"
        );
        
        res.json({
            success: true,
            keys: keys
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create key (cần đăng nhập)
app.post('/api/keys', checkAuth, async (req, res) => {
    try {
        const { key, owner } = req.body;
        
        if (!key) {
            return res.status(400).json({ error: 'Key là bắt buộc' });
        }
        
        // Nếu không có key, tạo random
        let finalKey = key;
        if (!finalKey || finalKey === 'auto') {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            finalKey = 'KEY_' + Array.from({ length: 16 }, () => 
                chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        }
        
        const result = await dbRun(
            "INSERT INTO keys (key, owner) VALUES (?, ?)",
            [finalKey, owner || null]
        );
        
        const newKey = await dbGet(
            "SELECT * FROM keys WHERE id = ?",
            [result.lastID]
        );
        
        res.json({
            success: true,
            key: newKey,
            message: 'Key đã được tạo'
        });
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'Key đã tồn tại' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Reset key
app.post('/api/keys/:id/reset', checkAuth, async (req, res) => {
    try {
        await dbRun(
            "UPDATE keys SET status = 'active', usage_count = 0 WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Key đã reset' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lock key
app.post('/api/keys/:id/lock', checkAuth, async (req, res) => {
    try {
        await dbRun(
            "UPDATE keys SET status = 'locked' WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Key đã khóa' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete key
app.delete('/api/keys/:id', checkAuth, async (req, res) => {
    try {
        await dbRun(
            "UPDATE keys SET status = 'deleted' WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Key đã xóa' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Public API cho Android Shell
app.get('/api/validate/:key', async (req, res) => {
    try {
        const key = req.params.key;
        const keyData = await dbGet(
            "SELECT * FROM keys WHERE key = ? AND status = 'active'",
            [key]
        );
        
        if (!keyData) {
            return res.json({ 
                valid: false, 
                error: 'Key không hợp lệ' 
            });
        }
        
        // Tăng lượt dùng
        await dbRun(
            "UPDATE keys SET usage_count = usage_count + 1 WHERE id = ?",
            [keyData.id]
        );
        
        res.json({
            valid: true,
            key: {
                id: keyData.id,
                owner: keyData.owner,
                usage_count: keyData.usage_count + 1
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get key info
app.get('/api/key/:key', async (req, res) => {
    try {
        const keyData = await dbGet(
            "SELECT id, key, owner, status, usage_count FROM keys WHERE key = ?",
            [req.params.key]
        );
        
        if (!keyData) {
            return res.status(404).json({ error: 'Key không tồn tại' });
        }
        
        res.json({ success: true, key: keyData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== START SERVER ==========
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log(`🚀 Server đang chạy: http://localhost:${PORT}`);
        console.log(`🌐 Public URL: https://admin-panel-nxvh.onrender.com`);
        console.log(`🔑 Admin: admin / admin123`);
        console.log(`📱 API: GET /api/validate/{key}`);
        console.log(`💡 Đơn giản & Ổn định`);
    });
}

startServer();
