// src/components/ResetAllButton.jsx

// 1) Імпортуємо React і хук useState — щоб показувати статус процесу (йде чи ні)
import React, { useState } from 'react';

// 2) Імпортуємо нашу базу даних (Firestore)
import { db } from '../firebase';

// 3) Імпортуємо потрібні функції з Firestore для читання та видалення документів
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// 4) Створюємо змінну з переліком колекцій, які будемо чистити
//    Можеш додавати тут інші колекції, якщо їх створиш (наприклад, 'passengers')
const COLLECTIONS_TO_WIPE = ['drivers', 'orders'];

// 5) Це простий пароль, щоб випадково ніхто не натиснув і не видалив усе
//    ПОМІНЯЙ ЙОГО НА СВІЙ
const ADMIN_PASSWORD = '123456';

// 6) Оголошуємо React-компонент кнопки
function ResetAllButton() {
  // 7) Статус — чи ми зараз видаляємо (щоб заблокувати кнопку)
  const [isWiping, setIsWiping] = useState(false);

  // 8) Текстовий статус (що зараз робиться)
  const [status, setStatus] = useState('');

  // 9) Основна функція, яка викликається при кліку на кнопку
  const handleWipeAll = async () => {
    // 10) Питаємо пароль у користувача (простий prompt)
    const pwd = prompt('Введіть адмін-пароль, щоб видалити всі дані:');

    // 11) Якщо пароль не збігається — просто виходимо
    if (pwd !== ADMIN_PASSWORD) {
      alert('Невірний пароль. Операція скасована.');
      return;
    }

    // 12) Ставимо прапорець — почали видалення
    setIsWiping(true);
    setStatus('Починаю видалення даних з Firestore...');

    try {
      // 13) Для кожної колекції з нашого списку — видалимо всі документи
      for (const colName of COLLECTIONS_TO_WIPE) {
        setStatus(`Видаляю колекцію: ${colName}...`);

        // 14) Отримуємо посилання на колекцію
        const colRef = collection(db, colName);

        // 15) Читаємо всі документи в колекції
        const snapshot = await getDocs(colRef);

        // 16) Проходимося по кожному документу і видаляємо його
        for (const d of snapshot.docs) {
          // 17) Створюємо посилання на конкретний документ
          const docRef = doc(db, colName, d.id);

          // 18) Видаляємо документ з БД
          await deleteDoc(docRef);
        }
      }

      // 19) Після чистки Firestore — чистимо localStorage (телефони, історію адрес і т.д.)
      setStatus('Очищаю localStorage...');
      localStorage.removeItem('driverVerified');
      localStorage.removeItem('driverPhone');
      localStorage.removeItem('driverData');

      localStorage.removeItem('passengerVerified');
      localStorage.removeItem('passengerPhone');
      localStorage.removeItem('passengerName');
      localStorage.removeItem('passengerHistory');

      // 20) Все готово — повідомляємо
      setStatus('Готово! Все видалено.');
      alert('Усі дані видалено успішно!');
    } catch (err) {
      // 21) Якщо щось пішло не так — показуємо помилку в консолі та на екрані
      console.error(err);
      setStatus('Сталася помилка при видаленні. Дивись консоль.');
      alert('Помилка при видаленні. Перевір консоль.');
    } finally {
      // 22) Знімаємо прапорець — завершили
      setIsWiping(false);
    }
  };

  // 23) Рендеримо кнопку і статус
  return (
    <div style={{ marginTop: 20 }}>
      {/* 24) Кнопка для очищення всього. Вона блокується, коли йде процес */}
      <button onClick={handleWipeAll} disabled={isWiping}>
        {isWiping ? 'Видаляю...' : '🧨 СКИНУТИ ВСЕ (адмін)'}
      </button>

      {/* 25) Якщо є статус — показуємо його */}
      {status && <p style={{ fontSize: 14, color: '#555' }}>{status}</p>}
    </div>
  );
}

// 26) Експортуємо компонент за замовчуванням
export default ResetAllButton;
