import { Telegraf } from 'telegraf';
import fs from 'fs';

import config from './defaultConfig.json';

// Створення екземпляру бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Перевірка прав адміністратора
const isAdmin = (ctx) => config.admins.includes(ctx.from.id);

// Функція для створення клавіатур
const createKeyboard = (buttons) => {
  return buttons.map(button => [{ text: button.text, callback_data: button.callback_data }]);
};

// Функція для зміни текстів в конфігурації
const updateConfig = (key, value) => {
  const [category, keyToChange] = key.split('.');
  if (config[category] && config[category][keyToChange]) {
    config[category][keyToChange] = value;
    fs.writeFileSync('defaultConfig.json', JSON.stringify(config, null, 2), 'utf8');
  }
};

// Функція для динамічного формування повідомлення
const generateMessage = (type, key) => {
  const category = config.pollSettings[type];
  const item = category.find(item => item.key === key);
  return item ? `${type.charAt(0).toUpperCase() + type.slice(1)}: ${item.text}` : `Невідоме ${type}`;
};

// Привітальне повідомлення
bot.start((ctx) => {
  ctx.reply(config.messages.welcomeMessage, {
    reply_markup: {
      inline_keyboard: createKeyboard(config.keyboard.stateButtons)
    }
  });
});

// Обробка кнопок стану
bot.on('callback_query', async (ctx) => {
  const action = ctx.callbackQuery.data;

  // Якщо адміністратор хоче змінити текст повідомлення
  if (action.startsWith('changeMessage_') && isAdmin(ctx)) {
    const messageType = action.replace('changeMessage_', '');
    ctx.reply(`Введіть новий текст для: ${messageType}`, {
      reply_markup: {
        remove_keyboard: true
      }
    });
    bot.on('text', (ctx) => {
      updateConfig(messageType, ctx.message.text);
      ctx.reply(config.messages.changeMessageSuccess);
    });
  }

  // Обробка кнопок для вибору стану, емоції, відчуття, дії
  if (action.startsWith('state_')) {
    const stateKey = action.replace('state_', '');
    const message = generateMessage('states', stateKey);
    ctx.reply(message, {
      reply_markup: {
        inline_keyboard: createKeyboard(config.keyboard.emotionButtons)
      }
    });
  } else if (action.startsWith('emotion_')) {
    const emotionKey = action.replace('emotion_', '');
    const message = generateMessage('emotions', emotionKey);
    ctx.reply(message, {
      reply_markup: {
        inline_keyboard: createKeyboard(config.keyboard.feelingButtons)
      }
    });
  } else if (action.startsWith('feeling_')) {
    const feelingKey = action.replace('feeling_', '');
    const message = generateMessage('feelings', feelingKey);
    ctx.reply(message, {
      reply_markup: {
        inline_keyboard: createKeyboard(config.keyboard.actionButtons)
      }
    });
  } else if (action.startsWith('action_')) {
    const actionKey = action.replace('action_', '');
    const message = generateMessage('actions', actionKey);
    ctx.reply(message);
  }
});

// Обробка інших повідомлень
bot.on('text', (ctx) => {
  ctx.reply(config.messages.errorMessage);
});

// Запуск бота
bot.launch().then(() => {
  console.log('State Tracker Bot is running...');
});
