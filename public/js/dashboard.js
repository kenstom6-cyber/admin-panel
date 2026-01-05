const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const dbPath = process.env.NODE_ENV === 'production' 
            ? path.join(__dirname, 'data', 'keys.db')
            : path.join(__dirname, 'keys.db');
        
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error connecting to database:', err.message);
                reject(false);
            } else {
                console.log('✅ Connected to SQLite database');
                resolve(true);
            }
        });
    });
}

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

module.exports = {
    initializeDatabase,
    runQuery,
    allQuery,
    getQuery
};
