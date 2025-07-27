// src/bot.js

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { db, admin } = require('./firestore');

// 1) Стартуємо бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// 2) Утиліти
const normalizePhone = (p) => (p || '').replace(/\D/g, '');
const session = {}; // простеньке збереження станів для діалогу { [chatId]: { step, data } }
const rateSession = {}; // { [chatId]: { orderId, passengerPhone } } — коли водій оцінює пасажира


// 3) Допоміжні функції роботи з Firestore
async function getPhotoUrl(fileId) {
  // node-telegram-bot-api має метод getFileLink
  const link = await bot.getFileLink(fileId);
  return link; // це прямий URL до фото на серверах Telegram
}
async function getDriverByChatId(chatId) {
  const snap = await db
    .collection('drivers')
    .where('telegramChatId', '==', String(chatId))
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function getDriverByPhone(phone) {
  const id = normalizePhone(phone);
  const ref = db.collection('drivers').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { id, ...snap.data() };
}

async function saveDriverByPhone(phone, data) {
  const id = normalizePhone(phone);

  if (!id) {
    console.error('[saveDriverByPhone] EMPTY ID! phone =', phone, 'data =', data);
    throw new Error('Invalid phone/id');
  }

  console.log('[saveDriverByPhone] writing doc drivers/' + id);

  const ref = db.collection('drivers').doc(id);
  await ref.set(
    {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  const snap = await ref.get();
  return { id, ...snap.data() };
}


// 4) Головне меню
function showMainMenu(chatId, text = 'Головне меню') {
  bot.sendMessage(chatId, text, {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [{ text: '📞 Зареєструватися / оновити дані' }],
        [{ text: '🟢 Я онлайн' }, { text: '🔴 Завершити сеанс' }],
        [{ text: 'ℹ️ Мій статус' }],
      ],
    },
  });
}


// 5) Старт
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  showMainMenu(chatId, 'Привіт! Це бот водія Вараш Таксі 🚕');
});

// 6) Обробка кнопок
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  // Якщо йде реєстрація і користувач надсилає фото авто
  if (session[chatId]?.step === 'ask_photo' && msg.photo && msg.photo.length) {
    return handleDriverPhoto(msg);
  }

  // Якщо користувач надіслав контакт (кнопка "Поділитися номером")
  if (msg.contact?.phone_number) {
    return handlePhoneShared(chatId, msg.contact.phone_number);
  }

  // Якщо ми послідовно питаємо поля у водія
  if (session[chatId]?.step) {
    return continueRegistration(msg);
  }
// якщо водій зараз у процесі оцінки пасажира
if (rateSession[chatId]) {
  const rate = Number(text);
  if (!Number.isInteger(rate) || rate < 1 || rate > 5) {
    return bot.sendMessage(chatId, 'Будь ласка, оцініть від 1 до 5.');
  }

  const { orderId, passengerPhone } = rateSession[chatId];
  delete rateSession[chatId];

  try {
    // збережемо оцінку пасажира
    await db
      .collection('passengerRatings')
      .doc(passengerPhone.replace(/\D/g, ''))
      .collection('ratings')
      .doc(orderId)
      .set({
        rating: rate,
        driverPhone: (await getDriverByChatId(chatId))?.phone || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    await bot.sendMessage(chatId, 'Дякуємо! Оцінку збережено.');
    return showMainMenu(chatId);
  } catch (err) {
    console.error('save passenger rating error', err);
    await bot.sendMessage(chatId, 'Не вдалося зберегти оцінку. Спробуйте пізніше.');
    return showMainMenu(chatId);
  }
}

  // Головне меню
  switch (text) {
    case '📞 Зареєструватися / оновити дані':
      return startRegistration(chatId);

    case '🟢 Я онлайн':
      return goOnline(chatId);

    case '✅ Завершити поїздку':
      return finishOrder(chatId);

    case '🔴 Завершити сеанс':
      return goOffline(chatId);

    case 'ℹ️ Мій статус':
      return showStatus(chatId);

    case '✅ Завершити замовлення':
      return finishOrder(chatId);

    default:
      // ігноруємо інший текст
      break;
  }
});

