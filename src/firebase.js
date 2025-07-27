// src/firebase.js

// 1) Імпортуємо функції з SDK Firebase (версія v9 модульна)
import { initializeApp } from 'firebase/app';            // ініціалізація застосунку
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'; // авторизація по телефону
import { getFirestore } from 'firebase/firestore';       // база даних Firestore

// 2) Це твоя конфігурація Firebase (візьми саме свою)
const firebaseConfig = {
  apiKey: "AIzaSyAWIfAP4Q-XkKuz8qGzISk2nHRC37NuM8w",
  authDomain: "taxi-online-varash.firebaseapp.com",
  projectId: "taxi-online-varash",
  storageBucket: "taxi-online-varash.firebasestorage.app",
  messagingSenderId: "1003046715952",
  appId: "1:1003046715952:web:31c45185adb0406ba1a3f5",
  measurementId: "G-JK3GKWEH5M"
};

// 3) Стартуємо Firebase застосунок
const app = initializeApp(firebaseConfig);

// 4) Готуємо auth (для телефону + reCAPTCHA)
const auth = getAuth(app);

// 5) Firestore — база, куди будемо писати пасажирів
const db = getFirestore(app);

// 6) Експортуємо, щоб використати в інших файлах
export {
  app,
  auth,
  db,
  RecaptchaVerifier,
  signInWithPhoneNumber,
};
