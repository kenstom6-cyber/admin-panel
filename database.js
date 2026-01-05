const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Kết nối database
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Không thể kết nối database:', err.message);
    } else {
        console.log('✅ Đã kết nối tới SQLite database.');
        initializeDatabase();
    }
});

// Khởi tạo database
async function initializeDatabase() {
    // Tạo bảng admin users
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )`);

    // Tạo bảng keys với nhiều trường thông tin hơn
    db.run(`CREATE TABLE IF NOT EXISTS keys (
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
        usage_limit INTEGER DEFAULT 0,
        ip_whitelist TEXT,
        metadata TEXT
    )`);

    // Tạo bảng logs
    db.run(`CREATE TABLE IF NOT EXISTS key_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id INTEGER,
        action TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (key_id) REFERENCES keys(id)
    )`);

    // Tạo admin mặc định nếu chưa có
    const adminExists = await db.asyncGet("SELECT COUNT(*) as count FROM admin_users");
    if (adminExists.count === 0) {
        const defaultPassword = await bcrypt.hash('admin123', 10);
        db.run(
            "INSERT INTO admin_users (username, password_hash, email) VALUES (?, ?, ?)",
            ['admin', defaultPassword, 'admin@example.com'],
            (err) => {
                if (err) console.error('Lỗi tạo admin:', err);
                else console.log('✅ Đã tạo admin mặc định: admin / admin123');
            }
        );
    }
}

// Hàm trợ giúp Promise
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

// Hàm tạo key tự động
db.generateKey = (prefix = 'KEY', length = 24) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomPart = Array.from({ length: length - prefix.length }, 
        () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return `${prefix}_${randomPart}`;
};

// Hàm log actions
db.logAction = (keyId, action, details = {}, ip = '', userAgent = '') => {
    return db.asyncRun(
        "INSERT INTO key_logs (key_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)",
        [keyId, action, JSON.stringify(details), ip, userAgent]
    );
};

module.exports = db;
