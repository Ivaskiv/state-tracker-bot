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
    throw new Error('Database connection failed');
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
    throw new Error('Failed to set up indices');
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
    throw new Error('Failed to create user');
  }
}

// Отримання користувача за telegramId
async function getUser(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (err) {
    console.error('Error getting user:', err);
    throw new Error('Failed to retrieve user');
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
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (err) {
    console.error('Error updating user:', err);
    throw new Error('Failed to update user');
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
    throw new Error('Failed to create record');
  }
}

// Отримання записів за період
async function getRecords(telegramId, startDate, endDate) {
  try {
    const query = { telegramId, timestamp: { $gte: startDate } };
    if (endDate) query.timestamp.$lt = endDate;
    const records = await Record.find(query).sort({ timestamp: 1 });
    return records;
  } catch (err) {
    console.error('Error getting records:', err);
    throw new Error('Failed to retrieve records');
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
