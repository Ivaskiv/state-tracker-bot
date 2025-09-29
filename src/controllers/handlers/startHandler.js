// src/controllers/handlers/startHandler.js — ВИПРАВЛЕНО
import keyboards from '../../utils/keyboards.js';
import userService from '../../auth/services/userService.js';
import paymentService from '../../auth/services/paymentService.js';
import { 
  isSkip, 
  isValidEmail, 
  isValidUaPhone, 
  isValidName, 
  formatPhone, 
  formatEmail, 
  formatName 
} from '../../utils/validators.js';
import { TIMEZONES, parseTz } from '../../config/constants.js';

const askName = async (ctx, currentName = '') => {
  if (!currentName) {
    await ctx.reply(
      `Давай познайомимось — як до тебе звертатись?\n\nВведи ім'я (2–30 символів).`
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
    `⚠️ ВАЖЛИВО: Обери свій часовий пояс!\n\nЯ надсилатиму ранкові питання о <b>08:00 за твоїм місцевим часом</b>.\n\n🌍 Твій часовий пояс:`,
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
  const statusLine = user?.['Active_Subscription_Status'] || '✅ Активна';

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

    try {
      // 1) Перевіряємо чи користувач існує
      let user = await userService.getUserByTelegramId(tgId);
      
      // 2) ✅ ЯКЩО КОРИСТУВАЧА НЕМАЄ - СТВОРЮЄМО ОДРАЗУ
      if (!user) {
        console.log(`[startHandler] 🆕 СТВОРЮЄМО нового користувача ${tgId}`);
        
        user = await userService.createUser({
          tgId: tgId,
          name: name,
          timezone: 'Europe/Kyiv'
        });
        
        console.log(`[startHandler] ✅ Користувач створений: ${user ? 'так' : 'ні'}`);
      }

      // 3) якщо є активний доступ — одразу тепле вітання + меню
      if (userService.hasActiveAccess(user) && user.UserRegistered) {
        await sendWelcomeBack(ctx, user);
        ctx.session.step = undefined;
        return;
      }

      // 4) інакше запускаємо онбординг (з імʼям)
      await askName(ctx, user['User Name']);
    } catch (error) {
      console.error('[startHandler.handle] ❌ Помилка:', error);
      await ctx.reply('Виникла помилка при ініціалізації. Спробуй ще раз /start');
    }
  },

  // текстові відповіді під час онбордингу
  async handleText(ctx) {
    const tgId = String(ctx.from.id);
    const text = (ctx.message?.text || '').trim();
    const step = ctx.session?.step;

    if (!step) return false; // не онбординг

    try {
      if (step === 'ob_name') {
        if (!isValidName(text)) {
          await ctx.reply('Імʼя має бути від 2 до 50 символів. Введи ще раз.');
          return true;
        }
        
        // ✅ ОНОВЛЮЄМО ІСНУЮЧИЙ ЗАПИС
        await userService.updateUser(tgId, { 'User Name': formatName(text) });
        await askEmail(ctx);
        return true;
      }

      if (step === 'ob_email') {
        if (isSkip(text)) {
          await askPhone(ctx);
          return true;
        }
        
        if (text && !isValidEmail(text)) {
          await ctx.reply('Схоже, email некоректний. Введи інший або натисни «⏭️ Пропустити».',
            keyboards.emailInputKeyboard()
          );
          return true;
        }
        
        if (text) {
          // ✅ ОНОВЛЮЄМО ІСНУЮЧИЙ ЗАПИС
          await userService.updateUser(tgId, { Email: formatEmail(text) });
        }
        await askPhone(ctx);
        return true;
      }

      if (step === 'ob_phone') {
        if (isSkip(text)) {
          await askTimezone(ctx);
          return true;
        }
        
        const formattedPhone = formatPhone(text);
        if (text && !isValidUaPhone(formattedPhone)) {
          await ctx.reply('Виглядає як некоректний номер телефону. Введи у форматі +380XXXXXXXXX або натисни «⏭️ Пропустити».',
            keyboards.phoneInputKeyboard()
          );
          return true;
        }
        
        if (text) {
          // ✅ ОНОВЛЮЄМО ІСНУЮЧИЙ ЗАПИС
          await userService.updateUser(tgId, { Phone: formattedPhone });
        }
        await askTimezone(ctx);
        return true;
      }

      // інші кроки — тільки callback
      return false;
    } catch (error) {
      console.error('[startHandler.handleText] ❌ Помилка:', error);
      await ctx.reply('Виникла помилка. Спробуй ще раз або натисни кнопку пропустити.');
      return true;
    }
  },

  // callback-и онбордингу
  async handleCallback(ctx) {
    const tgId = String(ctx.from.id);
    const data = ctx.callbackQuery?.data || '';

    try {
      // підтвердження/зміна імені
      if (data === 'keep_name') {
        await askEmail(ctx);
        return true;
      }
      if (data === 'change_name') {
        await ctx.reply('Введи нове імʼя (2–50 символів).');
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
        const selectedTz = data.slice(3); // tz_Europe/Prague → Europe/Prague
        
        // Знаходимо повний лейбл для збереження в Airtable
        const fullLabel = TIMEZONES.find(tz => parseTz(tz) === selectedTz) || `${selectedTz} (UTC+0)`;
        
        // ✅ ЗАВЕРШУЄМО РЕЄСТРАЦІЮ
        await userService.updateUser(tgId, { 
          'Time Zone': fullLabel,
          UserRegistered: true,
          DateUserRegistered: new Date().toISOString(),
          Status: 'Registered User'
        });
        
        await ctx.reply(`✅ Часовий пояс збережено: <b>${fullLabel}</b>`, { parse_mode: 'HTML' });
        await showPlans(ctx);
        return true;
      }

      // плани
      if (data === 'plan_free' || data === 'activate_trial') {
        console.log(`[startHandler] 🧪 Активація trial для ${tgId}`);
        
        const activated = await paymentService.activateTrialSubscription(tgId, 7);
        
        if (activated) {
          await ctx.reply(
            `🎉 Пробний доступ активовано!\n\n✅ 7 днів повного доступу\n\n🎯 Усі функції доступні!`,
            { parse_mode: 'HTML' }
          );

          // показуємо головне меню
          const fresh = await userService.getUserByTelegramId(tgId);
          await sendWelcomeBack(ctx, fresh);
          ctx.session.step = undefined;
        } else {
          await ctx.reply('❌ Помилка активації. Зв\'яжись з підтримкою.');
        }
        return true;
      }

      // інші плани — показуємо інформацію про оплату
      if (['plan_week','plan_month','plan_year'].includes(data)) {
        await ctx.reply('💳 Для оплати цього плану зверніться до підтримки: nadyastarway@gmail.com\n\nАбо оберіть пробний тиждень для початку.');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[startHandler.handleCallback] ❌ Помилка:', error);
      await ctx.reply('Виникла помилка. Спробуй ще раз /start');
      return true;
    }
  }
};

export default startHandler;