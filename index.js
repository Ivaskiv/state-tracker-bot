// index.js
import { bot } from './src/bot.js';
import dotenv from 'dotenv';

// Завантаження змінних середовища
dotenv.config();

// Перевірка наявності ключів API перед запуском
if (!process.env.TELEGRAM_TOKEN || !process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('Одна або кілька змінних середовища відсутні або неправильні:');
  if (!process.env.TELEGRAM_TOKEN) console.error('TELEGRAM_TOKEN не визначено.');
  if (!process.env.AIRTABLE_API_KEY) console.error('AIRTABLE_API_KEY не визначено.');
  if (!process.env.AIRTABLE_BASE_ID) console.error('AIRTABLE_BASE_ID не визначено.');
  process.exit(1); // Завершує процес, якщо змінні відсутні
}

bot.launch()
  .then(() => {
    console.log('Бот запущено через index.js!');
  })
  .catch(err => console.error('Помилка запуску бота:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));