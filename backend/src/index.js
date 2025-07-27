// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, admin } = require('./firestore');
const { bot } = require('./bot');

const app = express();
app.use(cors());
app.use(express.json());

// healthcheck
app.get('/', (_, res) => res.send('Taxi backend + Telegram Bot працює ✅'));

/**
 * POST /api/order
 * Тіло:
 * {
 *   orderId,
 *   driverId,
 *   passengerPhone,
 *   passengerName,
 *   address,
 *   comment,
 *   type: 'order' | 'booking'
 * }
 *
 * Робимо:
 * 1) Водія -> busy + currentOrderId
 * 2) Водію в TG — повідомлення з ЄДИНОЮ кнопкою "✅ Завершити поїздку"
 */
app.post('/api/order', async (req, res) => {
  try {
    const {
      orderId,
      driverId,
      passengerPhone,
      passengerName,
      address,
      comment,
      type,
    } = req.body;

    if (!orderId || !driverId || !address || !passengerPhone) {
      return res
        .status(400)
        .json({ error: 'orderId, driverId, address, passengerPhone — обовʼязкові' });
    }

    // 1) Дістаємо водія
    const driverRef = db.collection('drivers').doc(driverId);
    const driverSnap = await driverRef.get();
    if (!driverSnap.exists) {
      return res.status(404).json({ error: 'Водія не знайдено' });
    }
    const driver = driverSnap.data();

    if (!driver.telegramChatId) {
      return res.status(400).json({ error: 'У водія немає telegramChatId' });
    }

    // 2) Стаємо busy
    await driverRef.set(
      {
        status: 'busy',
        currentOrderId: orderId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 3) TG повідомлення
    const text = `
🚕 НОВЕ ${type === 'booking' ? 'БРОНЮВАННЯ' : 'ЗАМОВЛЕННЯ'}
Пасажир: ${passengerName || '-'}
Телефон: ${passengerPhone}
Адреса (ДЕ ЗАБРАТИ): ${address}
Коментар: ${comment || '-'}
`.trim();

    await bot.sendMessage(driver.telegramChatId, text, {
      reply_markup: {
        resize_keyboard: true,
        keyboard: [[{ text: '✅ Завершити поїздку' }]],
      },
    });

    // 4) Позначимо order, що “в роботі”
    await db.collection('orders').doc(orderId).set(
      {
        status: 'accepted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('/api/order error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/driver/:driverId/rate
 * {
 *   orderId,
 *   rating: 1..5,
 *   passengerPhone
 * }
 * — викликатимемо з фронта, коли пасажир оцінює водія
 * Тут же перерахуємо середній рейтинг водія (avgRating/ratingsCount) і збережемо в документі drivers/{driverId}
 */
app.post('/api/driver/:driverId/rate', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { orderId, rating, passengerPhone } = req.body;

    const r = Number(rating);
    if (!driverId || !orderId || !passengerPhone || !(r >= 1 && r <= 5)) {
      return res.status(400).json({ error: 'Bad payload' });
    }

    const ratingsCol = db.collection('driverRatings').doc(driverId).collection('ratings');
    await ratingsCol.doc(orderId).set({
      rating: r,
      passengerPhone,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // перерахуємо середнє
    const all = await ratingsCol.get();
    let sum = 0;
    all.forEach((d) => (sum += d.data().rating || 0));
    const avg = all.size ? sum / all.size : 0;

    await db.collection('drivers').doc(driverId).set(
      {
        avgRating: avg,
        ratingsCount: all.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ ok: true, avgRating: avg, ratingsCount: all.size });
  } catch (err) {
    console.error('/api/driver/:driverId/rate error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`✅ Backend запущено: http://localhost:${PORT}`);
});
