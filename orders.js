// orders.js — إنشاء الطلبات، عرضها للمطبخ، تحديث الحالة
const express = require('express');
const router = express.Router();

// التعديل: تغيير المسار إلى ./db لأن الملف أصبح في المجلد الرئيسي
const db = require('./db');

// توليد رقم طلب بسيط وقابل للقراءة (مثال: 250)
function generateOrderNumber() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countToday = db.prepare(`
    SELECT COUNT(*) as count FROM orders WHERE order_number LIKE ?
  `).get(`${today}-%`).count;
  const seq = String(countToday + 1).padStart(3, '0');
  return `${today}-${seq}`;
}

// بيرجع السعر الفعلي للصنف دلوقتي (بيراعي الـ Happy Hour لو مفعّل)
function getEffectivePrice(menuItem) {
  if (!menuItem.happy_hour_price || !menuItem.happy_hour_start || !menuItem.happy_hour_end) {
    return menuItem.price;
  }
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = menuItem.happy_hour_start.split(':').map(Number);
  const [eh, em] = menuItem.happy_hour_end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const inRange = start <= end ? (current >= start && current <= end) : (current >= start || current <= end);
  return inRange ? menuItem.happy_hour_price : menuItem.price;
}

// إنشاء طلب جديد (من صفحة العميل بعد مسح الـ QR)
router.post('/', (req, res) => {
  const { table_number, items, notes, payment_method, group_code } = req.body;

  if (!table_number || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'رقم الترابيزة والأصناف مطلوبين' });
  }

  const menuStmt = db.prepare('SELECT * FROM menu_items WHERE id = ? AND available = 1');
  let total = 0;
  const validatedItems = [];

  for (const it of items) {
    const menuItem = menuStmt.get(it.menu_item_id);
    if (!menuItem) continue;
    const qty = Math.max(1, parseInt(it.quantity) || 1);
    const price = getEffectivePrice(menuItem);
    total += price * qty;
    validatedItems.push({
      menu_item_id: menuItem.id,
      item_name: menuItem.name,
      quantity: qty,
      price,
      participant_name: it.participant_name || null,
    });
  }

  if (validatedItems.length === 0) {
    return res.status(400).json({ error: 'لا يوجد أصناف صالحة في الطلب' });
  }

  const order_number = generateOrderNumber();
  const payment_status = payment_method === 'online' ? 'unpaid' : 'pay_at_counter';

  const insertOrder = db.prepare(`
    INSERT INTO orders (order_number, table_number, group_code, status, payment_status, payment_method, total, notes)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
  `);
  const result = insertOrder.run(
    order_number,
    table_number,
    group_code || null,
    payment_status,
    payment_method || 'counter',
    total,
    notes || ''
  );

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price, participant_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const it of validatedItems) {
    insertItem.run(result.lastInsertRowid, it.menu_item_id, it.item_name, it.quantity, it.price, it.participant_name);
  }

  res.json({
    order_id: result.lastInsertRowid,
    order_number,
    total,
    payment_status,
  });
});

// تقسيم الفاتورة حسب كل شخص في الطلب الجماعي (Group Ordering / Split Bill)
router.get('/:id/split', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);

  const byPerson = {};
  for (const it of items) {
    const name = it.participant_name || 'مشترك';
    if (!byPerson[name]) byPerson[name] = { name, items: [], subtotal: 0 };
    byPerson[name].items.push(it);
    byPerson[name].subtotal += it.price * it.quantity;
  }

  res.json({
    order_number: order.order_number,
    total: order.total,
    split: Object.values(byPerson),
  });
});

// إضافة تقييم سريع قبل الدفع (Real-time Feedback)
router.post('/:id/rating', (req, res) => {
  const { rating, feedback } = req.body;
  if (![1, 2, 3].includes(rating)) {
    return res.status(400).json({ error: 'تقييم غير صحيح' });
  }
  db.prepare('UPDATE orders SET rating = ?, rating_feedback = ? WHERE id = ?')
    .run(rating, feedback || '', req.params.id);
  res.json({ success: true, alert: rating === 1 });
});

// جلب حالة طلب معين (يستخدمها العميل عشان يتابع طلبه)
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
  res.json({ ...order, items });
});

// جلب كل الطلبات النشطة (لشاشة المطبخ) — مرتبة من الأقدم للأحدث
router.get('/', (req, res) => {
  const { status } = req.query;
  let orders;
  if (status) {
    orders = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at ASC').all(status);
  } else {
    orders = db.prepare(`
      SELECT * FROM orders WHERE status != 'served' ORDER BY created_at ASC
    `).all();
  }
  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const full = orders.map(o => ({ ...o, items: itemsStmt.all(o.id) }));
  res.json(full);
});

// تحديث حالة الطلب (المطبخ يستخدمها: preparing -> ready -> served)
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'preparing', 'ready', 'served'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صحيحة' });
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

module.exports = router;