// 7) Реєстрація — старт
async function startRegistration(chatId) {
  session[chatId] = { step: 'ask_phone', data: {} };

  return bot.sendMessage(
    chatId,
    'Надішліть ваш номер телефону (поділіться через кнопку або введіть вручну у форматі +380...)',
    {
      reply_markup: {
        resize_keyboard: true,
        one_time_keyboard: true,
        keyboard: [
          [{ text: 'Поділитися номером', request_contact: true }],
          [{ text: '⬅️ Скасувати' }],
        ],
      },
    }
  );
}

// 8) Користувач натиснув “поділитися номером”
async function handlePhoneShared(chatId, phone_number) {
  if (!session[chatId]) {
    // якщо немає сесії — почнемо самі
    session[chatId] = { step: 'ask_phone', data: {} };
  }
  session[chatId].data.phone = phone_number;
  return askName(chatId);
}

// 9) Продовження реєстрації (коли ми в якомусь кроці і користувач шле текст)
async function continueRegistration(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const s = session[chatId];

  if (text === '⬅️ Скасувати') {
    delete session[chatId];
    return showMainMenu(chatId, 'Скасовано.');
  }

  switch (s.step) {
    case 'ask_phone':
      // користувач ввів номер вручну
      s.data.phone = text;
      return askName(chatId);

    case 'ask_name':
      s.data.name = text;
      return askCarBrand(chatId);

    case 'ask_brand':
      s.data.carBrand = text;
      return askCarPlate(chatId);

    case 'ask_plate':
      s.data.carPlate = text;
      return askPhoto(chatId);

    default:
      // якщо щось не так — скинемо
      delete session[chatId];
      return showMainMenu(chatId, 'Щось пішло не так. Почнімо спочатку.');
  }
}

// 10) Питання: ім’я
function askName(chatId) {
  session[chatId].step = 'ask_name';
  bot.sendMessage(chatId, 'Введіть ваше імʼя:');
}

// 11) Питання: марка авто
function askCarBrand(chatId) {
  session[chatId].step = 'ask_brand';
  bot.sendMessage(chatId, 'Введіть марку та модель авто (наприклад, Skoda Octavia):');
}

// 12) Питання: номер авто
function askCarPlate(chatId) {
  session[chatId].step = 'ask_plate';
  bot.sendMessage(chatId, 'Введіть державний номер авто (наприклад, AA1234BB):');
}

// 13) Питання: фото авто
function askPhoto(chatId) {
  session[chatId].step = 'ask_photo';
  bot.sendMessage(chatId, 'Надішліть фото вашого автомобіля (одним фото).');
}

// 14) Користувач надіслав фото авто
// 14) Користувач надіслав фото авто
async function handleDriverPhoto(msg) {
  const chatId = msg.chat.id;
  const s = session[chatId];

  try {
    if (!s || s.step !== 'ask_photo') {
      console.warn('[handleDriverPhoto] step mismatch or no session', { chatId, s });
      return;
    }

    if (!msg.photo || !msg.photo.length) {
      await bot.sendMessage(chatId, 'Будь ласка, пришліть саме фото.');
      return;
    }

    const fileId = msg.photo[msg.photo.length - 1].file_id;

    const phone = s.data.phone;
    const normPhone = normalizePhone(phone);
    if (!phone || !normPhone) {
      console.error('[handleDriverPhoto] phone missing or invalid', { phone, normPhone, chatId, s });
      await bot.sendMessage(chatId, 'Телефон не визначено або неправильний. Почніть реєстрацію заново.');
      delete session[chatId];
      return showMainMenu(chatId, 'Спробуйте ще раз «📞 Зареєструватися / оновити дані».');
    }

    // ОТРИМАЄМО ПРЯМИЙ URL
    const photoUrl = await getPhotoUrl(fileId);

    console.log('[handleDriverPhoto] saving driver', {
      phone,
      normPhone,
      chatId,
      name: s.data.name,
      carBrand: s.data.carBrand,
      carPlate: s.data.carPlate,
      fileId,
      photoUrl,
    });

    await saveDriverByPhone(phone, {
      phone,
      telegramChatId: String(chatId),
      name: s.data.name,
      carBrand: s.data.carBrand,
      carPlate: s.data.carPlate,
      photoFileId: fileId,
      photoUrl,              // <-- ТЕПЕР ЗБЕРІГАЄМО URL
      status: 'offline',
    });

    delete session[chatId];

    await bot.sendMessage(chatId, '✅ Реєстрація завершена! Тепер ви можете ставати онлайн і приймати замовлення.');
    showMainMenu(chatId);
  } catch (err) {
    console.error('[handleDriverPhoto] error:', err);
    await bot.sendMessage(chatId, 'Сталася помилка при збереженні. Спробуйте ще раз.');
  }
}

