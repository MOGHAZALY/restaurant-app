// db.js — إعداد قاعدة البيانات (SQLite) وإنشاء الجداول لو مش موجودة
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'restaurant.db'));

db.pragma('journal_mode = WAL');

// جدول أصناف المينو
db.exec(`
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,              -- فيديو 3 ثواني للصنف (Visual Menu)
  model_url TEXT,               -- ملف .glb لعرض الطبق بالـ AR (لو متوفر)
  happy_hour_price REAL,        -- سعر مخفض في وقت معين (Dynamic Pricing)
  happy_hour_start TEXT,        -- بصيغة HH:MM
  happy_hour_end TEXT,          -- بصيغة HH:MM
  available INTEGER DEFAULT 1
);
`);

// جدول الطلبات
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  table_number TEXT NOT NULL,
  group_code TEXT,              -- كود الطلب الجماعي (لو فيه أكتر من شخص بيطلب من نفس الترابيزة)
  status TEXT NOT NULL DEFAULT 'pending', -- pending -> preparing -> ready -> served
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid -> paid -> pay_at_counter
  payment_method TEXT,
  total REAL NOT NULL,
  notes TEXT,
  rating INTEGER,               -- 1 = مش راضي, 2 = عادي, 3 = مبسوط (Real-time Feedback)
  rating_feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// جدول تفاصيل كل طلب (الأصناف)
db.exec(`
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  menu_item_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  participant_name TEXT,        -- اسم الشخص اللي طلب الصنف ده (لتقسيم الفاتورة)
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);
`);

// جدول طلبات الخدمة (Virtual Service Bell)
db.exec(`
CREATE TABLE IF NOT EXISTS service_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_number TEXT NOT NULL,
  request_type TEXT NOT NULL,   -- bill | water | utensils | other
  status TEXT NOT NULL DEFAULT 'pending', -- pending -> done
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// جدول قائمة الانتظار (Pre-ordering أثناء الانتظار)
db.exec(`
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  party_size INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting -> seated
  table_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

module.exports = db;
