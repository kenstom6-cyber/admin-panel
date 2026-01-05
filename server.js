require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'admin-panel-jwt-secret-key-2024';

// ========== DATABASE ==========
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

// ========== INIT DATABASE ==========
async function initDatabase() {
    console.log('🔄 Khởi tạo database...');
    
    try {
        // Admin table
        await db.asyncRun(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`);
        
        // Keys table
        await db.asyncRun(`CREATE TABLE IF NOT EXISTS keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            owner TEXT,
            description TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            last_used DATETIME,
            usage_count INTEGER DEFAULT 0,
            usage_limit INTEGER DEFAULT 0
        )`);
        
        // Check admin exists
        const adminExists = await db.asyncGet("SELECT COUNT(*) as count FROM admin_users WHERE username = 'admin'");
        
        if (adminExists.count === 0) {
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
        console.error('❌ Database error:', error);
        return false;
    }
}

// ========== JWT AUTH MIDDLEWARE ==========
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token không tồn tại' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token không hợp lệ' });
        }
        req.user = user;
        next();
    });
}

// ========== ROUTES ==========

// Root - serve login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard - serve dashboard page
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ========== API ROUTES ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// Login API - JWT token
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('🔐 Login attempt:', username);
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập username và password' });
        }
        
        const user = await db.asyncGet(
            "SELECT * FROM admin_users WHERE username = ?",
            [username]
        );
        
        if (!user) {
            console.log('❌ User not found:', username);
            return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            console.log('❌ Invalid password for:', username);
            return res.status(401).json({ error: 'Mật khẩu không đúng' });
        }
        
        // Update last login
        await db.asyncRun(
            "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            [user.id]
        );
        
        // Create JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                isAdmin: true
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log('✅ Login successful:', username);
        
        res.json({
            success: true,
            token: token,
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

// Verify token
app.post('/api/auth/verify', (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.json({ valid: false, error: 'Token không tồn tại' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.json({ valid: false, error: 'Token không hợp lệ' });
        }
        
        res.json({
            valid: true,
            user: {
                id: decoded.userId,
                username: decoded.username
            }
        });
    });
});

// Get all keys (protected)
app.get('/api/keys', authenticateToken, async (req, res) => {
    try {
        console.log('🔑 Getting keys for user:', req.user.username);
        
        const keys = await db.asyncAll(`
            SELECT * FROM keys 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            keys: keys,
            count: keys.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new key (protected)
app.post('/api/keys', authenticateToken, async (req, res) => {
    try {
        const { key, owner, description } = req.body;
        
        if (!key) {
            return res.status(400).json({ error: 'Key là bắt buộc' });
        }
        
        // Generate random key if not provided
        let finalKey = key;
        if (!finalKey || finalKey === 'auto') {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            finalKey = 'KEY_' + Array.from({ length: 20 }, () => 
                chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        }
        
        const result = await db.asyncRun(
            `INSERT INTO keys (key, owner, description) 
             VALUES (?, ?, ?)`,
            [finalKey, owner || null, description || null]
        );
        
        const newKey = await db.asyncGet(
            "SELECT * FROM keys WHERE id = ?",
            [result.lastID]
        );
        
        res.json({
            success: true,
            message: 'Key đã được tạo',
            key: newKey
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Key đã tồn tại' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Generate random key (protected)
app.post('/api/keys/generate', authenticateToken, async (req, res) => {
    try {
        const { owner, description } = req.body;
        
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const key = 'KEY_' + Array.from({ length: 20 }, () => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        
        const result = await db.asyncRun(
            "INSERT INTO keys (key, owner, description) VALUES (?, ?, ?)",
            [key, owner || null, description || null]
        );
        
        res.json({
            success: true,
            key: {
                id: result.lastID,
                key: key,
                owner: owner,
                description: description
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset key (protected)
app.post('/api/keys/:id/reset', authenticateToken, async (req, res) => {
    try {
        await db.asyncRun(
            `UPDATE keys 
             SET status = 'active', 
                 usage_count = 0, 
                 last_used = NULL 
             WHERE id = ?`,
            [req.params.id]
        );
        
        res.json({
            success: true,
            message: 'Key đã được reset'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lock key (protected)
app.post('/api/keys/:id/lock', authenticateToken, async (req, res) => {
    try {
        await db.asyncRun(
            "UPDATE keys SET status = 'locked' WHERE id = ?",
            [req.params.id]
        );
        
        res.json({
            success: true,
            message: 'Key đã bị khóa'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete key (protected)
app.delete('/api/keys/:id', authenticateToken, async (req, res) => {
    try {
        await db.asyncRun(
            "UPDATE keys SET status = 'deleted' WHERE id = ?",
            [req.params.id]
        );
        
        res.json({
            success: true,
            message: 'Key đã bị xóa'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get key stats (protected)
app.get('/api/keys/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await db.asyncAll(`
            SELECT 
                status,
                COUNT(*) as count,
                SUM(usage_count) as total_usage
            FROM keys 
            GROUP BY status
        `);
        
        const total = await db.asyncGet(`
            SELECT 
                COUNT(*) as total,
                SUM(usage_count) as total_usage
            FROM keys
        `);
        
        res.json({
            success: true,
            stats: stats,
            total: total
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== PUBLIC API (for Android Shell) ==========

// Validate key
app.get('/api/validate/:key', async (req, res) => {
    try {
        const { key } = req.params;
        
        const keyData = await db.asyncGet(`
            SELECT * FROM keys 
            WHERE key = ? 
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `, [key]);
        
        if (!keyData) {
            return res.json({
                valid: false,
                error: 'Key không hợp lệ hoặc đã hết hạn'
            });
        }
        
        // Check usage limit
        if (keyData.usage_limit > 0 && keyData.usage_count >= keyData.usage_limit) {
            await db.asyncRun(
                "UPDATE keys SET status = 'locked' WHERE id = ?",
                [keyData.id]
            );
            
            return res.json({
                valid: false,
                error: 'Key đã đạt giới hạn sử dụng'
            });
        }
        
        // Update usage
        await db.asyncRun(
            `UPDATE keys 
             SET usage_count = usage_count + 1, 
                 last_used = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [keyData.id]
        );
        
        res.json({
            valid: true,
            key: {
                id: keyData.id,
                owner: keyData.owner,
                usage_count: keyData.usage_count + 1,
                usage_limit: keyData.usage_limit
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get key info
app.get('/api/key-info/:key', async (req, res) => {
    try {
        const keyData = await db.asyncGet(
            `SELECT id, key, owner, status, usage_count, created_at 
             FROM keys WHERE key = ?`,
            [req.params.key]
        );
        
        if (!keyData) {
            return res.status(404).json({ error: 'Key không tồn tại' });
        }
        
        res.json({
            success: true,
            key: keyData
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
        console.log(`🚀 Server đang chạy: https://admin-panel-nxvh.onrender.com`);
        console.log(`📊 Health check: /api/health`);
        console.log(`🔑 Admin login: admin / admin123`);
        console.log(`📱 API validate: GET /api/validate/{key}`);
        console.log(`🔐 Authentication: JWT Token-based`);
    });
}

startServer();
