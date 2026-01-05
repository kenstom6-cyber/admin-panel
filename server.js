require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const { initializeDatabase, db } = require('./database');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ========== ROUTES CƠ BẢN ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ========== SERVER KEY API ==========
// Tạo và quản lý Server Keys cho Android Shell

// API: Generate Server Key
app.post('/api/server-key/generate', async (req, res) => {
    try {
        const { name, description, expires_in_days = 30 } = req.body;
        
        // Tạo Server Key đặc biệt
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const serverKey = 'SRV_' + Array.from({ length: 24 }, () => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expires_in_days));
        
        const result = await db.run(
            `INSERT INTO server_keys (key, name, description, expires_at) 
             VALUES (?, ?, ?, ?)`,
            [serverKey, name || null, description || null, expiresAt.toISOString()]
        );
        
        res.json({
            success: true,
            server_key: serverKey,
            key_id: result.lastID,
            expires_at: expiresAt,
            message: 'Server Key đã được tạo'
        });
        
    } catch (error) {
        console.error('Generate server key error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Get all Server Keys
app.get('/api/server-keys', async (req, res) => {
    try {
        const keys = await db.all(`
            SELECT * FROM server_keys 
            ORDER BY created_at DESC
        `);
        
        res.json({ success: true, keys });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Validate Server Key (cho Android Shell)
app.get('/api/server/validate/:key', async (req, res) => {
    try {
        const serverKey = req.params.key;
        
        const keyData = await db.get(`
            SELECT * FROM server_keys 
            WHERE key = ? 
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `, [serverKey]);
        
        if (!keyData) {
            return res.json({
                valid: false,
                error: 'Server Key không hợp lệ hoặc đã hết hạn'
            });
        }
        
        // Tăng lượt sử dụng
        await db.run(
            `UPDATE server_keys 
             SET last_used = CURRENT_TIMESTAMP, 
                 usage_count = usage_count + 1 
             WHERE id = ?`,
            [keyData.id]
        );
        
        res.json({
            valid: true,
            server: {
                id: keyData.id,
                name: keyData.name,
                usage_count: keyData.usage_count + 1,
                expires_at: keyData.expires_at
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Revoke Server Key
app.post('/api/server-key/:id/revoke', async (req, res) => {
    try {
        await db.run(
            "UPDATE server_keys SET status = 'revoked' WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Server Key đã bị thu hồi' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== USER KEY API ==========
// API cho các keys thông thường

// API: Get all user keys
app.get('/api/user-keys', async (req, res) => {
    try {
        const keys = await db.all(`
            SELECT * FROM user_keys 
            ORDER BY created_at DESC
        `);
        
        res.json({ success: true, keys });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Generate User Key
app.post('/api/user-key/generate', async (req, res) => {
    try {
        const { user_id, device, expires_in_days = 7 } = req.body;
        
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const userKey = 'USR_' + Array.from({ length: 20 }, () => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expires_in_days));
        
        const result = await db.run(
            `INSERT INTO user_keys (key, user_id, device, expires_at) 
             VALUES (?, ?, ?, ?)`,
            [userKey, user_id || null, device || null, expiresAt.toISOString()]
        );
        
        res.json({
            success: true,
            user_key: userKey,
            key_id: result.lastID,
            expires_at: expiresAt
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Validate User Key
app.get('/api/user/validate/:key', async (req, res) => {
    try {
        const userKey = req.params.key;
        
        const keyData = await db.get(`
            SELECT * FROM user_keys 
            WHERE key = ? 
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `, [userKey]);
        
        if (!keyData) {
            return res.json({
                valid: false,
                error: 'User Key không hợp lệ'
            });
        }
        
        await db.run(
            `UPDATE user_keys 
             SET last_used = CURRENT_TIMESTAMP, 
                 usage_count = usage_count + 1 
             WHERE id = ?`,
            [keyData.id]
        );
        
        res.json({
            valid: true,
            user: {
                id: keyData.id,
                user_id: keyData.user_id,
                device: keyData.device,
                usage_count: keyData.usage_count + 1
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ADMIN AUTH API ==========
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('Admin login attempt:', username);
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập đầy đủ' });
        }
        
        const admin = await db.get(
            "SELECT * FROM admins WHERE username = ?",
            [username]
        );
        
        if (!admin) {
            return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }
        
        const isValid = await bcrypt.compare(password, admin.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Mật khẩu không đúng' });
        }
        
        // Update last login
        await db.run(
            "UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            [admin.id]
        );
        
        res.json({
            success: true,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role
            }
        });
        
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// ========== KEY MANAGEMENT API ==========
// Reset Key
app.post('/api/key/:id/reset', async (req, res) => {
    try {
        const { key_type = 'user' } = req.body;
        const table = key_type === 'server' ? 'server_keys' : 'user_keys';
        
        await db.run(
            `UPDATE ${table} 
             SET status = 'active', 
                 usage_count = 0, 
                 last_used = NULL 
             WHERE id = ?`,
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Key đã được reset' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lock Key
app.post('/api/key/:id/lock', async (req, res) => {
    try {
        const { key_type = 'user' } = req.body;
        const table = key_type === 'server' ? 'server_keys' : 'user_keys';
        
        await db.run(
            `UPDATE ${table} SET status = 'locked' WHERE id = ?`,
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Key đã bị khóa' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Key
app.delete('/api/key/:id', async (req, res) => {
    try {
        const { key_type = 'user' } = req.body;
        const table = key_type === 'server' ? 'server_keys' : 'user_keys';
        
        await db.run(
            `UPDATE ${table} SET status = 'deleted' WHERE id = ?`,
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Key đã bị xóa' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== STATISTICS API ==========
app.get('/api/stats', async (req, res) => {
    try {
        const [serverStats, userStats] = await Promise.all([
            db.all(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    SUM(usage_count) as total_usage
                FROM server_keys 
                GROUP BY status
            `),
            db.all(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    SUM(usage_count) as total_usage
                FROM user_keys 
                GROUP BY status
            `)
        ]);
        
        const totalStats = await db.get(`
            SELECT 
                (SELECT COUNT(*) FROM server_keys) as total_server_keys,
                (SELECT COUNT(*) FROM user_keys) as total_user_keys,
                (SELECT SUM(usage_count) FROM server_keys) as server_total_usage,
                (SELECT SUM(usage_count) FROM user_keys) as user_total_usage
        `);
        
        res.json({
            success: true,
            server_stats: serverStats,
            user_stats: userStats,
            total: totalStats
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        endpoints: {
            server_validate: 'GET /api/server/validate/:key',
            user_validate: 'GET /api/user/validate/:key',
            generate_server_key: 'POST /api/server-key/generate',
            generate_user_key: 'POST /api/user-key/generate'
        }
    });
});

// ========== START SERVER ==========
async function startServer() {
    try {
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 ADMIN KEY PANEL SERVER');
            console.log('='.repeat(50));
            console.log(`📡 Port: ${PORT}`);
            console.log(`🌐 URL: https://admin-panel-nxvh.onrender.com`);
            console.log(`🔐 Admin: admin / admin123`);
            console.log('');
            console.log('📊 API ENDPOINTS:');
            console.log('├─ Server Key Validate: GET /api/server/validate/:key');
            console.log('├─ User Key Validate:   GET /api/user/validate/:key');
            console.log('├─ Generate Server Key: POST /api/server-key/generate');
            console.log('├─ Generate User Key:   POST /api/user-key/generate');
            console.log('├─ Get Stats:           GET /api/stats');
            console.log('└─ Health Check:        GET /api/health');
            console.log('');
            console.log('✅ Server is ready!');
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

startServer();
