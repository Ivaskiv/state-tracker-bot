import mongoose from 'mongoose';

// Оптимізована схема користувача
const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    index: true,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  username: String,
  pollFrequency: { type: String, default: 'daily' },
  pollStartTime: { type: Number, default: 9 },
  pollEndTime: { type: Number, default: 18 },
    createdAt: {
    type: Date,
    default: Date.now
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
});

// Модель користувача
const User = mongoose.model('User', userSchema);
export default User;
