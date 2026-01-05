// File: setup-admin.js
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

async function setupAdmin() {
    const password = 'admin123'; // Hoặc nhập từ command line
    const passwordHash = await bcrypt.hash(password, 10);
    
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
        db.run(
            "INSERT OR REPLACE INTO admin_users (username, password_hash, email) VALUES (?, ?, ?)",
            ['admin', passwordHash, 'admin@example.com'],
            (err) => {
                if (err) {
                    console.error('❌ Lỗi:', err.message);
                } else {
                    console.log('✅ Admin đã được tạo/reset');
                    console.log('👤 Username: admin');
                    console.log('🔑 Password: admin123');
                }
                db.close();
            }
        );
    });
}

setupAdmin();
