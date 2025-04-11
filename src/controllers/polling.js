import { Telegraf } from 'telegraf';
import fs from 'fs';
import dotenv from 'dotenv';
import { configData } from '../config/configData.js'; // Імпортуємо ваш новий конфігураційний файл
dotenv.config();

// Створення екземпляру бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Перевірка прав адміністратора
export const isAdmin = (ctx) => configData.admins.includes(ctx.from.id); // Перевірка з configData

// Функція для створення клавіатур
export const createKeyboard = (buttons) => {
  if (!buttons || !Array.isArray(buttons)) {
    console.error('Invalid buttons format:', buttons);
    return []; // Return empty array to prevent crashes
  }
  return buttons.map(button => [{ text: button.text, callback_data: button.callback_data }]);
};

// Функція для зміни текстів в конфігурації
export const updateConfig = (key, value) => {
  const [category, keyToChange] = key.split('.');
  try {
    if (configData[category] && configData[category][keyToChange]) {
      configData[category][keyToChange] = value;

      // Зберігаємо зміни в configData.js
      const configString = `export const configData = ${JSON.stringify(configData, null, 2)};`;
      fs.writeFileSync('./config/configData.js', configString, 'utf8'); // Зберігаємо у configData.js
    } else {
      console.error(`Invalid key for configuration update: ${key}`);
      throw new Error(`Invalid key: ${key}`);
    }
  } catch (err) {
    console.error('Error updating config:', err);
    return 'Сталася помилка при оновленні конфігурації. Спробуйте ще раз.';
  }
};

// Функція для динамічного формування повідомлення
export const generateMessage = (type, key) => {
  const category = configData.pollSettings[type];
  const item = category.find(item => item.key === key);
  return item ? `${type.charAt(0).toUpperCase() + type.slice(1)}: ${item.text}` : `Невідоме ${type}`;
};

// Функція для початку опитування - ось експорт функції, якої не вистачало
export const startPoll = async (ctx) => {
  ctx.reply(configData.messages.pollStartMessage, { 
    reply_markup: {
      inline_keyboard: createKeyboard(configData.keyboard.stateButtons)
    }
  });
};

// Обробка відповіді про стан
export const handleStateResponse = async (ctx) => {
  const state = ctx.match[1];
  console.log(`State selected: ${state}`);
  console.log('Emotions buttons:', configData.keyboard.emotionButtons);
  
  const message = generateMessage('states', state);
  ctx.reply(`${message}\n\nОбер\іть вашу емоцію:`, {
    reply_markup: {
      inline_keyboard: createKeyboard(configData.keyboard.emotionButtons)
    }
  }).catch(err => {
    console.error('Error in handleStateResponse:', err);
    ctx.reply('Сталася помилка при виборі емоції. Спробуйте ще раз.');
  });
};

// Обробка відповіді про емоцію
export const handleEmotionResponse = async (ctx) => {
  const emotion = ctx.match[1];
  const message = generateMessage('emotions', emotion);
  ctx.reply(`${message}\n\nОберіть ваше відчуття:`, {
    reply_markup: {
      inline_keyboard: createKeyboard(configData.keyboard.feelingButtons)
    }
  });
};

// Обробка відповіді про відчуття
export const handleFeelingResponse = async (ctx) => {
  const feeling = ctx.match[1];
  const message = generateMessage('feelings', feeling);
  ctx.reply(`${message}\n\nЯка дія може допомогти?`, {
    reply_markup: {
      inline_keyboard: createKeyboard(configData.keyboard.actionButtons)
    }
  });
};

// Обробка відповіді про дію
export const handleActionResponse = async (ctx) => {
  const action = ctx.match[1];
  const message = generateMessage('actions', action);
  ctx.reply(`${message}\n\nДякую за вашу відповідь! Опитування завершено.`);
};

// Обробка інших повідомлень
bot.on('text', (ctx) => {
  ctx.reply(configData.messages.errorMessage); // Використовуємо повідомлення з configData
});

// Примітка: Залишаємо, але не запускаємо бота в цьому файлі, оскільки він запускається в bot.js
// bot.launch().then(() => {
//   console.log('State Tracker Bot is running...');
// });