require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 10000;

// ========== MIDDLEWARE QUAN TRỌNG ==========
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ========== SESSION CONFIG FIX ==========
const sessionStore = new SQLiteStore({
    db: 'sessions.db',
    dir: '.',
    table: 'sessions'
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'admin-panel-secret-key-123456789',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 1 ngày
        secure: false, // ĐỂ LÀ FALSE vì Render không có HTTPS cho free tier
        httpOnly: true,
        sameSite: 'lax'
    },
    name: 'admin.sid'
}));

// ========== DATABASE INIT ==========
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Helper functions
db.asyncRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

db.asyncAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

db.asyncGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// ========== INITIALIZE DATABASE ==========
async function initDatabase() {
    console.log('🔄 Khởi tạo database...');
    
    try {
        // Tạo bảng admin
        await db.asyncRun(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`);
        
        // Tạo bảng keys
        await db.asyncRun(`CREATE TABLE IF NOT EXISTS keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            owner TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME,
            usage_count INTEGER DEFAULT 0
        )`);
        
        // Kiểm tra admin tồn tại
        const adminCheck = await db.asyncGet("SELECT COUNT(*) as count FROM admin_users WHERE username = 'admin'");
        
        if (adminCheck.count === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.asyncRun(
                "INSERT INTO admin_users (username, password_hash, email) VALUES (?, ?, ?)",
                ['admin', hashedPassword, 'admin@example.com']
            );
            console.log('✅ Đã tạo admin: admin / admin123');
        } else {
            console.log('✅ Admin đã tồn tại');
        }
        
        console.log('✅ Database ready');
        return true;
    } catch (error) {
        console.error('❌ Database init error:', error);
        return false;
    }
}

// ========== AUTH MIDDLEWARE ==========
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
    }
    
    res.redirect('/');
}

// ========== ROUTES ==========

// Home - redirect based on auth
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Dashboard
app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ========== API ROUTES ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        time: new Date().toISOString(),
        session: req.sessionID ? 'active' : 'none'
    });
});

// Login API
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập username và password' });
        }
        
        console.log('Login attempt:', username);
        
        const user = await db.asyncGet(
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
        
        // Update last login
        await db.asyncRun(
            "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            [user.id]
        );
        
        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = true;
        
        console.log('Login successful for:', username, 'Session ID:', req.sessionID);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Logout API
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Lỗi đăng xuất' });
        }
        res.json({ success: true });
    });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
    res.json({
        authenticated: !!req.session.userId,
        user: req.session.userId ? {
            id: req.session.userId,
            username: req.session.username
        } : null
    });
});

// Get all keys
app.get('/api/keys', requireAuth, async (req, res) => {
    try {
        const keys = await db.asyncAll(
            "SELECT * FROM keys ORDER BY created_at DESC"
        );
        res.json({ success: true, keys });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create key
app.post('/api/keys', requireAuth, async (req, res) => {
    try {
        const { key, owner } = req.body;
        
        if (!key) {
            return res.status(400).json({ error: 'Key là bắt buộc' });
        }
        
        const result = await db.asyncRun(
            "INSERT INTO keys (key, owner) VALUES (?, ?)",
            [key, owner || null]
        );
        
        res.json({
            success: true,
            key: {
                id: result.lastID,
                key,
                owner
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset key
app.post('/api/keys/:id/reset', requireAuth, async (req, res) => {
    try {
        await db.asyncRun(
            "UPDATE keys SET status = 'active', usage_count = 0 WHERE id = ?",
            [req.params.id]
        );
        res.json({ success: true, message: 'Key đã reset' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lock key
app.post('/api/keys/:id/lock', requireAuth, async (req, res) => {
    try {
        await db.asyncRun(
            "UPDATE keys SET status = 'locked' WHERE id = ?",
            [req.params.id]
        );
        res.json({ success: true, message: 'Key đã khóa' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete key
app.delete('/api/keys/:id', requireAuth, async (req, res) => {
    try {
        await db.asyncRun(
            "UPDATE keys SET status = 'deleted' WHERE id = ?",
            [req.params.id]
        );
        res.json({ success: true, message: 'Key đã xóa' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Public API for Android Shell
app.get('/api/validate/:key', async (req, res) => {
    try {
        const key = req.params.key;
        const keyData = await db.asyncGet(
            "SELECT * FROM keys WHERE key = ? AND status = 'active'",
            [key]
        );
        
        if (!keyData) {
            return res.json({ valid: false, error: 'Key không hợp lệ' });
        }
        
        // Update usage
        await db.asyncRun(
            "UPDATE keys SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?",
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

// Generate random key
app.post('/api/keys/generate', requireAuth, async (req, res) => {
    try {
        const { owner } = req.body;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const key = 'KEY_' + Array.from({ length: 16 }, () => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        
        const result = await db.asyncRun(
            "INSERT INTO keys (key, owner) VALUES (?, ?)",
            [key, owner || null]
        );
        
        res.json({
            success: true,
            key: {
                id: result.lastID,
                key,
                owner
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== START SERVER ==========
async function startServer() {
    const dbReady = await initDatabase();
    
    if (!dbReady) {
        console.error('❌ Không thể khởi tạo database');
        process.exit(1);
    }
    
    app.listen(PORT, () => {
        console.log(`🚀 Server running: https://admin-panel-nxvh.onrender.com`);
        console.log(`📌 Health check: https://admin-panel-nxvh.onrender.com/api/health`);
        console.log(`🔑 Admin login: admin / admin123`);
        console.log(`📱 API validate: GET /api/validate/{your-key}`);
    });
}

startServer();
