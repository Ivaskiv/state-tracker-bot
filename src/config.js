//config.js
import dotenv from 'dotenv';

// Завантаження змінних середовища
dotenv.config();

// Перевірка наявності необхідних змінних середовища
if (!process.env.BOT_TOKEN || !process.env.MONGODB_URI) {
  console.error('BOT_TOKEN or MONGODB_URI environment variable is missing!');
  process.exit(1);  // Завершує процес, якщо відсутні важливі змінні середовища
}

// Константи для опитувань
const STATES = [
  { key: 'resourceful', text: 'Ресурсний' },
  { key: 'neutral', text: 'Нейтральний' },
  { key: 'tense', text: 'Напружений' },
  { key: 'exhausted', text: 'Виснажений' },
  { key: 'anxious', text: 'Тривожний' },
  { key: 'panic', text: 'Панічний' }
];

const EMOTIONS = [
  { key: 'joy', text: 'Радість' },
  { key: 'anger', text: 'Гнів' },
  { key: 'calm', text: 'Спокій' },
  { key: 'sadness', text: 'Сум' },
  { key: 'fear', text: 'Страх' },
  { key: 'gratitude', text: 'Вдячність' }
];

const FEELINGS = [
  { key: 'love', text: 'Любов' },
  { key: 'guilt', text: 'Провина' },
  { key: 'loneliness', text: 'Самотність' },
  { key: 'acceptance', text: 'Прийняття' },
  { key: 'shame', text: 'Сором' },
  { key: 'hope', text: 'Надія' }
];

const ACTIONS = [
  { key: 'work', text: 'Працював(ла)' },
  { key: 'eating', text: 'Їв(ла)' },
  { key: 'social_media', text: 'Був(ла) в соцмережах' },
  { key: 'communication', text: 'Спілкувався(лась)' },
  { key: 'exercise', text: 'Рухався(лась) / спорт' },
  { key: 'rest', text: 'Відпочивав(ла)' }
];

// Конфігурація бота
const config = {
  // Основні налаштування
  botToken: process.env.BOT_TOKEN,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/emotion-tracker',
  
  // Налаштування опитувань
  pollSettings: {
    defaultFrequency: 'morning_evening',
    defaultStartTime: 9,
    defaultEndTime: 21,
    states: STATES,
    emotions: EMOTIONS,
    feelings: FEELINGS,
    actions: ACTIONS
  },
  
  // Налаштування звітів
  reportSettings: {
    maxDaysInWeeklyReport: 7,
    minRecordsForAnalysis: 3
  }
};

// Функція для перевірки правильності налаштувань
function validatePollSettings(settings) {
  const validStateKeys = STATES.map(state => state.key);
  const validEmotionKeys = EMOTIONS.map(emotion => emotion.key);
  const validFeelingKeys = FEELINGS.map(feeling => feeling.key);
  const validActionKeys = ACTIONS.map(action => action.key);

  settings.states.forEach(state => {
    if (!validStateKeys.includes(state.key)) {
      throw new Error(`Invalid state key: ${state.key}`);
    }
  });

  settings.emotions.forEach(emotion => {
    if (!validEmotionKeys.includes(emotion.key)) {
      throw new Error(`Invalid emotion key: ${emotion.key}`);
    }
  });

  settings.feelings.forEach(feeling => {
    if (!validFeelingKeys.includes(feeling.key)) {
      throw new Error(`Invalid feeling key: ${feeling.key}`);
    }
  });

  settings.actions.forEach(action => {
    if (!validActionKeys.includes(action.key)) {
      throw new Error(`Invalid action key: ${action.key}`);
    }
  });
}

// Валідація налаштувань для pollSettings
validatePollSettings(config.pollSettings);

export default config;