async function finishOrder(chatId) {
  try {
    const driver = await getDriverByChatId(chatId);
    if (!driver) {
      return showMainMenu(chatId, 'Спершу зареєструйтесь.');
    }

    const orderId = driver.currentOrderId;
    if (!orderId) {
      // не було активного — просто вертаємо online
      await saveDriverByPhone(driver.phone || driver.id, {
        status: 'online',
        currentOrderId: null,
        telegramChatId: String(chatId),
      });
      await bot.sendMessage(chatId, 'Статус: 🟢 online');
      return showMainMenu(chatId);
    }

    // знайдемо замовлення
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      // все одно звільним водія
      await saveDriverByPhone(driver.phone || driver.id, {
        status: 'online',
        currentOrderId: null,
        telegramChatId: String(chatId),
      });
      await bot.sendMessage(chatId, 'Замовлення не знайдено, але ви вже 🟢 online');
      return showMainMenu(chatId);
    }

    const order = orderSnap.data();

    // позначаємо завершеним
    await orderRef.set(
      {
        status: 'finished',
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // водія назад online
    await saveDriverByPhone(driver.phone || driver.id, {
      status: 'online',
      currentOrderId: null,
      telegramChatId: String(chatId),
    });

    // тепер попросимо оцінку пасажира
    rateSession[chatId] = {
      orderId,
      passengerPhone: order.passengerPhone,
    };

    await bot.sendMessage(chatId, '✅ Поїздку завершено. Оцініть пасажира (1–5):', {
      reply_markup: {
        resize_keyboard: true,
        one_time_keyboard: true,
        keyboard: [['1', '2', '3', '4', '5']],
      },
    });
  } catch (err) {
    console.error('finishOrder error', err);
    bot.sendMessage(chatId, 'Сталася помилка при завершенні замовлення.');
  }
}




// 15) Стати онлайн
async function goOnline(chatId) {
  try {
    const driver = await getDriverByChatId(chatId);
    if (!driver) {
      return showMainMenu(chatId, 'Спершу зареєструйтесь.');
    }

    await saveDriverByPhone(driver.phone || driver.id, {
      status: 'online',
      onlineFrom: new Date().toISOString(),
      onlineUntil: null,
      telegramChatId: String(chatId),
    });

    await bot.sendMessage(chatId, '🟢 Ви онлайн');
    showMainMenu(chatId);
  } catch (err) {
    console.error('goOnline error', err);
    bot.sendMessage(chatId, 'Не вдалося перейти в онлайн.');
  }
}


// 16) Завершити сеанс (офлайн)
async function goOffline(chatId) {
  try {
    const driver = await getDriverByChatId(chatId);
    if (!driver) {
      return showMainMenu(chatId, 'Спершу зареєструйтесь.');
    }

    await saveDriverByPhone(driver.phone || driver.id, {
      status: 'offline',
      onlineFrom: null,
      onlineUntil: null,
      telegramChatId: String(chatId),
    });

    bot.sendMessage(chatId, '🔴 Ви офлайн');
    showMainMenu(chatId);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, 'Не вдалося перейти в офлайн.');
  }
}

// 17) Показати статус
async function showStatus(chatId) {
  try {
    const driver = await getDriverByChatId(chatId);
    if (!driver) {
      return showMainMenu(chatId, 'Спершу зареєструйтесь.');
    }

    const from = driver.onlineFrom ? new Date(driver.onlineFrom) : null;
    const until = driver.onlineUntil ? new Date(driver.onlineUntil) : null;

    const text = `
Ваші дані:
Ім'я: ${driver.name || '-'}
Телефон: ${driver.phone || '-'}
Авто: ${driver.carBrand || '-'}
Номер авто: ${driver.carPlate || '-'}
Статус: ${driver.status || '-'}
Онлайн з: ${from ? from.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
Онлайн до: ${until ? until.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
Фото (Telegram file_id): ${driver.photoFileId || '-'}
    `.trim();

    bot.sendMessage(chatId, text);
    showMainMenu(chatId);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, 'Не вдалося отримати статус.');
  }
}

module.exports = { bot };
