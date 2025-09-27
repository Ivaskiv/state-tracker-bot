// src/controllers/handlers/startHandler.js — швидкий онбординг + trial
import keyboards from '../../utils/keyboards.js';
import {
  ensureUserRow,
  getUserByTelegramId,
  setName, setEmail, setPhone, setTimezone,
  markRegistered,
  activateTrial,
  hasActiveAccess
} from '../../auth/services/userService.js';

// прості валідатори
const isValidName = (s = '') => s.trim().length >= 2 && s.trim().length <= 30;
const isValidEmail = (s = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
const isValidPhone = (s = '') => /^[+0-9()\-\s]{6,20}$/.test(String(s).trim());

const askName = async (ctx, currentName = '') => {
  if (!currentName) {
    await ctx.reply(
      `Давай познайомимось — як до тебе звертатись?\n\nВведи ім’я (2–30 символів).`
    );
    ctx.session.step = 'ob_name';
  } else {
    await ctx.reply(
      `Твоє імʼя в записі: <b>${currentName}</b>.\nЗалишаємо його чи змінюємо?`,
      { parse_mode: 'HTML', ...keyboards.confirmNameKeyboard(currentName) }
    );
    ctx.session.step = 'ob_name_confirm';
  }
};

const askEmail = async (ctx) => {
  await ctx.reply(
    `Вкажи свій e-mail (для надсилання звітів).\nАбо пропусти.`,
    keyboards.emailInputKeyboard()
  );
  ctx.session.step = 'ob_email';
};

const askPhone = async (ctx) => {
  await ctx.reply(
    `Залиш номер телефону (для звʼязку в разі питань).\nАбо пропусти.`,
    keyboards.phoneInputKeyboard()
  );
  ctx.session.step = 'ob_phone';
};

const askTimezone = async (ctx) => {
  await ctx.reply(
    `Обери свій часовий пояс. Це важливо: я надсилатиму ранкові питання о <b>08:00 за твоїм місцевим часом</b>.`,
    { parse_mode: 'HTML', ...keyboards.timezoneKeyboard() }
  );
  ctx.session.step = 'ob_timezone';
};

const showPlans = async (ctx) => {
  await ctx.reply(
    `Обери план доступу.\nМожеш почати з безкоштовного пробного тижня.`,
    keyboards.subscriptionPlansKeyboard()
  );
  ctx.session.step = 'ob_plan';
};

const sendWelcomeBack = async (ctx, user) => {
  const name = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  const end = user?.End_Date ? new Date(user.End_Date).toLocaleDateString('uk-UA') : null;
  const statusLine = end ? `✅ Активна до ${end}` : (user?.['Active_Subscription_Status'] || '✅ Активна');

  await ctx.reply(
    `👋 Раді бачити знову, ${name}!\n\n${statusLine}\n\nПродовжимо твій розвиток? 🚀`,
    keyboards.mainMenuKeyboard()
  );
};

const startHandler = {
  // /start
  async handle(ctx) {
    const tgId = String(ctx.from.id);
    const name = ctx.from.first_name || 'Користувач';
    console.log(`🚀 [/start] from=${tgId} (${name})`);

    // 1) гарантуємо рядок у Users
    const user = await ensureUserRow(tgId);

    // 2) якщо є активний доступ — одразу тепле вітання + меню
    if (hasActiveAccess(user)) {
      await sendWelcomeBack(ctx, user);
      ctx.session.step = undefined;
      return;
    }

    // 3) інакше запускаємо онбординг (з імʼям)
    await askName(ctx, user['User Name']);
  },

  // текстові відповіді під час онбордингу
  async handleText(ctx) {
    const tgId = String(ctx.from.id);
    const text = (ctx.message?.text || '').trim();
    const step = ctx.session?.step;

    if (!step) return false; // не онбординг

    if (step === 'ob_name') {
      if (!isValidName(text)) {
        await ctx.reply('Імʼя має бути від 2 до 30 символів. Введи ще раз.');
        return true;
      }
      await setName(tgId, text);
      await askEmail(ctx);
      return true;
    }

    if (step === 'ob_email') {
      if (text && !isValidEmail(text)) {
        await ctx.reply('Схоже, email некоректний. Введи інший або натисни «Пропустити e-mail».',
          keyboards.emailInputKeyboard()
        );
        return true;
      }
      if (text) await setEmail(tgId, text);
      await askPhone(ctx);
      return true;
    }

    if (step === 'ob_phone') {
      if (text && !isValidPhone(text)) {
        await ctx.reply('Виглядає як некоректний номер. Введи інший або натисни «Пропустити телефон».',
          keyboards.phoneInputKeyboard()
        );
        return true;
      }
      if (text) await setPhone(tgId, text);
      await askTimezone(ctx);
      return true;
    }

    // інші кроки — тільки callback
    return false;
  },

  // callback-и онбордингу (підтвердження імені, скіпи, вибір tz, планів)
  async handleCallback(ctx) {
    const tgId = String(ctx.from.id);
    const data = ctx.callbackQuery?.data || '';

    // підтвердження/зміна імені
    if (data === 'keep_name') {
      await askEmail(ctx);
      return true;
    }
    if (data === 'change_name') {
      await ctx.reply('Введи нове імʼя (2–30 символів).');
      ctx.session.step = 'ob_name';
      return true;
    }

    // скіпи
    if (data === 'skip_email') {
      await askPhone(ctx);
      return true;
    }
    if (data === 'skip_phone') {
      await askTimezone(ctx);
      return true;
    }

    // таймзона
    if (data.startsWith('tz_')) {
      const tz = data.slice(3); // tz_Europe/Prague → Europe/Prague
      await setTimezone(tgId, tz);
      await markRegistered(tgId); // помічаємо як зареєстровану
      await ctx.reply(`Часовий пояс збережено: <b>${tz}</b>`, { parse_mode: 'HTML' });
      await showPlans(ctx);
      return true;
    }

    // плани
    if (data === 'plan_free' || data === 'activate_trial') {
      const updated = await activateTrial(tgId, 7);
      const end = updated?.End_Date ? new Date(updated.End_Date).toLocaleDateString('uk-UA') : '7 днів';
      await ctx.reply(
        `🎉 Пробний доступ активовано!\nДіє до: <b>${end}</b>`,
        { parse_mode: 'HTML' }
      );

      // показуємо головне меню
      const fresh = await getUserByTelegramId(tgId);
      await sendWelcomeBack(ctx, fresh || updated);
      ctx.session.step = undefined;
      return true;
    }

    // інші плани — можеш підʼєднати платіжку, тут просто відкриваємо меню
    if (['plan_week','plan_month','plan_year'].includes(data)) {
      await ctx.reply('Цей план потребує оплати. Зв’яжись з підтримкою або обери «План тиждень» після оплати.');
      return true;
    }

    return false;
  }
};

export default startHandler;
