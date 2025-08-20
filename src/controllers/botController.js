// src/controllers/botController.js
import keyboards from '../utils/keyboards.js';
import userService from '../services/userService.js';
import subscriptionService from '../services/subscriptionService.js';
import reflectionService from '../services/reflectionService.js';
import affirmationService from '../services/affirmationService.js';

function profileMessage(user) {
  const name = user.fields['User Name'] || 'Користувач';
  const tg = user.fields['TG_id'];
  const reg = user.fields['DateUserRegistered'] ? new Date(user.fields['DateUserRegistered']).toLocaleDateString('uk-UA') : '—';
  const active = user.fields['Active_Subscription_Status'] || '❌ Немає активної підписки';
  const plan = user.fields['Active Subscription Plan'] || '—';
  const start = user.fields['Start_Date'] ? new Date(user.fields['Start_Date']).toLocaleDateString('uk-UA') : '—';
  const end = user.fields['End_Date'] ? new Date(user.fields['End_Date']).toLocaleDateString('uk-UA') : '—';

  return `📊 ТВІЙ ПРОФІЛЬ

👤 Ім'я: ${name}
🆔 ID: ${tg}
📅 Реєстрація: ${reg}

📦 ПІДПИСКА:
${active.includes('✅') ? `${active}
📋 План: ${plan}
🚀 Початок: ${start}
📅 Діє до: ${end}` : '❌ Неактивна'}

📝 Реєстраційні дані: ${user.fields['UserRegistered'] ? '✅ Заповнені' : '❌ Не заповнені'}`;
}

