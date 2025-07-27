import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
} from 'firebase/firestore';

import PhoneAuth from '../components/PhoneAuth';

const TELEGRAM_BOT_LINK = 'https://t.me/varash_taxi_driver_bot'; // заміни на свій бот
const phoneToId = (p) => (p || '').replace(/\D/g, '');
const BACKEND_URL = 'http://localhost:5001';


function PassengerDashboard() {
  const [isVerified, setIsVerified] = useState(localStorage.getItem('passengerVerified') === 'true');
  const [phone, setPhone] = useState(localStorage.getItem('passengerPhone') || '');
  const [loading, setLoading] = useState(false);
  const [passenger, setPassenger] = useState(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [addressHistory, setAddressHistory] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [comment, setComment] = useState(''); // ← ДОДАЛИ! коментар до замовлення


  // Завантаження даних
  useEffect(() => {
    if (isVerified && phone) {
      loadPassenger(phone);
      loadDrivers();
    }
  }, [isVerified, phone]);

  // Завантажуємо профіль пасажира
  const loadPassenger = async (rawPhone) => {
    setLoading(true);
    try {
      const id = phoneToId(rawPhone);
      const ref = doc(db, 'passengers', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setPassenger({ id, ...data });
        setName(data.name || '');
        setAddressHistory(data.addressHistory || []);
      } else {
        await setDoc(ref, {
          phone: rawPhone,
          name: '',
          addressHistory: [],
          createdAt: serverTimestamp(),
        });
        setPassenger({ id, phone: rawPhone, name: '', addressHistory: [] });
      }
    } catch (err) {
      console.error(err);
      alert('Помилка завантаження профілю пасажира');
    } finally {
      setLoading(false);
    }
  };

  // Зберігає імʼя, коли користувач вводить його
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (passenger && name !== passenger.name) {
        try {
          const ref = doc(db, 'passengers', passenger.id);
          await updateDoc(ref, { name, updatedAt: serverTimestamp() });
          setPassenger((prev) => ({ ...prev, name }));
        } catch (err) {
          console.error(err);
        }
      }
    }, 500); // затримка, щоб не зберігати кожен символ миттєво
    return () => clearTimeout(timeout);
  }, [name]);
  
  //Автооновлення списку водіїв (кожні 5 секунд)
    useEffect(() => {
    if (!isVerified || !phone) return;
    const interval = setInterval(() => {
      loadDrivers();
    }, 5000); // кожні 5 секунд
    return () => clearInterval(interval);
  }, [isVerified, phone]);


  // Зберігає адресу в історію при Enter
  const handleAddressEnter = async (e) => {
    if (e.key === 'Enter' && address.trim()) {
      const newHistory = [address, ...addressHistory.filter((a) => a !== address)].slice(0, 5);
      setAddressHistory(newHistory);
      setAddress('');

      try {
        const ref = doc(db, 'passengers', passenger.id);
        await updateDoc(ref, { addressHistory: newHistory, updatedAt: serverTimestamp() });
      } catch (err) {
        console.error(err);
      }
    }
  };

