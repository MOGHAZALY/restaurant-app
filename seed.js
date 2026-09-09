// seed.js — بيانات تجريبية للمينو، عدّلها زي ما يناسب مطعمك
const db = require('../db');

const items = [
  { name: 'فراخ مشوية', description: 'ربع فرخة مشوية مع رز وسلطة', price: 120, category: 'مشويات', image_url: '' },
  { name: 'كباب حلة', description: 'كباب لحمة بلدي', price: 150, category: 'مشويات', image_url: '' },
  { name: 'كشري', description: 'كشري مصري بالصوص الحار', price: 45, category: 'أطباق رئيسية', image_url: '' },
  { name: 'مكرونة بشاميل', description: 'صينية مكرونة بشاميل باللحمة المفرومة', price: 65, category: 'أطباق رئيسية', image_url: '' },
  { name: 'سلطة خضرا', description: 'طماطم، خيار، فلفل، بصل', price: 20, category: 'سلطات ومقبلات', image_url: '' },
  { name: 'بطاطس محمرة', description: '', price: 25, category: 'سلطات ومقبلات', image_url: '' },
  { name: 'كوكاكولا', description: '330 مل', price: 15, category: 'مشروبات', image_url: '' },
  { name: 'عصير مانجو', description: 'طازة', price: 25, category: 'مشروبات', image_url: '' },
  { name: 'أم علي', description: 'حلو ساخن', price: 35, category: 'حلويات', image_url: '' },
];

const insert = db.prepare(`
  INSERT INTO menu_items (name, description, price, category, image_url, available)
  VALUES (@name, @description, @price, @category, @image_url, 1)
`);

const existing = db.prepare('SELECT COUNT(*) as count FROM menu_items').get();

if (existing.count === 0) {
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(items);
  console.log(`تم إضافة ${items.length} صنف للمينو بنجاح.`);
} else {
  console.log('المينو فيه بيانات بالفعل، لم يتم إضافة شيء.');
}
