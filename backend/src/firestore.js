// backend/src/firestore.js
const admin = require('firebase-admin');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  // ✅ Ключ прийде у вигляді одного великого JSON-рядка з Railway
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  // локально — як файл
  serviceAccount = require('../serviceAccountKey.json');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
