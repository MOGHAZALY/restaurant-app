// app.js — منطق صفحة المينو الخاصة بالعميل
const API = 'http://localhost:3000/api'; // غيّرها لدومين السيرفر الحقيقي بعد الرفع

const params = new URLSearchParams(window.location.search);
const TABLE_NUMBER = params.get('table') || 'غير محدد';
let GROUP_CODE = params.get('group') || null;
let PARTICIPANT_NAME = localStorage.getItem('participant_name') || null;

document.getElementById('table-label').textContent = `ترابيزة رقم: ${TABLE_NUMBER}`;

let menuItems = [];
let cart = []; // { menu_item_id, name, price, quantity }
let currentOrderId = null;
let paymentMethod = 'counter';

/* ============ تحميل المينو ============ */
async function loadMenu() {
  const res = await fetch(`${API}/menu`);
  menuItems = await res.json();
  renderMenu();
}

function renderMenu() {
  const container = document.getElementById('menu-container');
  container.innerHTML = '';

  const categories = [...new Set(menuItems.map(i => i.category))];

  categories.forEach(cat => {
    const title = document.createElement('div');
    title.className = 'category-title';
    title.textContent = cat;
    container.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'menu-grid';

    menuItems.filter(i => i.category === cat).forEach(item => {
      grid.appendChild(renderMenuItem(item));
    });

    container.appendChild(grid);
  });
}

function renderMenuItem(item) {
  const div = document.createElement('div');
  div.className = 'menu-item';

  const inCart = cart.find(c => c.menu_item_id === item.id);
  const qty = inCart ? inCart.quantity : 0;

  div.innerHTML = `
    <div class="menu-item-info">
      <h3 onclick="playItemVideo(${item.id})" style="cursor:${item.video_url ? 'pointer' : 'default'}">
        ${item.name} ${item.video_url ? '🎬' : ''} ${item.model_url ? '<span onclick="event.stopPropagation(); openAR(' + item.id + ')">🕶️</span>' : ''}
      </h3>
      <p>${item.description || ''}</p>
      <span class="price">${item.price} ج.م</span>
    </div>
    <div class="qty-control">
      <button onclick="changeQty(${item.id}, -1)">−</button>
      <span id="qty-${item.id}">${qty}</span>
      <button onclick="changeQty(${item.id}, 1)">+</button>
    </div>
  `;
  return div;
}

// عرض فيديو الصنف لمدة 3 ثواني (Visual Menu)
function playItemVideo(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item || !item.video_url) return;

  const modal = document.createElement('div');
  modal.className = 'overlay';
  modal.onclick = () => modal.remove();
  modal.innerHTML = `
    <div class="sheet" style="text-align:center;">
      <video src="${item.video_url}" autoplay loop muted playsinline style="width:100%; border-radius:12px;"></video>
      <p style="margin-top:10px; font-weight:bold;">${item.name}</p>
    </div>
  `;
  document.body.appendChild(modal);
}

// عرض الطبق بالواقع المعزز (AR) — يحتاج ملف .glb مرفوع في model_url
function openAR(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item || !item.model_url) return;

  const modal = document.createElement('div');
  modal.className = 'overlay';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="sheet" style="text-align:center; height:70vh;">
      <model-viewer src="${item.model_url}" ar ar-modes="webxr scene-viewer quick-look"
        camera-controls auto-rotate style="width:100%; height:90%;"></model-viewer>
      <p style="font-weight:bold;">${item.name} — حرّك الموبايل عشان تشوفه على الترابيزة</p>
    </div>
  `;
  document.body.appendChild(modal);
}

/* ============ السلة ============ */
function changeQty(itemId, delta) {
  const item = menuItems.find(i => i.id === itemId);
  let line = cart.find(c => c.menu_item_id === itemId);

  if (!line && delta > 0) {
    line = { menu_item_id: itemId, name: item.name, price: item.price, quantity: 0 };
    cart.push(line);
  }
  if (line) {
    line.quantity = Math.max(0, line.quantity + delta);
    if (line.quantity === 0) cart = cart.filter(c => c.menu_item_id !== itemId);
  }

  document.getElementById(`qty-${itemId}`).textContent = line ? line.quantity : 0;
  updateCartBar();
}

function updateCartBar() {
  const bar = document.getElementById('cart-bar');
  const count = cart.reduce((s, c) => s + c.quantity, 0);
  const total = cart.reduce((s, c) => s + c.quantity * c.price, 0);

  if (count === 0) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  document.getElementById('cart-count').textContent = `${count} صنف`;
  document.getElementById('cart-total').textContent = `${total} ج.م`;
}

function openCart() {
  renderCartLines();
  document.getElementById('cart-overlay').classList.remove('hidden');
}
function closeCart() {
  document.getElementById('cart-overlay').classList.add('hidden');
}

function renderCartLines() {
  const container = document.getElementById('cart-lines');
  container.innerHTML = '';
  let total = 0;
  cart.forEach(c => {
    total += c.quantity * c.price;
    const line = document.createElement('div');
    line.className = 'cart-line';
    line.innerHTML = `<span>${c.name} × ${c.quantity}</span><span>${c.quantity * c.price} ج.م</span>`;
    container.appendChild(line);
  });
  const totalLine = document.createElement('div');
  totalLine.className = 'cart-line';
  totalLine.style.fontWeight = 'bold';
  totalLine.innerHTML = `<span>الإجمالي</span><span>${total} ج.م</span>`;
  container.appendChild(totalLine);
}

function selectPayment(method) {
  paymentMethod = method;
  document.getElementById('pay-online-btn').classList.toggle('selected', method === 'online');
  document.getElementById('pay-counter-btn').classList.toggle('selected', method === 'counter');
}

/* ============ الطلب الجماعي (Group Ordering) ============ */
function initGroupOrder() {
  if (!GROUP_CODE) return;
  if (!PARTICIPANT_NAME) {
    PARTICIPANT_NAME = prompt('إيه اسمك عشان نضيفك للطلب الجماعي؟') || 'ضيف';
    localStorage.setItem('participant_name', PARTICIPANT_NAME);
  }
}

// أي حد على الترابيزة يضغط عليه عشان يعمل طلب جماعي ويشارك اللينك مع صحابه
function startGroupOrder() {
  GROUP_CODE = 'G' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const link = `${window.location.origin}${window.location.pathname}?table=${TABLE_NUMBER}&group=${GROUP_CODE}`;
  const shareText = `اطلب أكلك من هنا: ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  window.history.replaceState({}, '', `?table=${TABLE_NUMBER}&group=${GROUP_CODE}`);
  initGroupOrder();
}

