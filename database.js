const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Helper functions
db.run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

db.all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

db.get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Initialize database
async function initializeDatabase() {
    console.log('🔄 Initializing database...');
    
    try {
        // Admins table
        await db.run(`CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`);
        
        // Server Keys table (for Android Shell)
        await db.run(`CREATE TABLE IF NOT EXISTS server_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            name TEXT,
            description TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            last_used DATETIME,
            usage_count INTEGER DEFAULT 0,
            ip_address TEXT,
            user_agent TEXT
        )`);
        
        // User Keys table
        await db.run(`CREATE TABLE IF NOT EXISTS user_keys (
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
        
        // Activity logs
        await db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_id INTEGER,
            key_type TEXT,
            action TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Check and create default admin
        const adminCheck = await db.get("SELECT COUNT(*) as count FROM admins WHERE username = 'admin'");
        
        if (adminCheck.count === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.run(
                "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
                ['admin', hashedPassword]
            );
            console.log('✅ Default admin created: admin / admin123');
        }
        
        console.log('✅ Database initialized successfully');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

module.exports = { db, initializeDatabase };