export default function botController(bot) {
  // START
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Користувач';
    let user = await userService.getUserByTelegramId(tgId);

    if (!user) {
      // реєстрація
      ctx.session.step = 'reg_name';
      return ctx.reply(
`🌟 Вітаю в AI-Coach!

🔹 Ранком (08:00) — 6 питань для фокусу
🔹 Ввечері (20:30) — 5 питань для аналізу
🔹 Щотижневі/щомісячні звіти
🔹 Афірмації

Як тебе звати?`, keyboards.skipKeyboard());
    }

    return ctx.reply(profileMessage(user), keyboards.mainMenuKeyboard());
  });

  // ТЕКСТ
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const tgId = ctx.from.id;

    // якщо триває діалог із питаннями — обробляє reflectionService
    const flow = await (async () => {
      const { questionType, step } = await (await reflectionService).handleIncomingText?.name ? {} : {};
      return { questionType, step };
    })();

    // registration flow
    if (ctx.session.step === 'reg_name') {
      if (text === '⏭️ Пропустити' || !text || text.trim().length < 2) {
        return ctx.reply('Вкажи, будь ласка, імʼя (мінімум 2 символи) або введи своє реальне імʼя:');
      }
      ctx.session.temp.name = text.trim();
      ctx.session.step = 'reg_email';
      return ctx.reply('Вкажи свій email або натисни «Пропустити»:', keyboards.skipKeyboard());
    }

    if (ctx.session.step === 'reg_email') {
      if (text !== '⏭️ Пропустити') {
        const r = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!r.test(text.trim())) {
          return ctx.reply('Некоректний email. Спробуй ще раз або натисни «Пропустити».');
        }
        ctx.session.temp.email = text.trim();
      } else {
        ctx.session.temp.email = '';
      }
      ctx.session.step = 'reg_phone';
      return ctx.reply('Вкажи номер у форматі +380XXXXXXXXX або натисни «Пропустити»:', keyboards.skipKeyboard());
    }

    if (ctx.session.step === 'reg_phone') {
      let phone = '';
      if (text !== '⏭️ Пропустити') {
        const p = /^\+380\d{9}$/;
        if (!p.test(text.replace(/\s/g, ''))) {
          return ctx.reply('Некоректний номер. Використай формат +380XXXXXXXXX або натисни «Пропустити».');
        }
        phone = text.replace(/\s/g, '');
      }
      const user = await userService.createUser({
        tgId,
        name: ctx.session.temp.name,
        email: ctx.session.temp.email || '',
        phone
      });
      ctx.session.step = null;
      ctx.session.temp = {};
      return ctx.reply(profileMessage(user), keyboards.mainMenuKeyboard());
    }

    // Меню
    if (text === '📝 Ранкові питання') {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) return ctx.reply('Спочатку пройди реєстрацію: /start');
      const active = await userService.hasActiveSubscription(tgId);
      if (!active) return ctx.reply('❌ У тебе немає активної підписки.', keyboards.mainMenuKeyboard());
      const already = await reflectionService.alreadyAnsweredToday(tgId, 'morning');
      if (already) return ctx.reply('✅ Ти вже відповіла на ранкові питання сьогодні.');
      await reflectionService.startDailyQuestions(bot, tgId, 'morning');
      return;
    }

    if (text === '🌙 Вечірні питання') {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) return ctx.reply('Спочатку пройди реєстрацію: /start');
      const active = await userService.hasActiveSubscription(tgId);
      if (!active) return ctx.reply('❌ У тебе немає активної підписки.', keyboards.mainMenuKeyboard());
      const already = await reflectionService.alreadyAnsweredToday(tgId, 'evening');
      if (already) return ctx.reply('✅ Ти вже відповіла на вечірні питання сьогодні.');
      await reflectionService.startDailyQuestions(bot, tgId, 'evening');
      return;
    }

    if (text === '📊 Мій прогрес') {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) return ctx.reply('Спочатку пройди реєстрацію: /start');

      // дуже простий дашборд зі статусом підписки
      return ctx.reply(profileMessage(user));
    }

    if (text === '💎 Афірмація') {
      const aff = await affirmationService.getAffirmationAndMarkUsed();
      return ctx.reply(`🌀 Афірмація:\n${aff}`);
    }

    if (text === '💰 Підписка') {
      return ctx.reply('Оберіть план:', keyboards.subscriptionKeyboard());
    }

    if (text === '❓ Допомога') {
      return ctx.reply(
`❓ ДОПОМОГА

🔹 Ранкові питання — 08:00
🔹 Вечірні питання — 20:30
🔹 Звіти — щонеділі та в кінці місяця

Пиши "+" або "ок", щоб отримати коротку афірмацію.`,
        keyboards.mainMenuKeyboard()
      );
    }

    if (text === '+' || text.toLowerCase() === 'ок' || text.toLowerCase() === 'ok') {
      const aff = await affirmationService.getAffirmationAndMarkUsed();
      return ctx.reply(`✨ ${aff}`);
    }

    // якщо це не команда меню — спробуємо обробити як відповідь у потоці запитань
    await reflectionService.handleIncomingText(bot, ctx);
  });

  // CALLBACKS (підписка демо)
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data === 'main_menu') {
      await ctx.editMessageText('Головне меню', keyboards.mainMenuKeyboard());
      return ctx.answerCbQuery();
    }

    if (data.startsWith('subscribe_')) {
      const plan = data.replace('subscribe_', '');
      const plans = {
        week: { name: 'Тиждень фокусу', days: 7 },
        month: { name: 'Місяць дії', days: 30 },
        year: { name: 'Рік трансформації', days: 365 }
      };
      const sel = plans[plan];
      await ctx.editMessageText(`Ти обрала: ${sel.name}\n(Демо) Активуємо...`);
      setTimeout(async () => {
        await subscriptionService.activateDemoSubscription(ctx.from.id, sel.name, sel.days);
        await ctx.telegram.sendMessage(ctx.from.id, `🎉 Підписка «${sel.name}» активована!`, keyboards.mainMenuKeyboard());
      }, 1500);
      return ctx.answerCbQuery();
    }

    return ctx.answerCbQuery();
  });
}
