require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON body
app.use(express.static('public')); // Phục vụ file tĩnh từ thư mục 'public'

// ========== API BACKEND ==========
// API dành cho Shell Script Android: Kiểm tra và lấy key (ví dụ)
app.get('/api/validate-key/:key', async (req, res) => {
    try {
        const key = req.params.key;
        const row = await db.asyncGet(
            "SELECT * FROM keys WHERE key = ? AND status = 'active'",
            [key]
        );
        if (row) {
            // Cập nhật lượt dùng
            await db.asyncRun(
                "UPDATE keys SET last_used = CURRENT_TIMESTAMP, usage_count = usage_count + 1 WHERE id = ?",
                [row.id]
            );
            res.json({ valid: true, owner: row.owner, usage_count: row.usage_count });
        } else {
            res.json({ valid: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API lấy tất cả keys (cho admin panel)
app.get('/api/keys', async (req, res) => {
    try {
        const rows = await db.asyncAll("SELECT * FROM keys ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API tạo key mới
app.post('/api/keys', async (req, res) => {
    try {
        const { key, owner } = req.body;
        if (!key) {
            return res.status(400).json({ error: 'Thiếu field "key"' });
        }
        const result = await db.asyncRun(
            "INSERT INTO keys (key, owner) VALUES (?, ?)",
            [key, owner || null]
        );
        res.json({ id: result.lastID, message: 'Key đã được tạo.' });
    } catch (err) {
        // Xử lý lỗi trùng key
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Key đã tồn tại.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// API reset key (reset usage, hoặc đặt lại trạng thái active)
app.put('/api/keys/:id/reset', async (req, res) => {
    try {
        await db.asyncRun(
            "UPDATE keys SET status = 'active', usage_count = 0, last_used = NULL WHERE id = ?",
            [req.params.id]
        );
        res.json({ message: 'Key đã được reset.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API khóa (lock) key
app.put('/api/keys/:id/lock', async (req, res) => {
    try {
        await db.asyncRun(
            "UPDATE keys SET status = 'locked' WHERE id = ?",
            [req.params.id]
        );
        res.json({ message: 'Key đã bị khóa.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API xóa (delete) key (xóa mềm - đổi status)
app.delete('/api/keys/:id', async (req, res) => {
    try {
        await db.asyncRun(
            "UPDATE keys SET status = 'deleted' WHERE id = ?",
            [req.params.id]
        );
        res.json({ message: 'Key đã được đánh dấu là đã xóa.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
