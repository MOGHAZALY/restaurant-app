// routes/menu.js — إدارة المينو
const express = require('express');
const router = express.Router();
const db = require('./db');

// جلب كل المينو (متاح فقط)
router.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items WHERE available = 1 ORDER BY category, id').all();
  res.json(items);
});

// جلب كل المينو حتى الغير متاح (للإدارة)
router.get('/all', (req, res) => {
  const items = db.prepare('SELECT * FROM menu_items ORDER BY category, id').all();
  res.json(items);
});

// إضافة صنف جديد
router.post('/', (req, res) => {
  const { name, description, price, category, image_url } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'الاسم والسعر والتصنيف مطلوبين' });
  }
  const stmt = db.prepare(`
    INSERT INTO menu_items (name, description, price, category, image_url, available)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  const result = stmt.run(name, description || '', price, category, image_url || '');
  res.json({ id: result.lastInsertRowid });
});

// تعديل صنف (السعر، التوفر، إلخ)
router.put('/:id', (req, res) => {
  const { name, description, price, category, image_url, available } = req.body;
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'الصنف غير موجود' });

  db.prepare(`
    UPDATE menu_items SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      category = COALESCE(?, category),
      image_url = COALESCE(?, image_url),
      available = COALESCE(?, available)
    WHERE id = ?
  `).run(name, description, price, category, image_url, available, req.params.id);

  res.json({ success: true });
});

// حذف صنف
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
