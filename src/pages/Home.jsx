// src/pages/Home.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Вараш Таксі — сервіс для пасажирів</h1>
      <p>Щоб замовити таксі, авторизуйтесь по номеру телефону.</p>

      {/* Тільки пасажир */}
      <Link to="/passenger">
        <button>Перейти в кабінет пасажира</button>
      </Link>

      <p style={{ marginTop: 20, color: '#888' }}>
        Водії реєструються і керують статусом через наш Telegram-бот.
      </p>
    </div>
  );
}

export default Home;
