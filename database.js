const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// ========== HELPER FUNCTIONS ĐƠN GIẢN ==========
// KHÔNG ghi đè methods của db object
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
        
        console.log('✅ Database initialized successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        return false;
    }
}

module.exports = { 
    db, 
    initializeDatabase,
    runQuery,
    allQuery, 
    getQuery 
};
