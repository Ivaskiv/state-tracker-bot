// models/Theme.js
import mongoose from 'mongoose';

const themeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  active: { type: Boolean, default: false },
  steps: [{
    key: String,       // Унікальний ключ кроку (замість "state", "emotion" і т.д.)
    title: String,     // Назва кроку для адміністратора
    question: String,  // Питання до користувача
    order: Number,     // Порядок відображення
    options: [{
      text: String,
      callback_data: String,
      nextStep: String // Опціонально - наступний крок (для розгалуження)
    }]
  }],
  messages: {
    welcome: String,
    mainMenu: String,
    reportDaily: String,
    reportWeekly: String
  },
  keyboard: {
    mainMenu: mongoose.Schema.Types.Mixed  // Кнопки головного меню
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Theme', themeSchema);