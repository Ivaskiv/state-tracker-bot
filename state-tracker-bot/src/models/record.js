// Файл models/record.js
import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  telegramId: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  state: {
    type: String,
    required: true
  },
  emotion: {
    type: String,
    required: true
  },
  feeling: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  custom: {
    state: String,
    emotion: String,
    feeling: String,
    action: String
  }
});

// Індекс TTL для автоматичного видалення старих записів (через 90 днів)
recordSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

const Record = mongoose.model('Record', recordSchema);
export default Record;

