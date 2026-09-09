// server.js — نقطة تشغيل السيرفر
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// استدعاء ملفات الروت من المجلد الرئيسي
const menuRoutes = require('./menu');
const orderRoutes = require('./orders');
const paymentRoutes = require('./payment');
const featuresRoutes = require('./features');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// تقديم الملفات الثابتة (HTML, CSS, JS) من المجلد الرئيسي
app.use(express.static(__dirname));

// ربط مسارات الـ API
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/features', featuresRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// توجيه الزائر أوتوماتيكياً لصفحة المينو عند فتح الرابط الرئيسي
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'menu.html'));
});

// تشغيل السيرفر محلياً
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ السيرفر شغال على http://localhost:${PORT}`);
  });
}

// تصدير التطبيق لتشغيله على Vercel
module.exports = app;
