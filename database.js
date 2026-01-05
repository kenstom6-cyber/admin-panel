const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Kết nối tới file database. Dữ liệu sẽ tồn tại ngay cả khi server khởi động lại.
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Không thể kết nối database:', err.message);
    } else {
        console.log('✅ Đã kết nối tới SQLite database.');
        // Tạo bảng keys nếu chưa tồn tại
        db.run(`CREATE TABLE IF NOT EXISTS keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            owner TEXT,
            status TEXT DEFAULT 'active', -- 'active', 'locked', 'deleted'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME,
            usage_count INTEGER DEFAULT 0
        )`);
    }
});

// Hàm trợ giúp để chạy query dạng promise
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

module.exports = db;