const handleOrder = async (driver) => {
  if (!address.trim()) return alert('Спочатку введіть адресу!');
  try {
    const type = driver.status === 'online' ? 'order' : 'booking';

    // 1) Створимо orderId тут і будемо передавати його й у бекенд
    const orderId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 2) Запишемо замовлення в Firestore
    await setDoc(doc(db, 'orders', orderId), {
      status: 'pending',            // pending | accepted | finished | canceled
      type,                         // order | booking
      driverId: driver.id,
      driverPhone: driver.phone || null,
      passengerPhone: phone,
      passengerName: passenger?.name || '',
      address,
      comment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 3) Попросимо бекенд: відправити водію повідомлення в TG + зробити його busy
    await fetch(`${BACKEND_URL}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,                    // <-- ВАЖЛИВО
        driverId: driver.id,
        passengerPhone: phone,
        passengerName: passenger?.name || '',
        address,
        comment,
        type,
      }),
    });
    // локально помітимо цього водія як busy (жовтий), щоб UI змінився одразу
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driver.id ? { ...d, status: 'busy', currentOrderId: orderId } : d
      )
    );

    alert(
      type === 'order'
        ? 'Замовлення створено! Водій уже зайнятий і отримав повідомлення.'
        : 'Бронювання створено! Водій уже зайнятий і отримав повідомлення.'
    );

    // (опційно) — одразу підтягнути свіже
    // await loadDrivers();

  } catch (err) {
    console.error(err);
    alert('Не вдалося створити замовлення');
  }
};



  // Завантаження списку водіїв
  const loadDrivers = async () => {
    try {
      const snap = await getDocs(collection(db, 'drivers'));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      const order = { online: 1, busy: 2, offline: 3 };
      list.sort((a, b) => (order[a.status] || 99) - (order[b.status] || 99));
      setDrivers(list);
    } catch (err) {
      console.error(err);
    }
  };

  // Вихід
  const handleLogout = () => {
    localStorage.removeItem('passengerVerified');
    localStorage.removeItem('passengerPhone');
    window.location.reload();
  };

  if (!isVerified) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Кабінет пасажира</h2>
        <PhoneAuth onVerified={(verifiedPhone) => {
          setIsVerified(true);
          setPhone(verifiedPhone);
          localStorage.setItem('passengerVerified', 'true');
          localStorage.setItem('passengerPhone', verifiedPhone);
        }} label="Вхід за телефоном" />
      </div>
    );
  }

  if (loading) return <p style={{ padding: 20 }}>Завантажую...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Кабінет пасажира</h2>
      <p><b>Телефон:</b> {passenger?.phone || phone}</p>

      <div style={{ marginBottom: 20 }}>
        <label>Ваше імʼя:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введіть імʼя"
          style={{ marginLeft: 10, padding: 4 }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Де вас забрати?</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={handleAddressEnter}
          placeholder="Введіть адресу та натисніть Enter"
          style={{ marginLeft: 10, padding: 4 }}
        />
        {addressHistory.length > 0 && (
          <ul>
            {addressHistory.map((addr, idx) => (
              <li
                key={idx}
                onClick={() => setAddress(addr)}
                style={{ cursor: 'pointer', listStyle: 'none', margin: '5px 0' }}
              >
                {addr}
              </li>
            ))}
          </ul>
        )}
      </div>

{/* === Список водіїв з фото та кнопками === */}
<div style={{ marginTop: 20 }}>
  <h3>Доступні водії</h3>

  {drivers.length === 0 ? (
    <div style={{ padding: 12, background: '#f9f9f9', borderRadius: 6 }}>
      <p style={{ margin: 0 }}>
        Водіїв поки немає. Ви можете стати першим водієм —
        <a href={TELEGRAM_BOT_LINK} target="_blank" rel="noreferrer"> відкрийте наш Telegram-бот</a>.
      </p>
    </div>
  ) : (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      {drivers.map((d) => {
        const isOnline = d.status === 'online';
        const isBusy = d.status === 'busy';
        const isOffline = d.status === 'offline';

        return (
          <div
            key={d.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {/* Фото авто */}
            <div style={{ width: '100%', height: 140, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              {d.photoUrl ? (
                <img
                  src={d.photoUrl}
                  alt={d.carBrand || 'auto'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ padding: 8, color: '#888' }}>Без фото</div>
              )}
            </div>

            {/* Дані */}
            <div style={{ fontWeight: 'bold' }}>{d.name || '—'}</div>
            <div>{d.carBrand || '—'} ({d.carPlate || '—'})</div>

            <div>
              Статус:{' '}
              <span style={{ color: isOnline ? 'green' : isBusy ? 'orange' : 'red' }}>
                {isOnline ? '🟢 online' : isBusy ? '🟡 busy' : '🔴 offline'}
              </span>
            </div>

            {/* Кнопки */}
            {isOnline && (
              <button onClick={() => handleOrder(d)} style={{ marginTop: 'auto' }}>
                Замовити
              </button>
            )}

            {isBusy && (
              <button onClick={() => handleOrder(d)} style={{ marginTop: 'auto' }}>
                Забронювати
              </button>
            )}

            {isOffline && (
              <button disabled style={{ marginTop: 'auto', opacity: 0.6 }}>
                Недоступний
              </button>
            )}
          </div>
        );
      })}
    </div>
  )}
</div>


      <button
        onClick={handleLogout}
        style={{ marginTop: 20, background: '#ff4d4f', color: '#fff', padding: '5px 10px' }}
      >
        Вийти з кабінету
      </button>
    </div>
  );
}

export default PassengerDashboard;
