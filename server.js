require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 10000;

// ========== MIDDLEWARE ==========
app.use(cors({
    origin: ['https://admin-panel-nxvh.onrender.com', 'http://localhost:10000'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ========== FIX SESSION CONFIG - QUAN TRỌNG ==========
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: '.',
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'admin-panel-secret-key-123456789',
    resave: true, // ĐỔI thành true
    saveUninitialized: true, // ĐỔI thành true
    rolling: true, // THÊM dòng này
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: false, // QUAN TRỌNG: ĐẶT FALSE cho Render
        httpOnly: true,
        sameSite: 'lax' // ĐỔI từ 'none' thành 'lax'
    },
    name: 'admin_session' // ĐỔI tên session
}));

// ========== DATABASE INIT ==========
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Helper functions (giữ nguyên)
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
        await db.asyncRun(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`);
        
        await db.asyncRun(`CREATE TABLE IF NOT EXISTS keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            owner TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME,
            usage_count INTEGER DEFAULT 0
        )`);
        
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
    console.log('Auth check - Session:', req.session.userId ? 'Authenticated' : 'Not authenticated');
    console.log('Session ID:', req.sessionID);
    
    if (req.session && req.session.userId) {
        return next();
    }
    
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
    }
    
    res.redirect('/');
}

// ========== DEBUG ENDPOINTS ==========
app.get('/api/debug/cookies', (req, res) => {
    res.json({
        cookies: req.headers.cookie || 'No cookies',
        sessionId: req.sessionID,
        session: req.session,
        headers: req.headers
    });
});

app.get('/api/debug/session/set', (req, res) => {
    req.session.test = 'Test session value';
    req.session.timestamp = new Date().toISOString();
    req.session.save((err) => {
        if (err) {
            res.json({ error: err.message });
        } else {
            res.json({ 
                success: true, 
                message: 'Session set',
                sessionId: req.sessionID 
            });
        }
    });
});

app.get('/api/debug/session/get', (req, res) => {
    res.json({
        sessionId: req.sessionID,
        session: req.session,
        testValue: req.session.test
    });
});

// ========== ROUTES ==========

// Home
app.get('/', (req, res) => {
    console.log('Home access - Session:', req.sessionID);
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Dashboard
app.get('/dashboard', requireAuth, (req, res) => {
    console.log('Dashboard access - User:', req.session.username);
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        time: new Date().toISOString(),
        session: req.sessionID ? 'active' : 'none',
        userId: req.session.userId || 'none'
    });
});

// Login API - SỬA QUAN TRỌNG
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('Login attempt from IP:', req.ip);
        console.log('Request headers:', req.headers);
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
        }
        
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
        
        // Set session - QUAN TRỌNG: Đặt session data
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = true;
        req.session.loginTime = new Date().toISOString();
        
        // Force save session
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Lỗi lưu session' });
            }
            
            console.log('✅ Login successful - Session saved:', req.sessionID);
            console.log('Session data:', req.session);
            
            // Set cookie manually if needed
            res.cookie('admin_session', req.sessionID, {
                maxAge: 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: false,
                sameSite: 'lax'
            });
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                },
                sessionId: req.sessionID
            });
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
    console.log('Status check - Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    
    res.json({
        authenticated: !!req.session.userId,
        sessionId: req.sessionID,
        user: req.session.userId ? {
            id: req.session.userId,
            username: req.session.username
        } : null
    });
});

// Logout API
app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.sessionID;
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Lỗi đăng xuất' });
        }
        
        // Clear cookie
        res.clearCookie('admin_session');
        console.log('✅ Logout successful - Session destroyed:', sessionId);
        
        res.json({ success: true });
    });
});

// ========== KEY MANAGEMENT API ==========
// (Giữ nguyên các API về keys từ phiên bản trước)

// Get all keys
app.get('/api/keys', requireAuth, async (req, res) => {
    try {
        const keys = await db.asyncAll("SELECT * FROM keys ORDER BY created_at DESC");
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
            key: { id: result.lastID, key, owner }
        });
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

// ========== START SERVER ==========
async function startServer() {
    const dbReady = await initDatabase();
    
    if (!dbReady) {
        console.error('❌ Không thể khởi tạo database');
        process.exit(1);
    }
    
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🔗 URL: https://admin-panel-nxvh.onrender.com`);
        console.log(`🔑 Admin: admin / admin123`);
        console.log(`📊 Health: /api/health`);
        console.log(`🐛 Debug: /api/debug/cookies`);
    });
}

startServer();
