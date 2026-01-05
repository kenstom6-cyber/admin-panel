require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Import database functions
const { initializeDatabase, runQuery, allQuery, getQuery } = require('./database');

// ========== BASIC ROUTES ==========
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Key Panel</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 { color: #333; margin-bottom: 20px; }
                .btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 10px;
                    text-decoration: none;
                    display: inline-block;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔐 Admin Key Panel</h1>
                <p>Server is running! Go to login page:</p>
                <a href="/index.html" class="btn">📊 Go to Login</a>
            </div>
        </body>
        </html>
    `);
});

// Serve login page
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve dashboard
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ========== API ROUTES ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Login API
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('Login attempt:', username);
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Please enter username and password' });
        }
        
        const admin = await getQuery(
            "SELECT * FROM admins WHERE username = ?",
            [username]
        );
        
        if (!admin) {
            return res.status(401).json({ error: 'Account does not exist' });
        }
        
        const isValid = await bcrypt.compare(password, admin.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
        
        // Update last login
        await runQuery(
            "UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            [admin.id]
        );
        
        res.json({
            success: true,
            admin: {
                id: admin.id,
                username: admin.username
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all server keys
app.get('/api/server-keys', async (req, res) => {
    try {
        const keys = await allQuery(
            "SELECT * FROM server_keys ORDER BY created_at DESC"
        );
        
        res.json({ success: true, keys });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate server key
app.post('/api/server-key/generate', async (req, res) => {
    try {
        const { name, description, expires_in_days = 30 } = req.body;
        
        // Generate unique key
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const serverKey = 'SRV_' + Array.from({ length: 20 }, () => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expires_in_days));
        
        const result = await runQuery(
            `INSERT INTO server_keys (key, name, description, expires_at) 
             VALUES (?, ?, ?, ?)`,
            [serverKey, name || null, description || null, expiresAt.toISOString()]
        );
        
        res.json({
            success: true,
            server_key: serverKey,
            key_id: result.lastID,
            expires_at: expiresAt
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate server key (for Android Shell)
app.get('/api/server/validate/:key', async (req, res) => {
    try {
        const serverKey = req.params.key;
        
        const keyData = await getQuery(
            `SELECT * FROM server_keys 
             WHERE key = ? AND status = 'active'`,
            [serverKey]
        );
        
        if (!keyData) {
            return res.json({
                valid: false,
                error: 'Invalid server key'
            });
        }
        
        // Check expiration
        if (keyData.expires_at) {
            const expiresDate = new Date(keyData.expires_at);
            if (expiresDate < new Date()) {
                return res.json({
                    valid: false,
                    error: 'Server key has expired'
                });
            }
        }
        
        // Increase usage count
        await runQuery(
            `UPDATE server_keys 
             SET usage_count = usage_count + 1, 
                 last_used = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [keyData.id]
        );
        
        res.json({
            valid: true,
            server: {
                id: keyData.id,
                name: keyData.name,
                usage_count: keyData.usage_count + 1
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset server key
app.post('/api/server-key/:id/reset', async (req, res) => {
    try {
        await runQuery(
            `UPDATE server_keys 
             SET status = 'active', 
                 usage_count = 0 
             WHERE id = ?`,
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Key reset successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lock server key
app.post('/api/server-key/:id/lock', async (req, res) => {
    try {
        await runQuery(
            "UPDATE server_keys SET status = 'locked' WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Key locked successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all user keys
app.get('/api/user-keys', async (req, res) => {
    try {
        const keys = await allQuery(
            "SELECT * FROM user_keys ORDER BY created_at DESC"
        );
        
        res.json({ success: true, keys });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate user key
app.post('/api/user-key/generate', async (req, res) => {
    try {
        const { user_id, device, expires_in_days = 7 } = req.body;
        
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const userKey = 'USR_' + Array.from({ length: 16 }, () => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expires_in_days));
        
        const result = await runQuery(
            `INSERT INTO user_keys (key, user_id, device, expires_at) 
             VALUES (?, ?, ?, ?)`,
            [userKey, user_id || null, device || null, expiresAt.toISOString()]
        );
        
        res.json({
            success: true,
            user_key: userKey,
            key_id: result.lastID
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate user key
app.get('/api/user/validate/:key', async (req, res) => {
    try {
        const userKey = req.params.key;
        
        const keyData = await getQuery(
            `SELECT * FROM user_keys 
             WHERE key = ? AND status = 'active'`,
            [userKey]
        );
        
        if (!keyData) {
            return res.json({
                valid: false,
                error: 'Invalid user key'
            });
        }
        
        // Increase usage count
        await runQuery(
            `UPDATE user_keys 
             SET usage_count = usage_count + 1, 
                 last_used = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [keyData.id]
        );
        
        res.json({
            valid: true,
            user: {
                id: keyData.id,
                user_id: keyData.user_id,
                usage_count: keyData.usage_count + 1
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
    try {
        const [serverKeys, userKeys] = await Promise.all([
            allQuery("SELECT COUNT(*) as count FROM server_keys"),
            allQuery("SELECT COUNT(*) as count FROM user_keys")
        ]);
        
        res.json({
            success: true,
            stats: {
                server_keys: serverKeys[0].count,
                user_keys: userKeys[0].count
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== START SERVER ==========
async function startServer() {
    try {
        const dbInitialized = await initializeDatabase();
        
        if (!dbInitialized) {
            console.error('❌ Failed to initialize database');
            process.exit(1);
        }
        
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 ADMIN KEY PANEL SERVER STARTED');
            console.log('='.repeat(50));
            console.log(`📡 Server running on port: ${PORT}`);
            console.log(`🌐 Public URL: https://admin-panel-nxvh.onrender.com`);
            console.log(`🔑 Admin login: admin / admin123`);
            console.log('');
            console.log('📊 API ENDPOINTS:');
            console.log('├─ GET  /api/health');
            console.log('├─ POST /api/admin/login');
            console.log('├─ GET  /api/server/validate/:key');
            console.log('├─ POST /api/server-key/generate');
            console.log('├─ GET  /api/server-keys');
            console.log('├─ GET  /api/user/validate/:key');
            console.log('├─ POST /api/user-key/generate');
            console.log('└─ GET  /api/stats');
            console.log('');
            console.log('✅ Server is ready!');
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

startServer();
