// Файл models/user.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  frequency: {
    type: String,
    enum: ['hourly', '2hours', 'morning_evening'],
    default: 'morning_evening'
  },
  startTime: {
    type: Number,
    default: 9,
    min: 0,
    max: 23
  },
  endTime: {
    type: Number,
    default: 21,
    min: 0,
    max: 23
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);
export default User;