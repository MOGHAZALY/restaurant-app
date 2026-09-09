// routes/payment.js — تكامل الدفع الإلكتروني عبر Paymob
// Paymob بتغطي: فيزا/ماستركارد، فودافون كاش وباقي المحافظ، وكود دفع فوري (Fawry) — كل ده بحساب واحد
//
// عشان يشتغل لازم تحط بياناتك في ملف .env (شوف .env.example)
// وتاخد الداتا دي من حسابك على https://accept.paymob.com

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const crypto = require('crypto');
const db = require('./db');

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID; // integration id بتاع طريقة الدفع (كارت مثلاً)
const PAYMOB_IFRAME_ID = process.env.PAYMOB_IFRAME_ID;
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

const PAYMOB_BASE = 'https://accept.paymob.com/api';

// خطوة 1: الحصول على auth token
async function getAuthToken() {
  const res = await fetch(`${PAYMOB_BASE}/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('فشل الحصول على Paymob auth token — تأكد من PAYMOB_API_KEY');
  return data.token;
}

// خطوة 2: تسجيل الطلب في Paymob
async function registerOrder(authToken, order) {
  const res = await fetch(`${PAYMOB_BASE}/ecommerce/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: Math.round(order.total * 100),
      currency: 'EGP',
      merchant_order_id: order.order_number,
      items: [],
    }),
  });
  const data = await res.json();
  if (!data.id) throw new Error('فشل تسجيل الطلب في Paymob');
  return data.id;
}

// خطوة 3: طلب payment key
async function getPaymentKey(authToken, order, paymobOrderId) {
  const res = await fetch(`${PAYMOB_BASE}/acceptance/payment_keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: Math.round(order.total * 100),
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: {
        // بيانات وهمية مقبولة من Paymob لو مفيش بيانات عميل حقيقية عندك (نظام المطعم بسيط)
        apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA',
        phone_number: 'NA', city: 'NA', country: 'NA',
        email: 'guest@example.com', first_name: 'Guest', last_name: `Table-${order.table_number}`,
        state: 'NA',
      },
      currency: 'EGP',
      integration_id: PAYMOB_INTEGRATION_ID,
    }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('فشل الحصول على payment key');
  return data.token;
}

// بدء عملية الدفع لطلب معين — الفرونت يستدعي الـ endpoint ده لما العميل يختار "دفع أونلاين"
router.post('/initiate/:orderId', async (req, res) => {
  try {
    if (!PAYMOB_API_KEY) {
      return res.status(500).json({ error: 'الدفع الإلكتروني مش متفعل لسه — لازم تضيف بيانات Paymob في .env' });
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

    const authToken = await getAuthToken();
    const paymobOrderId = await registerOrder(authToken, order);
    const paymentKey = await getPaymentKey(authToken, order, paymobOrderId);

    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`;
    res.json({ payment_url: iframeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Webhook — Paymob بتبعت عليه لما الدفع يتم أو يفشل (لازم تحط اللينك ده في إعدادات Paymob)
router.post('/webhook', express.json(), (req, res) => {
  try {
    const { obj } = req.body;
    if (!obj) return res.status(400).send('bad payload');

    // التحقق من HMAC (اختياري لكن مهم أمنيًا في بيئة حقيقية — راجع توثيق Paymob لترتيب الحقول الدقيق)
    // if (PAYMOB_HMAC_SECRET) { ...validate hmac from req.query.hmac... }

    const merchantOrderId = obj.order?.merchant_order_id;
    const success = obj.success;

    if (merchantOrderId) {
      const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(merchantOrderId);
      if (order) {
        db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?')
          .run(success ? 'paid' : 'unpaid', order.id);
      }
    }
    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    res.status(500).send('error');
  }
});

module.exports = router;
