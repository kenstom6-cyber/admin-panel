[file name]: database.js
[file content begin]
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// ========== HELPER FUNCTIONS ==========
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// ========== DATABASE FUNCTIONS CHO AUTH ==========
async function findAdminByUsername(username) {
    return await getQuery(
        "SELECT * FROM admins WHERE username = ?", 
        [username]
    );
}

async function updateAdminLastLogin(adminId) {
    return await runQuery(
        "UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
        [adminId]
    );
}

// ========== DATABASE FUNCTIONS CHO SERVER KEYS ==========
async function createServerKey(key, name, description, expiresAt = null) {
    return await runQuery(
        `INSERT INTO server_keys (key, name, description, expires_at) 
         VALUES (?, ?, ?, ?)`,
        [key, name, description, expiresAt]
    );
}

async function getServerKey(key) {
    return await getQuery(
        "SELECT * FROM server_keys WHERE key = ? AND status = 'active'",
        [key]
    );
}

async function getAllServerKeys() {
    return await allQuery(
        "SELECT * FROM server_keys ORDER BY created_at DESC"
    );
}

async function updateServerKeyUsage(key) {
    return await runQuery(
        `UPDATE server_keys 
         SET last_used = CURRENT_TIMESTAMP, 
             usage_count = usage_count + 1 
         WHERE key = ?`,
        [key]
    );
}

async function updateServerKeyStatus(key, status) {
    return await runQuery(
        "UPDATE server_keys SET status = ? WHERE key = ?",
        [status, key]
    );
}

async function deleteServerKey(key) {
    return await runQuery(
        "DELETE FROM server_keys WHERE key = ?",
        [key]
    );
}

async function findServerKeyById(id) {
    return await getQuery(
        "SELECT * FROM server_keys WHERE id = ?",
        [id]
    );
}

// ========== DATABASE FUNCTIONS CHO USER KEYS ==========
async function createUserKey(key, userId, device, expiresAt = null) {
    return await runQuery(
        `INSERT INTO user_keys (key, user_id, device, expires_at) 
         VALUES (?, ?, ?, ?)`,
        [key, userId, device, expiresAt]
    );
}

async function getUserKey(key) {
    return await getQuery(
        "SELECT * FROM user_keys WHERE key = ? AND status = 'active'",
        [key]
    );
}

async function getAllUserKeys() {
    return await allQuery(
        "SELECT * FROM user_keys ORDER BY created_at DESC"
    );
}

async function updateUserKeyUsage(key) {
    return await runQuery(
        `UPDATE user_keys 
         SET last_used = CURRENT_TIMESTAMP, 
             usage_count = usage_count + 1 
         WHERE key = ?`,
        [key]
    );
}

async function updateUserKeyStatus(key, status) {
    return await runQuery(
        "UPDATE user_keys SET status = ? WHERE key = ?",
        [status, key]
    );
}

async function deleteUserKey(key) {
    return await runQuery(
        "DELETE FROM user_keys WHERE key = ?",
        [key]
    );
}

async function findUserKeyById(id) {
    return await getQuery(
        "SELECT * FROM user_keys WHERE id = ?",
        [id]
    );
}

async function findUserKeysByUserId(userId) {
    return await allQuery(
        "SELECT * FROM user_keys WHERE user_id = ? ORDER BY created_at DESC",
        [userId]
    );
}

// ========== ADMIN MANAGEMENT ==========
async function createAdmin(username, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return await runQuery(
        "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
        [username, hashedPassword]
    );
}

async function getAllAdmins() {
    return await allQuery(
        "SELECT id, username, role, created_at, last_login FROM admins ORDER BY created_at DESC"
    );
}

async function updateAdminPassword(adminId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return await runQuery(
        "UPDATE admins SET password_hash = ? WHERE id = ?",
        [hashedPassword, adminId]
    );
}

async function deleteAdmin(adminId) {
    return await runQuery(
        "DELETE FROM admins WHERE id = ? AND username != 'admin'",
        [adminId]
    );
}

