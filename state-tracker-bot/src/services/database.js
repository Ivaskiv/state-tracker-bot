// Файл services/database.js
import mongoose from 'mongoose';
import User from '../models/user.js';
import Record from '../models/record.js';

// Підключення до бази даних
async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    // Ініціалізація індексів
    await setupIndices();
    
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    return false;
  }
}

// Налаштування індексів
async function setupIndices() {
  try {
    // Переконуємося, що індекс TTL для записів існує
    await Record.collection.createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 7776000 } // 90 днів
    );
    
    console.log('Indices set up successfully');
  } catch (err) {
    console.error('Error setting up indices:', err);
  }
}

// Створення нового користувача
async function createUser(userData) {
  try {
    const user = new User(userData);
    await user.save();
    return user;
  } catch (err) {
    console.error('Error creating user:', err);
    throw err;
  }
}

// Отримання користувача за telegramId
async function getUser(telegramId) {
  try {
    return await User.findOne({ telegramId });
  } catch (err) {
    console.error('Error getting user:', err);
    return null;
  }
}

// Оновлення налаштувань користувача
async function updateUser(telegramId, updates) {
  try {
    const user = await User.findOneAndUpdate(
      { telegramId },
      { $set: updates },
      { new: true }
    );
    return user;
  } catch (err) {
    console.error('Error updating user:', err);
    throw err;
  }
}

// Створення нового запису
async function createRecord(recordData) {
  try {
    const record = new Record(recordData);
    await record.save();
    return record;
  } catch (err) {
    console.error('Error creating record:', err);
    throw err;
  }
}

// Отримання записів за період
async function getRecords(telegramId, startDate, endDate) {
  try {
    return await Record.find({
      telegramId,
      timestamp: { 
        $gte: startDate, 
        $lt: endDate || new Date() 
      }
    }).sort({ timestamp: 1 });
  } catch (err) {
    console.error('Error getting records:', err);
    return [];
  }
}

// Експорт функцій
export {
  connectDatabase,
  createUser,
  getUser,
  updateUser,
  createRecord,
  getRecords
};