// routes/features.js — زرار الخدمة (Service Bell) + قائمة الانتظار (Waitlist / Pre-ordering)
const express = require('express');
const router = express.Router();
const db = require('../db');

/* ---------------- Virtual Service Bell ---------------- */

// العميل بيضغط على زرار (الشيك / مية / أدوات / حاجة تانية)
router.post('/service-request', (req, res) => {
  const { table_number, request_type } = req.body;
  const validTypes = ['bill', 'water', 'utensils', 'other'];
  if (!table_number || !validTypes.includes(request_type)) {
    return res.status(400).json({ error: 'بيانات الطلب غير صحيحة' });
  }
  const result = db.prepare(`
    INSERT INTO service_requests (table_number, request_type, status)
    VALUES (?, ?, 'pending')
  `).run(table_number, request_type);
  res.json({ id: result.lastInsertRowid });
});

// شاشة الويتر بتجيب كل الطلبات المعلقة (بتتحدث كل شوية Polling)
router.get('/service-request', (req, res) => {
  const requests = db.prepare(`
    SELECT * FROM service_requests WHERE status = 'pending' ORDER BY created_at ASC
  `).all();
  res.json(requests);
});

// الويتر يقفل الطلب بعد ما ينفذه
router.patch('/service-request/:id/done', (req, res) => {
  db.prepare(`UPDATE service_requests SET status = 'done' WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

/* ---------------- Waitlist (Pre-ordering) ---------------- */

// تسجيل عميل في قائمة الانتظار — بيرجعله رابط المينو (يتبعت على واتساب)
router.post('/waitlist', (req, res) => {
  const { customer_name, party_size } = req.body;
  if (!customer_name) return res.status(400).json({ error: 'الاسم مطلوب' });

  const result = db.prepare(`
    INSERT INTO waitlist (customer_name, party_size, status)
    VALUES (?, ?, 'waiting')
  `).run(customer_name, party_size || 1);

  res.json({
    waitlist_id: result.lastInsertRowid,
    // العميل يفتح اللينك ده وهو مستني، ويختار أكله قبل ما يقعد
    preorder_link: `/menu.html?waitlist=${result.lastInsertRowid}`,
  });
});

// جلب قائمة الانتظار الحالية (للريسبشن)
router.get('/waitlist', (req, res) => {
  const list = db.prepare(`SELECT * FROM waitlist WHERE status = 'waiting' ORDER BY created_at ASC`).all();
  res.json(list);
});

// لما العميل يقعد على ترابيزة — بيربط طلبه اللي عمله وهو مستني بالترابيزة، ويتبعت المطبخ فورًا
router.patch('/waitlist/:id/seat', (req, res) => {
  const { table_number } = req.body;
  if (!table_number) return res.status(400).json({ error: 'رقم الترابيزة مطلوب' });

  db.prepare(`UPDATE waitlist SET status = 'seated', table_number = ? WHERE id = ?`)
    .run(table_number, req.params.id);

  res.json({ success: true });
});

module.exports = router;
