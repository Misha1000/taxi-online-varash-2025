// backend/src/firestore.js
const admin = require('firebase-admin');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  // ✅ Ключ приходить у вигляді JSON-рядка (наприклад, на Railway або Render)
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  try {
    // 🔧 Локально: читаємо з файлу
    serviceAccount = require('../serviceAccountKey.json');
  } catch (error) {
    console.error('❌ Помилка: не знайдено serviceAccountKey.json і не передано FIREBASE_SERVICE_ACCOUNT_JSON');
    process.exit(1); // зупинити сервер
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
