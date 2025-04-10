// Файл config.js
import dotenv from 'dotenv';

// Завантаження змінних середовища
dotenv.config();

// Конфігурація бота
const config = {
  // Основні налаштування
  botToken: process.env.BOT_TOKEN || '',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/emotion-tracker',
  
  // Налаштування опитувань
  pollSettings: {
    defaultFrequency: 'morning_evening',
    defaultStartTime: 9,
    defaultEndTime: 21,
    
    // Варіанти для опитувань
    states: [
      { key: 'resourceful', text: 'Ресурсний' },
      { key: 'neutral', text: 'Нейтральний' },
      { key: 'tense', text: 'Напружений' },
      { key: 'exhausted', text: 'Виснажений' },
      { key: 'anxious', text: 'Тривожний' },
      { key: 'panic', text: 'Панічний' }
    ],
    
    emotions: [
      { key: 'joy', text: 'Радість' },
      { key: 'anger', text: 'Гнів' },
      { key: 'calm', text: 'Спокій' },
      { key: 'sadness', text: 'Сум' },
      { key: 'fear', text: 'Страх' },
      { key: 'gratitude', text: 'Вдячність' }
    ],
    
    feelings: [
      { key: 'love', text: 'Любов' },
      { key: 'guilt', text: 'Провина' },
      { key: 'loneliness', text: 'Самотність' },
      { key: 'acceptance', text: 'Прийняття' },
      { key: 'shame', text: 'Сором' },
      { key: 'hope', text: 'Надія' }
    ],
    
    actions: [
      { key: 'work', text: 'Працював(ла)' },
      { key: 'eating', text: 'Їв(ла)' },
      { key: 'social_media', text: 'Був(ла) в соцмережах' },
      { key: 'communication', text: 'Спілкувався(лась)' },
      { key: 'exercise', text: 'Рухався(лась) / спорт' },
      { key: 'rest', text: 'Відпочивав(ла)' }
    ]
  },
  
  // Налаштування звітів
  reportSettings: {
    maxDaysInWeeklyReport: 7,
    minRecordsForAnalysis: 3
  }
};

export default config;