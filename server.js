require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const { db, initializeDatabase } = require('./database'); // Thay đổi import
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    store: new SQLiteStore({ 
        db: 'sessions.db', 
        dir: '.',
        table: 'sessions'  // Thêm table name rõ ràng
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// Serve static files
app.use(express.static('public'));

// ========== KHỞI ĐỘNG SERVER VÀ DATABASE ==========
async function startServer() {
    try {
        console.log('🔄 Đang khởi tạo database...');
        await initializeDatabase();
        console.log('✅ Database đã sẵn sàng');
        
        // Các route (giữ nguyên tất cả route từ trước)
        
        // ========== AUTH ROUTES ==========
        app.post('/api/auth/login', async (req, res) => {
            // Giữ nguyên code login
            try {
                const { username, password } = req.body;
                const user = await db.asyncGet("SELECT * FROM admin_users WHERE username = ?", [username]);
                
                if (!user) {
                    return res.status(401).json({ error: 'Tài khoản không tồn tại' });
                }

                const bcrypt = require('bcryptjs');
                const validPassword = await bcrypt.compare(password, user.password_hash);
                
                if (!validPassword) {
                    return res.status(401).json({ error: 'Mật khẩu không đúng' });
                }

                // Update last login
                await db.asyncRun("UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

                // Set session
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.isAdmin = true;

                res.json({ 
                    success: true, 
                    user: { 
                        id: user.id, 
                        username: user.username,
                        email: user.email 
                    } 
                });
            } catch (err) {
                console.error('Login error:', err);
                res.status(500).json({ error: 'Lỗi server' });
            }
        });

        // ========== CÁC ROUTE KHÁC GIỮ NGUYÊN ==========
        // (Dán toàn bộ các route từ file server.js cũ vào đây)
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
            console.log(`📊 Đăng nhập với: admin / admin123`);
        });
        
    } catch (error) {
        console.error('❌ Lỗi khởi tạo server:', error);
        process.exit(1);
    }
}

// Gọi hàm start
startServer();
