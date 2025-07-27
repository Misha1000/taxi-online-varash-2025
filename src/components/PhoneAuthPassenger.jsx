// src/components/PhoneAuthPassenger.jsx

// 1) Імпортуємо React та хуки — useState, useEffect, useRef
import React, { useState, useEffect, useRef } from 'react';

// 2) Імпортуємо з нашого firebase.js усе, що потрібно для входу по телефону
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '../firebase';

// 3) ОГОЛОШУЄМО КОМПОНЕНТ. Він приймає onVerified — функцію, яку викличемо після успішного підтвердження
function PhoneAuthPassenger({ onVerified }) {
  // 4) Стан для телефону пасажира
  const [phone, setPhone] = useState('');
  // 5) Стан для коду з SMS
  const [code, setCode] = useState('');
  // 6) Чи вже відправили SMS (щоб показати поле вводу коду)
  const [smsSent, setSmsSent] = useState(false);
  // 7) Тут збережемо confirmationResult (щоб потім підтвердити код)
  const confirmationResultRef = useRef(null);

  // 8) Створюємо reCAPTCHA один раз при монтуванні
  useEffect(() => {
    // 9) Якщо reCAPTCHA вже створена — нічого не робимо
    if (window.recaptchaVerifierPassenger) return;

    // 10) Створюємо reCAPTCHA (інвизібл)
    window.recaptchaVerifierPassenger = new RecaptchaVerifier(
      auth,                            // ← перший аргумент — auth
      'recaptcha-container-passenger', // ← ID div у DOM, куди “привʼяжеться” reCAPTCHA
      { size: 'invisible' }            // ← робимо її невидимою
    );

    // 11) ОБОВ’ЯЗКОВО зробити render(), інакше буде auth/argument-error
    window.recaptchaVerifierPassenger.render().catch(console.error);
  }, []);

  // 12) Відправка SMS з кодом
  const handleSendCode = async (e) => {
    e.preventDefault();

    try {
      // 13) Беремо reCAPTCHA
      const appVerifier = window.recaptchaVerifierPassenger;

      // 14) Формуємо номер у форматі +380...
      const fullPhone = phone.startsWith('+') ? phone : `+${phone}`;

      // 15) Надсилаємо SMS через Firebase
      const confirmationResult = await signInWithPhoneNumber(auth, fullPhone, appVerifier);

      // 16) Зберігаємо confirmationResult у ref, щоб потім підтвердити код
      confirmationResultRef.current = confirmationResult;

      // 17) Переходимо на крок “введення коду”
      setSmsSent(true);
      alert('SMS надіслано! Введіть код із повідомлення.');
    } catch (err) {
      // 18) Якщо сталася помилка, повідомляємо
      console.error(err);
      alert('Помилка надсилання SMS: ' + err.message);

      // 19) Скидаємо reCAPTCHA, щоб можна було повторити
      try {
        window.recaptchaVerifierPassenger.clear();
      } catch (_) {}
      window.recaptchaVerifierPassenger = null;
    }
  };

  // 20) Підтвердження коду з SMS
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    try {
      // 21) Використовуємо confirmationResult, який зберігали раніше
      const result = await confirmationResultRef.current.confirm(code);

      // 22) Отримуємо користувача (там є підтверджений номер)
      const user = result.user;

      // 23) Записуємо у localStorage, що пасажир підтверджений
      localStorage.setItem('passengerVerified', 'true');
      localStorage.setItem('passengerPhone', user.phoneNumber);

      // 24) Викликаємо onVerified, щоб перейти до форми
      onVerified(user.phoneNumber);
    } catch (err) {
      console.error(err);
      alert('Невірний код або строк дії минув. Спробуйте ще раз.');
      // 25) Скидаємо на перший крок
      setSmsSent(false);
      setCode('');
    }
  };

  // 26) Розмітка компонента
  return (
    <div style={{ maxWidth: 320, margin: '0 auto' }}>
      <h3>Авторизація пасажира (через Firebase SMS)</h3>

      {/* 27) Тут має бути контейнер для reCAPTCHA (обов’язково в DOM) */}
      <div id="recaptcha-container-passenger" />

      {/* 28) Показуємо форму телефону, якщо SMS ще не відправлено */}
      {!smsSent ? (
        <form onSubmit={handleSendCode}>
          <input
            type="tel"
            placeholder="+380XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginBottom: 10 }}
          />
          <button type="submit">Надіслати код</button>
        </form>
      ) : (
        // 29) Якщо SMS відправлено — просимо ввести код
        <form onSubmit={handleVerifyCode}>
          <input
            type="text"
            placeholder="Код із SMS"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginBottom: 10 }}
          />
          <button type="submit">Підтвердити</button>
        </form>
      )}
    </div>
  );
}

// 30) ЕКСПОРТУЄМО КОМПОНЕНТ ЯК DEFAULT
export default PhoneAuthPassenger;
