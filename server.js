[file name]: server.js
[file content begin]
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Import database functions từ database.js mới
const { 
    initializeDatabase,
    findAdminByUsername,
    updateAdminLastLogin,
    createServerKey,
    getServerKey,
    getAllServerKeys,
    updateServerKeyUsage,
    updateServerKeyStatus,
    deleteServerKey,
    findServerKeyById,
    createUserKey,
    getUserKey,
    getAllUserKeys,
    updateUserKeyUsage,
    updateUserKeyStatus,
    deleteUserKey,
    createAdmin,
    getAllAdmins,
    updateAdminPassword,
    deleteAdmin,
    getStats
} = require('./database');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'admin-key-panel-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
    }
}));

// Middleware để kiểm tra authentication cho các route admin
function requireAuth(req, res, next) {
    if (req.session && req.session.admin) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
}

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
                <a href="/login.html" class="btn">📊 Go to Login</a>
            </div>
        </body>
        </html>
    `);
});

// Serve các file tĩnh
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ========== API ROUTES ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '3.0.0'
    });
});

// Auth check
app.get('/api/auth/check', (req, res) => {
    res.json({
        authenticated: !!(req.session && req.session.admin),
        admin: req.session.admin || null
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
        
        const admin = await findAdminByUsername(username);
        
        if (!admin) {
            return res.status(401).json({ error: 'Account does not exist' });
        }
        
        const bcrypt = require('bcryptjs');
        const isValid = await bcrypt.compare(password, admin.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
        
        // Update last login
        await updateAdminLastLogin(admin.id);
        
        // Set session
        req.session.admin = {
            id: admin.id,
            username: admin.username,
            role: admin.role
        };
        
        res.json({
            success: true,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout API
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// ========== SERVER KEY ROUTES (Require Auth) ==========

// Get all server keys
app.get('/api/server-keys', requireAuth, async (req, res) => {
    try {
        const keys = await getAllServerKeys();
        res.json({ success: true, keys });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate server key
app.post('/api/server-key/generate', requireAuth, async (req, res) => {
    try {
        const { name, description, expires_in_days = 30 } = req.body;
        
        // Generate unique key
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const serverKey = 'SRV_' + Array.from({ length: 20 }, () => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        
        const expiresAt = expires_in_days ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000) : null;
        
        const result = await createServerKey(
            serverKey, 
            name || null, 
            description || null, 
            expiresAt ? expiresAt.toISOString() : null
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

// Validate server key (public endpoint - no auth required)
app.get('/api/server/validate/:key', async (req, res) => {
    try {
        const serverKey = req.params.key;
        
        const keyData = await getServerKey(serverKey);
        
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
                // Auto update status to expired
                await updateServerKeyStatus(serverKey, 'expired');
                return res.json({
                    valid: false,
                    error: 'Server key has expired'
                });
            }
        }
        
        // Increase usage count
        await updateServerKeyUsage(serverKey);
        
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

// Update server key status
app.put('/api/server-key/:id/status', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const keyId = req.params.id;
        
        const keyData = await findServerKeyById(keyId);
        if (!keyData) {
            return res.status(404).json({ error: 'Key not found' });
        }
        
        await updateServerKeyStatus(keyData.key, status);
        
        res.json({ 
            success: true, 
            message: `Key status updated to ${status}` 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete server key
app.delete('/api/server-key/:id', requireAuth, async (req, res) => {
    try {
        const keyId = req.params.id;
        
        const keyData = await findServerKeyById(keyId);
        if (!keyData) {
            return res.status(404).json({ error: 'Key not found' });
        }
        
        await deleteServerKey(keyData.key);
        
        res.json({ 
            success: true, 
            message: 'Key deleted successfully' 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== USER KEY ROUTES (Require Auth) ==========

// Get all user keys
app.get('/api/user-keys', requireAuth, async (req, res) => {
    try {
        const keys = await getAllUserKeys();
        res.json({ success: true, keys });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate user key
app.post('/api/user-key/generate', requireAuth, async (req, res) => {
    try {
        const { user_id, device, expires_in_days = 7 } = req.body;
        
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const userKey = 'USR_' + Array.from({ length: 16 }, () => 
            chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        
        const expiresAt = expires_in_days ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000) : null;
        
        const result = await createUserKey(
            userKey, 
            user_id || null, 
            device || null, 
            expiresAt ? expiresAt.toISOString() : null
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

// Validate user key (public endpoint - no auth required)
app.get('/api/user/validate/:key', async (req, res) => {
    try {
        const userKey = req.params.key;
        
        const keyData = await getUserKey(userKey);
        
        if (!keyData) {
            return res.json({
                valid: false,
                error: 'Invalid user key'
            });
        }
        
        // Check expiration
        if (keyData.expires_at) {
            const expiresDate = new Date(keyData.expires_at);
            if (expiresDate < new Date()) {
                // Auto update status to expired
                await updateUserKeyStatus(userKey, 'expired');
                return res.json({
                    valid: false,
                    error: 'User key has expired'
                });
            }
        }
        
        // Increase usage count
        await updateUserKeyUsage(userKey);
        
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

// Update user key status
app.put('/api/user-key/:id/status', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const keyId = req.params.id;
        
        const keyData = await findUserKeyById(keyId);
        if (!keyData) {
            return res.status(404).json({ error: 'Key not found' });
        }
        
        await updateUserKeyStatus(keyData.key, status);
        
        res.json({ 
            success: true, 
            message: `Key status updated to ${status}` 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete user key
app.delete('/api/user-key/:id', requireAuth, async (req, res) => {
    try {
        const keyId = req.params.id;
        
        const keyData = await findUserKeyById(keyId);
        if (!keyData) {
            return res.status(404).json({ error: 'Key not found' });
        }
        
        await deleteUserKey(keyData.key);
        
        res.json({ 
            success: true, 
            message: 'Key deleted successfully' 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ADMIN MANAGEMENT ROUTES (Require Auth) ==========

// Get all admins
app.get('/api/admins', requireAuth, async (req, res) => {
    try {
        const admins = await getAllAdmins();
        res.json({ success: true, admins });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new admin
app.post('/api/admins', requireAuth, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const result = await createAdmin(username, password);
        
        res.json({
            success: true,
            message: 'Admin created successfully',
            admin_id: result.lastID
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change admin password
app.put('/api/admins/:id/password', requireAuth, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const adminId = req.params.id;
        
        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }
        
        await updateAdminPassword(adminId, newPassword);
        
        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete admin
app.delete('/api/admins/:id', requireAuth, async (req, res) => {
    try {
        const adminId = req.params.id;
        
        await deleteAdmin(adminId);
        
        res.json({
            success: true,
            message: 'Admin deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== STATISTICS ROUTES (Require Auth) ==========

// Get statistics
app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const stats = await getStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ERROR HANDLING ==========
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========
async function startServer() {
    try {
        const dbInitialized = await initializeDatabase();
        
        if (!dbInitialized) {
            console.error('❌ Failed to initialize database');
            process.exit(1);
        }
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log('='.repeat(50));
            console.log('🚀 ADMIN KEY PANEL SERVER STARTED');
            console.log('='.repeat(50));
            console.log(`📡 Server running on port: ${PORT}`);
            console.log(`🌐 Local URL: http://localhost:${PORT}`);
            console.log(`🔑 Default admin: admin / admin123`);
            console.log('');
            console.log('📊 API ENDPOINTS:');
            console.log('├─ PUBLIC:');
            console.log('│  ├─ GET  /api/health');
            console.log('│  ├─ GET  /api/server/validate/:key');
            console.log('│  └─ GET  /api/user/validate/:key');
            console.log('├─ AUTH:');
            console.log('│  ├─ POST /api/admin/login');
            console.log('│  ├─ POST /api/admin/logout');
            console.log('│  └─ GET  /api/auth/check');
            console.log('├─ SERVER KEYS (Admin):');
            console.log('│  ├─ GET  /api/server-keys');
            console.log('│  ├─ POST /api/server-key/generate');
            console.log('│  ├─ PUT  /api/server-key/:id/status');
            console.log('│  └─ DELETE /api/server-key/:id');
            console.log('├─ USER KEYS (Admin):');
            console.log('│  ├─ GET  /api/user-keys');
            console.log('│  ├─ POST /api/user-key/generate');
            console.log('│  ├─ PUT  /api/user-key/:id/status');
            console.log('│  └─ DELETE /api/user-key/:id');
            console.log('├─ ADMIN MANAGEMENT:');
            console.log('│  ├─ GET  /api/admins');
            console.log('│  ├─ POST /api/admins');
            console.log('│  ├─ PUT  /api/admins/:id/password');
            console.log('│  └─ DELETE /api/admins/:id');
            console.log('└─ STATISTICS:');
            console.log('   └─ GET  /api/stats');
            console.log('');
            console.log('✅ Server is ready!');
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

startServer();
[file content end]
