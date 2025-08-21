// src/controllers/botController.js
import userService from '../services/userService.js';
import reflectionService from '../services/reflectionService.js';
import affirmationService from '../services/affirmationService.js';
import subscriptionService from '../services/subscriptionService.js';
import keyboards from '../utils/keyboards.js';

export default function botController(bot) {
  // START
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Користувач';
    let user = await userService.getUserByTelegramId(tgId);

    if (!user) {
      ctx.session.step = 'reg_name';
      ctx.session.temp = {};
      return ctx.reply(`🌟 Вітаю в AI-Coach! Як тебе звати?`, keyboards.skipKeyboard());
    }

    return ctx.reply(profileMessage(user), keyboards.mainMenuKeyboard());
  });

  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const tgId = ctx.from.id;

    // registration flow
    if (ctx.session.step === 'reg_name') {
      ctx.session.temp.name = text.trim();
      ctx.session.step = 'reg_email';
      return ctx.reply('Вкажи свій email або натисни «Пропустити»:', keyboards.skipKeyboard());
    }

    if (ctx.session.step === 'reg_email') {
      ctx.session.temp.email = text.trim();
      ctx.session.step = 'reg_phone';
      return ctx.reply('Вкажи номер у форматі +380XXXXXXXXX або натисни «Пропустити»:', keyboards.skipKeyboard());
    }

    if (ctx.session.step === 'reg_phone') {
      const phone = text.trim();
      const newUser = await userService.handleStart({
        tgId,
        name: ctx.session.temp.name
      });
      ctx.session.step = null;
      ctx.session.temp = {};
      return ctx.reply(profileMessage({ fields: newUser.user }), keyboards.mainMenuKeyboard());
    }

    // Обробка меню та щоденних питань
    if (text === '📝 Ранкові питання') {
      await reflectionService.startDailyQuestions(bot, tgId, 'morning');
      return;
    }

    if (text === '🌙 Вечірні питання') {
      await reflectionService.startDailyQuestions(bot, tgId, 'evening');
      return;
    }

    if (text === '💎 Афірмація') {
      const aff = await affirmationService.getAffirmationAndMarkUsed();
      return ctx.reply(`🌀 Афірмація:\n${aff}`);
    }
  });
}

// профіль користувача
function profileMessage(user) {
  const name = user.fields['User Name'] || 'Користувач';
  const tg = user.fields['TG_id'];
  const active = user.fields['Active_Subscription_Status'] || '❌ Немає активної підписки';
  const plan = user.fields['Active Subscription Plan'] || '—';
  const start = user.fields['Start_Date'] ? new Date(user.fields['Start_Date']).toLocaleDateString('uk-UA') : '—';
  const end = user.fields['End_Date'] ? new Date(user.fields['End_Date']).toLocaleDateString('uk-UA') : '—';

  return `📊 ПРОФІЛЬ

👤 Ім'я: ${name}
🆔 ID: ${tg}

📦 ПІДПИСКА:
${active.includes('✅') ? `${active}
📋 План: ${plan}
🚀 Початок: ${start}
📅 Діє до: ${end}` : '❌ Неактивна'}`;
}
