// handlers/commandHandler.js
import reflectionService from '../services/reflectionService.js';
import  userService  from '../services/userService.js';
import * as KEYBOARDS from '../utils/keyboards.js';

export const commandHandler = {
  async showProfile(ctx) {
    try {
      const userId = ctx.from.id;
      const user = await userService.findUser(userId);

      if (!user) {
        await ctx.reply('Користувач не знайдений. Почніть з команди /start');
        return;
      }

      const subscription = await userService.getActiveSubscription(user);
      const stats = await reflectionService.getReflectionStats(userId, 30);

      const profileMessage = `👤 Твій профіль

📝 Ім'я: ${user.name}
📞 Телефон: ${user.phone || 'не вказано'}
📧 Email: ${user.email || 'не вказано'}
📅 Реєстрація: ${new Date(user.created_at).toLocaleDateString('uk-UA')}

📊 Статистика за 30 днів:
• Всього рефлексій: ${stats.total}
• Ранкових: ${stats.morning}
• Вечірніх: ${stats.evening}
• Поточна серія: ${stats.streak} днів
• Рівень завершення: ${stats.completion_rate}%

💳 Підписка: ${subscription ? 
  `Активна до ${new Date(subscription.expires_at).toLocaleDateString('uk-UA')}` : 
  'Немає активної підписки'}`;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(profileMessage, KEYBOARDS.MAIN_MENU);
      } else {
        await ctx.reply(profileMessage, KEYBOARDS.MAIN_MENU);
      }
    } catch (error) {
      console.error('Show profile error:', error);
      await ctx.reply('Помилка при завантаженні профілю.');
    }
  },

  async getHelp(ctx) {
    try {
      const helpMessage = `🆘 Довідка по боту

🌅 Ранкова рефлексія (08:00) - 6 питань для фокусу на цілях та налаштування на день
🌙 Вечірня рефлексія (20:30) - 5 питань для аналізу дня та фіксації перемог

✨ Швидка підтримка: "+" або "ок" для отримання афірмації

📊 Аналітика:
• Щотижневий звіт (неділя, 19:00)
• Щомісячний звіт (1-го числа, 12:00)

⚙️ Команди:
/start - головне меню
/profile - твій профіль  
/help - довідка
/support - підтримка

💡 Поради:
• Відповідай щиро
• Не пропускай рефлексії  
• Використовуй афірмації щодня
• Пиши про свої емоції

Питання? Натисни "Підтримка" 👇`;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(helpMessage, KEYBOARDS.BACK_TO_MENU);
      } else {
        await ctx.reply(helpMessage, KEYBOARDS.MAIN_MENU);
      }
    } catch (error) {
      console.error('Get help error:', error);
      await ctx.reply('Помилка при завантаженні довідки.');
    }
  },

  async getSupport(ctx) {
    try {
      const supportMessage = `🆘 Підтримка

Маєш питання або потребуєш допомоги? 

📧 Email: nadyastarway@gmail.com
💬 Опиши свою проблему, і ми зв'яжемося з тобою

⚡ Швидка допомога:
• Напиши свої емоції - отримаєш підтримку
• "+" або "ок" - миттєва афірмація
• /help - повна інструкція`;

      const supportKeyboard = {
        inline_keyboard: [
          [{ text: '📧 Написати в підтримку', url: 'mailto:nadyastarway@gmail.com' }],
          [{ text: '✨ Отримати афірмацію', callback_data: 'affirmation' }],
          [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
        ]
      };

      if (ctx.callbackQuery) {
        await ctx.editMessageText(supportMessage, { reply_markup: supportKeyboard });
      } else {
        await ctx.reply(supportMessage, { reply_markup: supportKeyboard });
      }
    } catch (error) {
      console.error('Get support error:', error);
      await ctx.reply('Помилка при завантаженні інформації про підтримку.');
    }
  },

  async showMainMenu(ctx) {
    try {
      const menuMessage = `🏠 Головне меню

Оберіть дію:`;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(menuMessage, KEYBOARDS.MAIN_MENU);
      } else {
        await ctx.reply(menuMessage, KEYBOARDS.MAIN_MENU);
      }
    } catch (error) {
      console.error('Show main menu error:', error);
      await ctx.reply('Помилка при завантаженні меню.');
    }
  }
};

export default commandHandler;