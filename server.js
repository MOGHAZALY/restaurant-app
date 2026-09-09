// server.js — نقطة تشغيل السيرفر
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// التعديل: استدعاء الملفات من المجلد الرئيسي مباشرة
const menuRoutes = require('./menu');
const orderRoutes = require('./orders');
const paymentRoutes = require('./payment');
const featuresRoutes = require('./features');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/features', featuresRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// تشغيل السيرفر محلياً
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ السيرفر شغال على http://localhost:${PORT}`);
  });
}

// تصدير التطبيق لتشغيله على Vercel
module.exports = app;
