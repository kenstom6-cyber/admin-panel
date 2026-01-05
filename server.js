require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
    store: new SQLiteStore({ 
        db: 'sessions.db', 
        dir: '.',
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// ========== KHỞI TẠO DATABASE ==========
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

// Initialize database
async function initializeDatabase() {
    console.log('🔄 Đang khởi tạo database...');
    
    // Tạo bảng admin_users
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
        key_type TEXT DEFAULT 'api_key',
        owner TEXT,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        last_used DATETIME,
        usage_count INTEGER DEFAULT 0,
        usage_limit INTEGER DEFAULT 0
    )`);
    
    // Tạo bảng logs
    await db.asyncRun(`CREATE TABLE IF NOT EXISTS key_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id INTEGER,
        action TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Kiểm tra và tạo admin
    const adminExists = await db.asyncGet("SELECT COUNT(*) as count FROM admin_users");
    if (adminExists.count === 0) {
        const defaultPassword = await bcrypt.hash('admin123', 10);
        await db.asyncRun(
            "INSERT INTO admin_users (username, password_hash, email) VALUES (?, ?, ?)",
            ['admin', defaultPassword, 'admin@example.com']
        );
        console.log('✅ Đã tạo admin mặc định: admin / admin123');
    }
    
    console.log('✅ Database đã sẵn sàng');
}

// ========== AUTH MIDDLEWARE ==========
function authMiddleware(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.redirect('/');
}

// ========== ROUTES ==========

// Home page
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Dashboard
app.get('/dashboard', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API: Check auth
app.get('/api/auth/check', (req, res) => {
    res.json({ 
        authenticated: !!req.session.userId,
        user: req.session.userId ? { 
            username: req.session.username 
        } : null
    });
});

// API: Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await db.asyncGet("SELECT * FROM admin_users WHERE username = ?", [username]);
        
        if (!user) {
            return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Mật khẩu không đúng' });
        }

        // Update last login
        await db.asyncRun("UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = true;

        res.json({ 
            success: true, 
            user: { 
                username: user.username,
                email: user.email 
            } 
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// API: Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// API: Get all keys
app.get('/api/keys', authMiddleware, async (req, res) => {
    try {
        const keys = await db.asyncAll("SELECT * FROM keys ORDER BY created_at DESC");
        res.json({ success: true, keys });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Generate key
app.post('/api/keys/generate', authMiddleware, async (req, res) => {
    try {
        const { owner, description } = req.body;
        
        // Generate unique key
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let key = 'KEY_' + Array.from({ length: 20 }, () => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        
        const result = await db.asyncRun(
            `INSERT INTO keys (key, owner, description) VALUES (?, ?, ?)`,
            [key, owner || null, description || null]
        );

        res.json({ 
            success: true, 
            key: { id: result.lastID, key, owner, description },
            message: 'Key đã được tạo thành công'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Reset key
app.post('/api/keys/:id/reset', authMiddleware, async (req, res) => {
    try {
        await db.asyncRun(
            "UPDATE keys SET status = 'active', usage_count = 0, last_used = NULL WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Key đã được reset' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Lock key
app.post('/api/keys/:id/lock', authMiddleware, async (req, res) => {
    try {
        await db.asyncRun("UPDATE keys SET status = 'locked' WHERE id = ?", [req.params.id]);
        res.json({ success: true, message: 'Key đã bị khóa' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Delete key
app.delete('/api/keys/:id', authMiddleware, async (req, res) => {
    try {
        await db.asyncRun("UPDATE keys SET status = 'deleted' WHERE id = ?", [req.params.id]);
        res.json({ success: true, message: 'Key đã bị xóa' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Validate key (Public - for Android Shell)
app.get('/api/validate/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const row = await db.asyncGet(`
            SELECT * FROM keys 
            WHERE key = ? 
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `, [key]);
        
        if (!row) {
            return res.json({ 
                valid: false, 
                error: 'Key không hợp lệ hoặc đã hết hạn' 
            });
        }
        
        // Update usage
        await db.asyncRun(
            "UPDATE keys SET last_used = CURRENT_TIMESTAMP, usage_count = usage_count + 1 WHERE id = ?",
            [row.id]
        );
        
        res.json({ 
            valid: true, 
            key: {
                id: row.id,
                owner: row.owner,
                usage_count: row.usage_count + 1
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Get key info
app.get('/api/key-info/:key', async (req, res) => {
    try {
        const row = await db.asyncGet(
            "SELECT id, key, owner, status, usage_count, created_at FROM keys WHERE key = ?",
            [req.params.key]
        );
        
        if (!row) {
            return res.status(404).json({ error: 'Key không tồn tại' });
        }
        
        res.json({ success: true, key: row });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Server status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// ========== START SERVER ==========
async function startServer() {
    try {
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server đang chạy tại port ${PORT}`);
            console.log(`📊 Đăng nhập với: admin / admin123`);
        });
    } catch (error) {
        console.error('❌ Lỗi khởi tạo server:', error);
        process.exit(1);
    }
}

startServer();