/* ============ تأكيد الطلب ============ */
async function submitOrder() {
  if (cart.length === 0) return alert('السلة فاضية');

  const items = cart.map(c => ({
    menu_item_id: c.menu_item_id,
    quantity: c.quantity,
    participant_name: PARTICIPANT_NAME,
  }));

  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_number: TABLE_NUMBER,
      items,
      payment_method: paymentMethod,
      group_code: GROUP_CODE,
    }),
  });
  const data = await res.json();

  if (data.error) return alert(data.error);

  currentOrderId = data.order_id;
  closeCart();
  document.getElementById('cart-bar').classList.add('hidden');
  cart = [];

  if (paymentMethod === 'online') {
    const payRes = await fetch(`${API}/payment/initiate/${currentOrderId}`, { method: 'POST' });
    const payData = await payRes.json();
    if (payData.payment_url) {
      window.location.href = payData.payment_url;
      return;
    } else {
      alert(payData.error || 'الدفع الأونلاين مش متاح دلوقتي، هيتم الدفع عند الكاشير');
    }
  }

  showOrderStatus();
}

function showOrderStatus() {
  document.getElementById('status-overlay').classList.remove('hidden');
  pollOrderStatus();
}

const statusLabels = {
  pending: 'قيد الانتظار',
  preparing: 'جاري التحضير 👨‍🍳',
  ready: 'جاهز — في الطريق ليك 🍽️',
  served: 'تم التسليم ✅',
};

async function pollOrderStatus() {
  if (!currentOrderId) return;
  const res = await fetch(`${API}/orders/${currentOrderId}`);
  const order = await res.json();

  document.getElementById('order-number-display').textContent = order.order_number;
  document.getElementById('order-status-display').textContent = statusLabels[order.status] || order.status;

  if (order.status === 'ready' && !order._askedFeedback) {
    order._askedFeedback = true;
    askFeedback();
  }

  if (order.status !== 'served') {
    setTimeout(pollOrderStatus, 4000);
  }
}

/* ============ التقييم اللحظي (Real-time Feedback) ============ */
function askFeedback() {
  const modal = document.createElement('div');
  modal.className = 'overlay';
  modal.innerHTML = `
    <div class="sheet" style="text-align:center;">
      <h2>عاجبك الأكل؟</h2>
      <div style="display:flex; justify-content:center; gap:20px; font-size:40px; margin:20px 0;">
        <span style="cursor:pointer" onclick="sendFeedback(1, this)">😠</span>
        <span style="cursor:pointer" onclick="sendFeedback(2, this)">😐</span>
        <span style="cursor:pointer" onclick="sendFeedback(3, this)">😍</span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal._el = modal;
  window._feedbackModal = modal;
}

async function sendFeedback(rating, el) {
  await fetch(`${API}/orders/${currentOrderId}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
  if (rating === 1) {
    alert('تم إبلاغ مدير الصالة، هيجيلك حالاً 🙏');
  }
  if (window._feedbackModal) window._feedbackModal.remove();
}

/* ============ زرار الخدمة (Virtual Service Bell) ============ */
async function requestService(type) {
  await fetch(`${API}/features/service-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table_number: TABLE_NUMBER, request_type: type }),
  });
  alert('تم إرسال طلبك، الويتر جاي حالاً 🙏');
}

function renderServiceBell() {
  const bell = document.createElement('div');
  bell.style.cssText = 'position:fixed; bottom:80px; left:16px; display:flex; flex-direction:column; gap:8px; z-index:15;';
  bell.innerHTML = `
    <button onclick="requestService('bill')" style="border-radius:20px; padding:10px 14px; border:none; background:#2b2b2b; color:#fff;">🧾 الشيك</button>
    <button onclick="requestService('water')" style="border-radius:20px; padding:10px 14px; border:none; background:#2b2b2b; color:#fff;">💧 مية</button>
    <button onclick="requestService('utensils')" style="border-radius:20px; padding:10px 14px; border:none; background:#2b2b2b; color:#fff;">🍴 أدوات</button>
  `;
  document.body.appendChild(bell);
}

/* ============ تشغيل الصفحة ============ */
initGroupOrder();
renderServiceBell();
loadMenu();
