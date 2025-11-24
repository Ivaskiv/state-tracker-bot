// src/features/registration/index.js
import { startHandler, nameActions, textHandler } from './handlers.js';
import callbacks from '../../services/callbacks.js';
import { createUser, activateTrial } from '../../services/users.js';
import keyboards from '../../utils/keyboards.js';
import { TILDA_URLS } from './constants.js';

export default function initOnboarding(bot) {
  console.log('📝 [registration] Ініціалізація...');
  
  // Start handler
  bot.start(startHandler);
  
  // Callback actions для онбордингу
  bot.action('use_telegram_name', nameActions.use_telegram_name);
  bot.action('enter_custom_name', nameActions.enter_custom_name);
  bot.action('skip_phone', nameActions.skip_phone);
  
  // Text handler для онбордингу (тільки для ob_ кроків)
  bot.on('text', async (ctx, next) => {
    const step = ctx.state?.step;
    if (step && /^ob_/i.test(step)) {
      return textHandler(ctx);
    }
    return next();
  });
  
  // ═══════════════════════════════════════════════════════════
  // ШВИДКА РЕЄСТРАЦІЯ
  // ═══════════════════════════════════════════════════════════
  
  callbacks.on('quick_registration', async (ctx) => {
    await ctx.answerCbQuery();
    
    const tgId = String(ctx.from.id);
    const firstName = ctx.from.first_name || 'Користувач';
    
    console.log('⚡ [quick_registration] Створюємо користувача:', tgId);
    
    try {
      // Створюємо користувача з початковим кроком
      await createUser({
        tgId,
        name: firstName,
        step: 'ob_name',
        source: 'quick_bot_registration'
      });
      
      await ctx.reply(
        `👋 Чудово, ${firstName}!\n\n` +
        `Почнемо швидку реєстрацію.\n\n` +
        `Залишити ім'я "${firstName}" чи ввести інше?`,
        keyboards.nameChoiceInline()
      );
    } catch (err) {
      console.error('❌ [quick_registration]', err);
      await ctx.reply('❌ Помилка створення користувача. Спробуй /start');
    }
  });
  
  // ═══════════════════════════════════════════════════════════
  // ІнФО ПРО БОТА
  // ═══════════════════════════════════════════════════════════
  
  callbacks.on('show_bot_info', async (ctx) => {
    await ctx.answerCbQuery();
    
    const registrationUrl = `${TILDA_URLS.REGISTRATION}?tg_id=${ctx.from.id}`;
    
    await ctx.reply(
      '🤖 **AI МЕНТОР - ЩО Я ВМІЮ**\n\n' +
      '🎯 **Колесо балансу**\n' +
      'Оціни 8 сфер життя і визначи пріоритети на місяць\n\n' +
      '🌞🌙 **Щоденні рефлексії**\n' +
      'Ранкова настройка + вечірній аналіз дня\n\n' +
      '🤖 **AI-наставник 24/7**\n' +
      'Персональні поради та підтримка в будь-який час\n\n' +
      '📊 **Звіти та статистика**\n' +
      'Щотижневі підсумки та аналіз прогресу\n\n' +
      '🎮 **Геймифікація**\n' +
      'Бейджі, рівні, досягнення та нагороди\n\n' +
      '💰 **Підписка**\n' +
      '🧪 7 днів безкоштовного пробного періоду',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⚡ Швидка реєстрація', callback_data: 'quick_registration' }],
            [{ text: '📝 Повна форма на сайті', url: registrationUrl }]
          ]
        }
      }
    );
  });
  
  console.log('✅ [registration] Готово');
}
