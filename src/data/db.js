import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

// Завантажуємо змінні оточення
dotenv.config();

// Використовуємо змінну оточення для URI підключення
const uri = process.env.MONGODB_URI || "mongodb+srv://user3:your_password@cluster0.t68bs8l.mongodb.net/?appName=Cluster0";

// Створюємо MongoClient з параметрами для MongoDB Atlas
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Назва бази даних
const dbName = 'state_tracker_bot';

// Змінні для збереження підключення до бази та колекцій
let db;
let usersCollection;
let emotionRecordsCollection;
let dbConnected = false;

/**
 * Ініціалізує підключення до бази даних
 */
async function connectDB() {
  if (dbConnected) return { db, usersCollection, emotionRecordsCollection };
  
  try {
    // Підключаємося до MongoDB, якщо ще не підключені
    await client.connect();
    console.log("Успішне підключення до MongoDB Atlas");

    // Ініціалізуємо базу даних та колекції
    db = client.db(dbName);
    usersCollection = db.collection('users');
    emotionRecordsCollection = db.collection('emotion_records');

    // Створюємо індекси для оптимізації запитів
    await usersCollection.createIndex({ telegramId: 1 }, { unique: true });
    await emotionRecordsCollection.createIndex({ userId: 1, timestamp: 1 });
    await emotionRecordsCollection.createIndex({ state: 1 });
    await emotionRecordsCollection.createIndex({ emotion: 1 });
    await emotionRecordsCollection.createIndex({ feeling: 1 });
    await emotionRecordsCollection.createIndex({ activity: 1 });

    dbConnected = true;
    console.log("База даних ініціалізована");

    return { db, usersCollection, emotionRecordsCollection };
  } catch (error) {
    console.error("Помилка при підключенні до MongoDB:", error);
    throw error;
  }
}

/**
 * Закриває підключення до бази даних
 */
async function closeDB() {
  try {
    await client.close();
    db = null;
    usersCollection = null;
    emotionRecordsCollection = null;
    dbConnected = false;
    console.log("Підключення до MongoDB закрито");
  } catch (error) {
    console.error("Помилка при закритті підключення:", error);
  }
}

/**
 * Перевіряє стан підключення до бази даних
 */
async function checkConnection() {
  try {
    await connectDB();
    await db.command({ ping: 1 });
    return true;
  } catch (error) {
    console.error("Помилка з'єднання з MongoDB:", error);
    return false;
  }
}

// Функції для роботи з користувачами

/**
 * Створює або оновлює користувача
 * @param {Object} userData - Дані користувача
 * @returns {Object} - Створений або оновлений користувач
 */
async function saveUser(userData) {
  await connectDB();

  const { telegramId } = userData;

  const result = await usersCollection.findOneAndUpdate(
    { telegramId },
    { $set: userData },
    { upsert: true, returnDocument: 'after' }
  );

  return result.value;
}

/**
 * Отримує користувача за Telegram ID
 * @param {number} telegramId - Telegram ID користувача
 * @returns {Object|null} - Об'єкт користувача або null
 */
async function getUserByTelegramId(telegramId) {
  await connectDB();
  return await usersCollection.findOne({ telegramId });
}

/**
 * Отримує всіх користувачів
 * @param {Object} filter - Фільтр для пошуку користувачів
 * @returns {Array} - Масив користувачів
 */
async function getAllUsers(filter = {}) {
  await connectDB();
  return await usersCollection.find(filter).toArray();
}

// Функції для роботи з записами емоцій

/**
 * Зберігає запис про емоційний стан
 * @param {Object} recordData - Дані запису
 * @returns {Object} - Створений запис
 */
async function saveEmotionRecord(recordData) {
  await connectDB();

  const record = {
    ...recordData,
    timestamp: recordData.timestamp || new Date(),
    state: recordData.state,           // Додано стан
    emotion: recordData.emotion,       // Додано емоцію
    feeling: recordData.feeling,       // Додано почуття
    activity: recordData.activity      // Додано дію
  };

  const result = await emotionRecordsCollection.insertOne(record);
  return { ...record, _id: result.insertedId };
}

/**
 * Отримує записи про емоційний стан користувача
 * @param {string} userId - ID користувача
 * @param {Object} options - Опції запиту (період, сортування)
 * @returns {Array} - Масив записів
 */
async function getUserEmotionRecords(userId, options = {}) {
  await connectDB();

  const { startDate, endDate, limit = 100, sort = { timestamp: -1 } } = options;

  const query = { userId };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  return await emotionRecordsCollection
    .find(query)
    .sort(sort)
    .limit(limit)
    .toArray();
}

/**
 * Отримує агреговані дані по емоційних станах за період
 * @param {string} userId - ID користувача
 * @param {Object} options - Опції запиту (період, групування)
 * @returns {Array} - Результати агрегації
 */
async function getEmotionStats(userId, options = {}) {
  await connectDB();

  const { startDate, endDate, groupBy = 'day' } = options;

  const match = { userId };
  if (startDate || endDate) {
    match.timestamp = {};
    if (startDate) match.timestamp.$gte = new Date(startDate);
    if (endDate) match.timestamp.$lte = new Date(endDate);
  }

  let dateFormat;
  switch(groupBy) {
    case 'hour':
      dateFormat = { $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" } };
      break;
    case 'week':
      dateFormat = { $dateToString: { format: "%Y-Week%U", date: "$timestamp" } };
      break;
    case 'month':
      dateFormat = { $dateToString: { format: "%Y-%m", date: "$timestamp" } };
      break;
    case 'day':
    default:
      dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } };
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          date: dateFormat,
          state: "$state",          // Групування по стану
          emotion: "$emotion",      // Групування по емоції
          feeling: "$feeling",      // Групування по почуттю
          activity: "$activity"     // Групування по дії
        },
        count: { $sum: 1 },
        avgIntensity: { $avg: "$intensity" }
      }
    },
    {
      $sort: { "_id.date": 1 }
    }
  ];

  return await emotionRecordsCollection.aggregate(pipeline).toArray();
}

export {
  connectDB,
  closeDB,
  checkConnection,
  saveUser,
  getUserByTelegramId,
  getAllUsers,
  saveEmotionRecord,
  getUserEmotionRecords,
  getEmotionStats
};
