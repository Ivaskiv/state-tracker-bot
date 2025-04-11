import dotenv from 'dotenv';
import { configData } from './configData.js';

// Завантаження змінних середовища
dotenv.config();

// Перевірка наявності необхідних змінних середовища
if (!process.env.BOT_TOKEN || !process.env.MONGODB_URI) {
  console.error('BOT_TOKEN or MONGODB_URI environment variable is missing!');
  process.exit(1);  // Завершує процес, якщо відсутні важливі змінні середовища
}

// Конфігурація бота з файлу
const config = {
  botToken: process.env.BOT_TOKEN,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/emotion-tracker',
  
  // Налаштування з JSON файлу
  pollSettings: configData.pollSettings,
  reportSettings: configData.reportSettings,
  messages: configData.messages,
  keyboard: configData.keyboard,
  ai: configData.ai,
};

// Функція для перевірки правильності налаштувань
function validatePollSettings(settings) {
  const TYPES = {
    states: configData.pollSettings.states,
    emotions: configData.pollSettings.emotions,
    feelings: configData.pollSettings.feelings,
    actions: configData.pollSettings.actions
  };

  Object.keys(settings).forEach(key => {
    settings[key].forEach(item => {
      const validKeys = TYPES[key].map(type => type.key);
      if (!validKeys.includes(item.key)) {
        throw new Error(`Invalid ${key} key: ${item.key}`);
      }
    });
  });
}

// Валідація налаштувань для pollSettings
validatePollSettings(config.pollSettings);

export default config;
