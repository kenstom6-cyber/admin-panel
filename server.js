require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');

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

// Admin authentication middleware
const requireAdmin = async (req, res, next) => {
    try {
        // For simplicity, check session or token
        // In production, use JWT or session
        const authHeader = req.headers.authorization;
        
        if (!authHeader && !req.session?.admin) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        next();
    } catch (error) {
        res.status(500).json({ error: 'Authentication error' });
    }
};

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
            },
            token: crypto.randomBytes(32).toString('hex') // Simple token for demo
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== SERVER KEYS API ==========

// Get all server keys
app.get('/api/server-keys', requireAdmin, async (req, res) => {
    try {
        const keys = await allQuery(
            "SELECT * FROM server_keys ORDER BY created_at DESC"
        );
        
        // Format dates and add status
        const formattedKeys = keys.map(key => {
            const isExpired = key.expires_at && new Date(key.expires_at) < new Date();
            const status = key.status || (isExpired ? 'expired' : 'active');
            
            return {
                ...key,
                status: status,
                is_expired: isExpired
            };
        });
        
        res.json({ success: true, keys: formattedKeys });
    } catch (error) {
        console.error('Error fetching server keys:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate server key
app.post('/api/server-key/generate', requireAdmin, async (req, res) => {
    try {
        const { name, description, expires_in_days = 30, prefix = 'SRV' } = req.body;
        
        // Validate input
        if (expires_in_days <= 0) {
            return res.status(400).json({ error: 'Expiry days must be positive' });
        }
        
        // Generate unique key with timestamp and random string
        const timestamp = Date.now().toString(36);
        const randomPart = crypto.randomBytes(16).toString('hex').substring(0, 20).toUpperCase();
        const serverKey = `${prefix}_${timestamp}_${randomPart}`;
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expires_in_days));
        
        const result = await runQuery(
            `INSERT INTO server_keys (key, name, description, expires_at, status, usage_count) 
             VALUES (?, ?, ?, ?, 'active', 0)`,
            [serverKey, name || null, description || null, expiresAt.toISOString()]
        );
        
        // Get the created key
        const createdKey = await getQuery(
            "SELECT * FROM server_keys WHERE id = ?",
            [result.lastID]
        );
        
        res.json({
            success: true,
            key: createdKey,
            message: 'Server key generated successfully'
        });
        
    } catch (error) {
        console.error('Error generating server key:', error);
        res.status(500).json({ error: error.message });
    }
});

// Validate server key (for Android Shell)
app.get('/api/server/validate/:key', async (req, res) => {
    try {
        const serverKey = req.params.key;
        
        console.log('Validating server key:', serverKey.substring(0, 10) + '...');
        
        const keyData = await getQuery(
            `SELECT * FROM server_keys 
             WHERE key = ?`,
            [serverKey]
        );
        
        if (!keyData) {
            return res.json({
                valid: false,
                error: 'Invalid server key'
            });
        }
        
        // Check status
        if (keyData.status === 'locked') {
            return res.json({
                valid: false,
                error: 'Server key is locked'
            });
        }
        
        if (keyData.status === 'deleted') {
            return res.json({
                valid: false,
                error: 'Server key has been deleted'
            });
        }
        
        // Check expiration
        if (keyData.expires_at) {
            const expiresDate = new Date(keyData.expires_at);
            if (expiresDate < new Date()) {
                // Auto update status to expired
                await runQuery(
                    "UPDATE server_keys SET status = 'expired' WHERE id = ?",
                    [keyData.id]
                );
                
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
        
        // Get updated key data
        const updatedKey = await getQuery(
            "SELECT * FROM server_keys WHERE id = ?",
            [keyData.id]
        );
        
        res.json({
            valid: true,
            key: {
                id: updatedKey.id,
                key: updatedKey.key,
                name: updatedKey.name,
                status: updatedKey.status,
                usage_count: updatedKey.usage_count,
                expires_at: updatedKey.expires_at,
                created_at: updatedKey.created_at
            }
        });
        
    } catch (error) {
        console.error('Error validating server key:', error);
        res.status(500).json({ 
            valid: false,
            error: 'Server error during validation' 
        });
    }
});

// Get server key by ID
app.get('/api/server-key/:id', requireAdmin, async (req, res) => {
    try {
        const key = await getQuery(
            "SELECT * FROM server_keys WHERE id = ?",
            [req.params.id]
        );
        
        if (!key) {
            return res.status(404).json({ error: 'Server key not found' });
        }
        
        res.json({ success: true, key });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update server key
app.put('/api/server-key/:id', requireAdmin, async (req, res) => {
    try {
        const { name, description, status } = req.body;
        
        await runQuery(
            `UPDATE server_keys 
             SET name = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [name || null, description || null, status || 'active', req.params.id]
        );
        
        res.json({ success: true, message: 'Server key updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset server key (set usage to 0 and status to active)
app.post('/api/server-key/:id/reset', requireAdmin, async (req, res) => {
    try {
        await runQuery(
            `UPDATE server_keys 
             SET status = 'active', 
                 usage_count = 0,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Server key reset successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lock server key
app.post('/api/server-key/:id/lock', requireAdmin, async (req, res) => {
    try {
        await runQuery(
            "UPDATE server_keys SET status = 'locked', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Server key locked successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unlock server key
app.post('/api/server-key/:id/unlock', requireAdmin, async (req, res) => {
    try {
        await runQuery(
            "UPDATE server_keys SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Server key unlocked successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete server key (soft delete)
app.delete('/api/server-key/:id', requireAdmin, async (req, res) => {
    try {
        // Soft delete by setting status to deleted
        await runQuery(
            "UPDATE server_keys SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Server key deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Permanently delete server key
app.delete('/api/server-key/:id/permanent', requireAdmin, async (req, res) => {
    try {
        await runQuery(
            "DELETE FROM server_keys WHERE id = ?",
            [req.params.id]
        );
        
        res.json({ success: true, message: 'Server key permanently deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== USER KEYS API ==========

// Get all user keys
app.get('/api/user-keys', requireAdmin, async (req, res) => {
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
app.post('/api/user-key/generate', requireAdmin, async (req, res) => {
    try {
        const { user_id, device, expires_in_days = 7, prefix = 'USR' } = req.body;
        
        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        const timestamp = Date.now().toString(36);
        const randomPart = crypto.randomBytes(12).toString('hex').substring(0, 16).toUpperCase();
        const userKey = `${prefix}_${timestamp}_${randomPart}`;
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expires_in_days));
        
        const result = await runQuery(
            `INSERT INTO user_keys (key, user_id, device, expires_at, status, usage_count) 
             VALUES (?, ?, ?, ?, 'active', 0)`,
            [userKey, user_id, device || null, expiresAt.toISOString()]
        );
        
        const createdKey = await getQuery(
            "SELECT * FROM user_keys WHERE id = ?",
            [result.lastID]
        );
        
        res.json({
            success: true,
            key: createdKey,
            message: 'User key generated successfully'
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate user key
app.get('/api/user/validate/:key', async (req, res) => {
    try {
        const userKey = req.params.key;
        
        console.log('Validating user key:', userKey.substring(0, 10) + '...');
        
        const keyData = await getQuery(
            `SELECT * FROM user_keys 
             WHERE key = ?`,
            [userKey]
        );
        
        if (!keyData) {
            return res.json({
                valid: false,
                error: 'Invalid user key'
            });
        }
        
        // Check status
        if (keyData.status === 'locked') {
            return res.json({
                valid: false,
                error: 'User key is locked'
            });
        }
        
        if (keyData.status === 'deleted') {
            return res.json({
                valid: false,
                error: 'User key has been deleted'
            });
        }
        
        // Check expiration
        if (keyData.expires_at) {
            const expiresDate = new Date(keyData.expires_at);
            if (expiresDate < new Date()) {
                await runQuery(
                    "UPDATE user_keys SET status = 'expired' WHERE id = ?",
                    [keyData.id]
                );
                
                return res.json({
                    valid: false,
                    error: 'User key has expired'
                });
            }
        }
        
        // Increase usage count
        await runQuery(
            `UPDATE user_keys 
             SET usage_count = usage_count + 1, 
                 last_used = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [keyData.id]
        );
        
        const updatedKey = await getQuery(
            "SELECT * FROM user_keys WHERE id = ?",
            [keyData.id]
        );
        
        res.json({
            valid: true,
            key: {
                id: updatedKey.id,
                key: updatedKey.key,
                user_id: updatedKey.user_id,
                device: updatedKey.device,
                status: updatedKey.status,
                usage_count: updatedKey.usage_count,
                expires_at: updatedKey.expires_at,
                created_at: updatedKey.created_at
            }
        });
        
    } catch (error) {
        console.error('Error validating user key:', error);
        res.status(500).json({ 
            valid: false,
            error: 'Server error during validation' 
        });
    }
});

// ========== STATISTICS API ==========

// Get statistics
app.get('/api/stats', requireAdmin, async (req, res) => {
    try {
        const [serverStats, userStats, totalUsage] = await Promise.all([
            allQuery("SELECT COUNT(*) as count, SUM(usage_count) as total_usage FROM server_keys WHERE status != 'deleted'"),
            allQuery("SELECT COUNT(*) as count, SUM(usage_count) as total_usage FROM user_keys WHERE status != 'deleted'"),
            allQuery("SELECT status, COUNT(*) as count FROM server_keys GROUP BY status")
        ]);
        
        const serverKeysByStatus = await allQuery(
            "SELECT status, COUNT(*) as count FROM server_keys GROUP BY status"
        );
        
        const userKeysByStatus = await allQuery(
            "SELECT status, COUNT(*) as count FROM user_keys GROUP BY status"
        );
        
        // Calculate active keys
        const activeServerKeys = serverKeysByStatus.find(s => s.status === 'active')?.count || 0;
        const activeUserKeys = userKeysByStatus.find(s => s.status === 'active')?.count || 0;
        
        res.json({
            success: true,
            stats: {
                server_keys: {
                    total: serverStats[0].count || 0,
                    total_usage: serverStats[0].total_usage || 0,
                    by_status: serverKeysByStatus
                },
                user_keys: {
                    total: userStats[0].count || 0,
                    total_usage: userStats[0].total_usage || 0,
                    by_status: userKeysByStatus
                },
                overall: {
                    total_keys: (serverStats[0].count || 0) + (userStats[0].count || 0),
                    total_usage: (serverStats[0].total_usage || 0) + (userStats[0].total_usage || 0),
                    active_keys: activeServerKeys + activeUserKeys
                }
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ADMIN API ==========

// Get admin info
app.get('/api/admin/info', requireAdmin, async (req, res) => {
    try {
        const admin = await getQuery(
            "SELECT id, username, created_at, last_login FROM admins LIMIT 1"
        );
        
        res.json({ success: true, admin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== BATCH OPERATIONS ==========

// Bulk generate server keys
app.post('/api/server-keys/batch-generate', requireAdmin, async (req, res) => {
    try {
        const { count = 5, prefix = 'SRV', expires_in_days = 30 } = req.body;
        
        if (count > 100) {
            return res.status(400).json({ error: 'Maximum 100 keys per batch' });
        }
        
        const keys = [];
        for (let i = 0; i < count; i++) {
            const timestamp = Date.now().toString(36) + i;
            const randomPart = crypto.randomBytes(16).toString('hex').substring(0, 20).toUpperCase();
            const serverKey = `${prefix}_${timestamp}_${randomPart}`;
            
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(expires_in_days));
            
            const result = await runQuery(
                `INSERT INTO server_keys (key, name, expires_at, status, usage_count) 
                 VALUES (?, ?, ?, 'active', 0)`,
                [serverKey, `Batch Key ${i + 1}`, expiresAt.toISOString()]
            );
            
            keys.push({
                id: result.lastID,
                key: serverKey,
                expires_at: expiresAt
            });
        }
        
        res.json({
            success: true,
            message: `Generated ${count} server keys`,
            keys: keys
        });
        
    } catch (error) {
        console.error('Error batch generating keys:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export keys as CSV
app.get('/api/keys/export', requireAdmin, async (req, res) => {
    try {
        const { type = 'server' } = req.query;
        
        const table = type === 'server' ? 'server_keys' : 'user_keys';
        const keys = await allQuery(
            `SELECT * FROM ${table} ORDER BY created_at DESC`
        );
        
        // Convert to CSV
        let csv = 'ID,Key,Name,Status,Usage Count,Expires At,Created At\n';
        keys.forEach(key => {
            csv += `${key.id},"${key.key}","${key.name || ''}","${key.status}",${key.usage_count},"${key.expires_at || ''}","${key.created_at}"\n`;
        });
        
        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename=${table}_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== DATABASE INITIALIZATION ==========

// Initialize tables if they don't exist
async function initializeTables() {
    try {
        // Create admins table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )
        `);
        
        // Create server_keys table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS server_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                name TEXT,
                description TEXT,
                status TEXT DEFAULT 'active',
                usage_count INTEGER DEFAULT 0,
                expires_at DATETIME,
                last_used DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create user_keys table
        await runQuery(`
            CREATE TABLE IF NOT EXISTS user_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL,
                device TEXT,
                status TEXT DEFAULT 'active',
                usage_count INTEGER DEFAULT 0,
                expires_at DATETIME,
                last_used DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create admin account if not exists
        const adminExists = await getQuery("SELECT COUNT(*) as count FROM admins");
        if (adminExists.count === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await runQuery(
                "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
                ['admin', hashedPassword]
            );
            console.log('✅ Admin account created: admin / admin123');
        }
        
        console.log('✅ Database tables initialized');
        return true;
    } catch (error) {
        console.error('❌ Error initializing tables:', error);
        return false;
    }
}

// ========== START SERVER ==========
async function startServer() {
    try {
        const dbInitialized = await initializeDatabase();
        
        if (!dbInitialized) {
            console.error('❌ Failed to initialize database');
            process.exit(1);
        }
        
        // Initialize tables
        await initializeTables();
        
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 ADMIN KEY PANEL SERVER STARTED');
            console.log('='.repeat(50));
            console.log(`📡 Server running on port: ${PORT}`);
            console.log(`🌐 Local URL: http://localhost:${PORT}`);
            console.log(`🔑 Admin login: admin / admin123`);
            console.log('');
            console.log('📊 API ENDPOINTS:');
            console.log('├─ GET  /api/health');
            console.log('├─ POST /api/admin/login');
            console.log('');
            console.log('🔐 SERVER KEYS:');
            console.log('├─ GET  /api/server/validate/:key      (Public - for Android Shell)');
            console.log('├─ GET  /api/server-keys               (Admin)');
            console.log('├─ POST /api/server-key/generate       (Admin)');
            console.log('├─ POST /api/server-key/:id/reset      (Admin)');
            console.log('├─ POST /api/server-key/:id/lock       (Admin)');
            console.log('├─ POST /api/server-key/:id/unlock     (Admin)');
            console.log('└─ DELETE /api/server-key/:id          (Admin)');
            console.log('');
            console.log('👤 USER KEYS:');
            console.log('├─ GET  /api/user/validate/:key        (Public)');
            console.log('├─ GET  /api/user-keys                 (Admin)');
            console.log('└─ POST /api/user-key/generate         (Admin)');
            console.log('');
            console.log('📈 STATISTICS:');
            console.log('└─ GET  /api/stats                    (Admin)');
            console.log('');
            console.log('✅ Server is ready!');
            console.log('');
            console.log('💡 Usage examples:');
            console.log('• Test server key: http://localhost:' + PORT + '/api/server/validate/YOUR_KEY');
            console.log('• Test API health: http://localhost:' + PORT + '/api/health');
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

startServer();