// ========== STATISTICS ==========
async function getStats() {
    const stats = await getQuery(`
        SELECT 
            (SELECT COUNT(*) FROM admins) as admin_count,
            (SELECT COUNT(*) FROM server_keys WHERE status = 'active') as active_server_keys,
            (SELECT COUNT(*) FROM user_keys WHERE status = 'active') as active_user_keys,
            (SELECT COUNT(*) FROM server_keys) as total_server_keys,
            (SELECT COUNT(*) FROM user_keys) as total_user_keys,
            (SELECT COUNT(*) FROM server_keys WHERE expires_at < CURRENT_TIMESTAMP AND status = 'active') as expired_server_keys,
            (SELECT COUNT(*) FROM user_keys WHERE expires_at < CURRENT_TIMESTAMP AND status = 'active') as expired_user_keys
    `);
    
    const recentActivity = await allQuery(`
        SELECT 'server_key' as type, key, last_used, usage_count 
        FROM server_keys 
        WHERE last_used IS NOT NULL 
        UNION ALL
        SELECT 'user_key' as type, key, last_used, usage_count 
        FROM user_keys 
        WHERE last_used IS NOT NULL 
        ORDER BY last_used DESC 
        LIMIT 10
    `);
    
    return { ...stats, recentActivity };
}

// ========== INITIALIZE DATABASE ==========
async function initializeDatabase() {
    console.log('🔄 Initializing database...');
    
    try {
        // 1. Admins table
        await runQuery(`CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`);
        
        // 2. Server Keys table
        await runQuery(`CREATE TABLE IF NOT EXISTS server_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            name TEXT,
            description TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            last_used DATETIME,
            usage_count INTEGER DEFAULT 0
        )`);
        
        // 3. User Keys table
        await runQuery(`CREATE TABLE IF NOT EXISTS user_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            user_id TEXT,
            device TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            last_used DATETIME,
            usage_count INTEGER DEFAULT 0
        )`);
        
        // 4. Check and create default admin
        const adminCheck = await getQuery("SELECT COUNT(*) as count FROM admins WHERE username = 'admin'");
        
        if (adminCheck.count === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await runQuery(
                "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
                ['admin', hashedPassword]
            );
            console.log('✅ Default admin created: admin / admin123');
        } else {
            console.log('✅ Admin already exists');
        }
        
        // 5. Create indexes for better performance
        await runQuery("CREATE INDEX IF NOT EXISTS idx_server_keys_status ON server_keys(status)");
        await runQuery("CREATE INDEX IF NOT EXISTS idx_user_keys_status ON user_keys(status)");
        await runQuery("CREATE INDEX IF NOT EXISTS idx_server_keys_expires ON server_keys(expires_at)");
        await runQuery("CREATE INDEX IF NOT EXISTS idx_user_keys_expires ON user_keys(expires_at)");
        
        console.log('✅ Database initialized successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        return false;
    }
}

// ========== CLOSE DATABASE ==========
function closeDatabase() {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else {
                console.log('✅ Database connection closed');
                resolve();
            }
        });
    });
}

module.exports = { 
    db,
    // Core functions
    runQuery,
    allQuery, 
    getQuery,
    initializeDatabase,
    closeDatabase,
    
    // Auth functions
    findAdminByUsername,
    updateAdminLastLogin,
    
    // Server Key functions
    createServerKey,
    getServerKey,
    getAllServerKeys,
    updateServerKeyUsage,
    updateServerKeyStatus,
    deleteServerKey,
    findServerKeyById,
    
    // User Key functions
    createUserKey,
    getUserKey,
    getAllUserKeys,
    updateUserKeyUsage,
    updateUserKeyStatus,
    deleteUserKey,
    findUserKeyById,
    findUserKeysByUserId,
    
    // Admin management
    createAdmin,
    getAllAdmins,
    updateAdminPassword,
    deleteAdmin,
    
    // Statistics
    getStats
};
[file content end]
