const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_REGION);
const dbPath = isVercel 
  ? path.join('/tmp', 'restaurant.db') 
  : path.join(__dirname, 'restaurant.db');

// نسخ ملف قاعدة البيانات إلى /tmp قبل الفتح
if (isVercel && !fs.existsSync(dbPath)) {
  const sourceDb = path.join(__dirname, 'restaurant.db');
  if (fs.existsSync(sourceDb)) {
    fs.copyFileSync(sourceDb, dbPath);
  }
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

module.exports = db;
