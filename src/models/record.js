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

// Додаткові індекси для оптимізації запитів
recordSchema.index({ userId: 1 });
recordSchema.index({ telegramId: 1 });
recordSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });  // TTL для автоматичного видалення

const Record = mongoose.model('Record', recordSchema);
export default Record;
