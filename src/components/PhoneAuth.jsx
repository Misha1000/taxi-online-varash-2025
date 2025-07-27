// src/components/PhoneAuth.jsx

// 1) Імпортуємо React, хуки
import React, { useState, useEffect, useRef } from 'react';

// 2) Імпортуємо з нашого firebase.js усе, що потрібно для входу по телефону
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '../firebase';

// 3) Компонент приймає onVerified — викликається, коли номер підтверджено
function PhoneAuth({ onVerified, label = 'Підтвердження телефону' }) {
  // 4) Стан для телефону
  const [phone, setPhone] = useState('');
  // 5) Стан для коду з SMS
  const [code, setCode] = useState('');
  // 6) Чи вже надіслали SMS (щоб показати поле для коду)
  const [smsSent, setSmsSent] = useState(false);
  // 7) Стан завантаження (щоб блокувати кнопки)
  const [loading, setLoading] = useState(false);
  // 8) Сховище для confirmationResult (щоб підтвердити код)
  const confirmationResultRef = useRef(null);

  // 9) Створюємо reCAPTCHA один раз, коли компонент монтується
  useEffect(() => {
    // якщо вже є — нічого не робимо
    if (window.recaptchaVerifier) return;

    // створюємо reCAPTCHA, вона рендериться у контейнер з id="recaptcha-container"
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible', // невидима — користувач її не бачить
      callback: (response) => {
        // спрацьовує, коли reCAPTCHA пройшла успішно
      },
    });
  }, []);

  // 10) Відправити код (SMS)
  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 11) Беремо reCAPTCHA
      const appVerifier = window.recaptchaVerifier;

      // 12) Формуємо номер у форматі +380...
      const fullPhone = phone.startsWith('+') ? phone : `+${phone}`;

      // 13) Firebase відправляє SMS
      const confirmationResult = await signInWithPhoneNumber(auth, fullPhone, appVerifier);

      // 14) Зберігаємо для підтвердження
      confirmationResultRef.current = confirmationResult;

      // 15) Переходимо до кроку введення коду
      setSmsSent(true);
      alert('SMS надіслано! Введіть код з повідомлення.');
    } catch (err) {
      console.error(err);
      alert('Помилка надсилання SMS: ' + err.message);
      // 16) Скидаємо reCAPTCHA, щоб можна було спробувати ще раз
      window.recaptchaVerifier?.clear();
      window.recaptchaVerifier = null;
    } finally {
      setLoading(false);
    }
  };

  // 17) Підтвердити код
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 18) Підтверджуємо код
      const result = await confirmationResultRef.current.confirm(code);
      const user = result.user;

      // 19) Запам’ятовуємо в localStorage
      localStorage.setItem('passengerVerified', 'true');
      localStorage.setItem('passengerPhone', user.phoneNumber);

      // 20) Викликаємо onVerified, передаємо номер
      onVerified(user.phoneNumber);
    } catch (err) {
      console.error(err);
      alert('Невірний код. Спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '0 auto' }}>
      <h3>{label}</h3>

      {/* 21) Контейнер для reCAPTCHA (обов’язково має бути в DOM) */}
      <div id="recaptcha-container" />

      {!smsSent ? (
        // 22) КРОК 1 — вводимо телефон
        <form onSubmit={handleSendCode}>
          <input
            type="tel"
            placeholder="+380XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginBottom: 10 }}
          />
          <button type="submit" disabled={loading}>
          {loading ? 'Надсилаю...' : 'Надіслати код'}
          </button>
        </form>
      ) : (
        // 23) КРОК 2 — вводимо код
        <form onSubmit={handleVerifyCode}>
          <input
            type="text"
            placeholder="Код із SMS"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginBottom: 10 }}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Перевіряю...' : 'Підтвердити'}
          </button>
        </form>
      )}
    </div>
  );
}

export default PhoneAuth;
