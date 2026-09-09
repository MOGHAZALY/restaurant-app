// generateQR.js — يولّد QR code لكل ترابيزة في المطعم
// شغّله بالأمر: node generateQR.js
// عدّل TABLE_COUNT وFRONTEND_URL حسب مطعمك

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const TABLE_COUNT = 20; // عدد الترابيزات في المطعم — غيّره زي ما تحب
const FRONTEND_URL = process.env.MENU_URL || 'http://localhost:5500/menu.html';

const outDir = path.join(__dirname, '..', 'qrcodes');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

(async () => {
  for (let table = 1; table <= TABLE_COUNT; table++) {
    const url = `${FRONTEND_URL}?table=${table}`;
    const filePath = path.join(outDir, `table-${table}.png`);
    await QRCode.toFile(filePath, url, { width: 500, margin: 2 });
    console.log(`✅ table-${table}.png -> ${url}`);
  }
  console.log(`\nتم توليد ${TABLE_COUNT} QR code في مجلد qrcodes/`);
})();
