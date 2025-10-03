// src/controllers/handlers/textHandler.js — ВИПРАВЛЕНО: підтримка щоденних сесій

import userService from '../../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { GENERAL_AFFIRMATIONS } from '../../config/constants.js';

// ✅ ІМПОРТ dailyController
import dailyController from '../flows/dailyController.js';

// ✅ ENUM ДЛЯ ТЕКСТОВИХ КОМАНД (без emoji)
const TEXT_COMMANDS = {
  AI_MENTOR: 'AI Наставник',
  WHEEL: 'Колесо балансу',
  REPORTS: 'Звіти',
  INFO: 'Інформація про бота',
  SUBSCRIPTION: 'Підписка',
  CONTACT: 'Зв\'язок',
  AFFIRMATION: 'Афірмація',
  WEEKLY_REPORT: 'Щотижневий звіт',
  MONTHLY_REPORT: 'Щомісячний звіт',
  PROGRESS: 'Мій прогрес',
  HELP: 'Допомога',
  INSTRUCTIONS: 'Інструкції',
};

// ✅ УНІВЕРСАЛЬНА ФУНКЦІЯ ДЛЯ БЛОКОВАНИХ ФІЧ (з клавіатурою!)
const showFeatureBlocked = async (ctx, featureName) => {
  console.log(`[textHandler] 🚫 Feature blocked: ${featureName}`);
  
  await ctx.reply(
    `🔒 "${featureName}" — преміум функція!\n\n💎 Активуй підписку для доступу.`,
    keyboards.subscriptionPlansKeyboard()
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 ГОЛОВНИЙ ОБРОБНИК ТЕКСТУ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const handle = async (ctx) => {
  const tgId = ctx.from.id;
  const rawText = ctx.message?.text || '';
  const text = rawText.trim();

  if (!text) {
    return false; // Не текст — пропускаємо
  }

  console.log(`[textHandler] 💬 Текст від ${tgId}: "${text}"`);

  try {
    // ✅ ОТРИМУЄМО КОРИСТУВАЧА
    const user = await userService.getUserByTgId(tgId);
    
    if (!user || !user.UserRegistered) {
      console.log(`[textHandler] ❌ Користувач не зареєстрований`);
      await ctx.reply(
        'Спочатку зареєструйся /start', 
        keyboards.mainMenuKeyboard()
      );
      return true;
    }

    // ✅ КРИТИЧНО: ПЕРЕВІРЯЄМО АКТИВНІ СЕСІЇ ПЕРЕД ОБРОБКОЮ КОМАНД
    const userStep = user?.Current_Activity;
    
    // 1️⃣ ЩОДЕННІ ПИТАННЯ (ранкові Q_m_*)
    if (userStep?.startsWith('Q_m_')) {
      console.log(`[textHandler] 🌞 Активна ранкова сесія: ${userStep}`);
      const handled = await dailyController.handleText(ctx, text, userStep);
      if (handled) return true;
    }
    
    // 2️⃣ ЩОДЕННІ ПИТАННЯ (вечірні Q_e_*)
    if (userStep?.startsWith('Q_e_')) {
      console.log(`[textHandler] 🌙 Активна вечірня сесія: ${userStep}`);
      const handled = await dailyController.handleText(ctx, text, userStep);
      if (handled) return true;
    }

    // 3️⃣ AI НАСТАВНИК
    const { aiMentorSession } = await import('../../utils/session.js');
    if (aiMentorSession.isActive?.(tgId)) {
      console.log(`[textHandler] 🤖 Активна AI сесія`);
      const aiMentorController = await import('../flows/aiMentorController.js');
      await aiMentorController.default.handleAIMentorQuestion(ctx, text);
      return true;
    }

    // 4️⃣ КОЛЕСО БАЛАНСУ (очікування нотатки)
    if (userStep === 'WheelBalance' && ctx.session?.wheel?.awaitingNoteFor != null) {
      console.log(`[textHandler] 🎯 Колесо: очікування нотатки`);
      const wheelController = await import('../flows/wheelController.js');
      const handled = await wheelController.default.handleText(ctx, text);
      if (handled) return true;
    }

    // ✅ ПЕРЕВІРКА ДОСТУПУ для команд
    const hasAccess = userService.hasActiveAccess(user);
    console.log(`[textHandler] 🔑 hasActiveAccess: ${hasAccess}`);

    // ✅ НОРМАЛІЗАЦІЯ ТЕКСТУ (видаляємо emoji)
    const normalizedText = text
      .replace(/[🤖🎯📊ℹ️💰📞💎📈📝❓]/g, '')
      .trim();

    // ════════════════════════════════════════════════════════════════════════
    // 🎯 ОБРОБКА КОМАНД
    // ════════════════════════════════════════════════════════════════════════

    if (normalizedText === TEXT_COMMANDS.AI_MENTOR || normalizedText.includes('Наставник')) {
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'AI Наставник');
        return true;
      }

      const aiMentorController = await import('../flows/aiMentorController.js');
      await aiMentorController.default.handleAIMentorRequest(ctx);
      return true;
    }

    if (normalizedText === TEXT_COMMANDS.WHEEL || normalizedText.includes('Колесо')) {
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Колесо балансу');
        return true;
      }

      const wheelController = await import('../flows/wheelController.js');
      await wheelController.default.handleRequest(ctx);
      return true;
    }

    if (normalizedText === TEXT_COMMANDS.REPORTS || normalizedText.includes('Звіти')) {
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Звіти');
        return true;
      }

      await ctx.reply(
        '📊 ЗВІТИ\n\nОбери тип:', 
        keyboards.reportsMenuInline()
      );
      return true;
    }

    if (normalizedText === TEXT_COMMANDS.INFO || normalizedText.includes('Інформація')) {
      await ctx.reply(
        'ℹ️ ІНФОРМАЦІЯ\n\nОбери:', 
        keyboards.infoMenuInline()
      );
      return true;
    }

    if (normalizedText === TEXT_COMMANDS.SUBSCRIPTION || normalizedText.includes('Підписка')) {
      await ctx.reply(
        '💰 ПІДПИСКА\n\nОбери:', 
        keyboards.subscriptionMenuInline()
      );
      return true;
    }

    if (normalizedText === TEXT_COMMANDS.CONTACT || normalizedText.includes('Зв\'язок')) {
      await ctx.reply(
        '📞 ЗВ\'ЯЗОК\n\nОбери:', 
        keyboards.contactMenuInline()
      );
      return true;
    }

    if (normalizedText === TEXT_COMMANDS.AFFIRMATION || normalizedText.includes('Афірмація')) {
      const affirmation = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
      await ctx.reply(
        `✨ ${affirmation}`, 
        keyboards.mainMenuKeyboard()
      );
      return true;
    }

    if (normalizedText.includes('Щотижневий') || normalizedText.includes('Щомісячний') || normalizedText.includes('прогрес')) {
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Звіти');
        return true;
      }

      const reportType = normalizedText.includes('Щотижневий') 
        ? 'Щотижневий' 
        : normalizedText.includes('Щомісячний') 
          ? 'Щомісячний' 
          : 'Мій прогрес';

      await ctx.reply(
        `📈 ${reportType} звіт\n\nАналіз скоро!`, 
        keyboards.mainMenuKeyboard()
      );
      return true;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ❓ НЕВІДОМА КОМАНДА
    // ════════════════════════════════════════════════════════════════════════

    console.log(`[textHandler] ❓ Невідома команда: "${text}"`);
    await ctx.reply(
      '❓ Не розпізнав команду. Використовуй меню 👇', 
      keyboards.mainMenuKeyboard()
    );
    return true;

  } catch (error) {
    console.error('[textHandler] ❌ Критична помилка:', error);
    await ctx.reply(
      '❌ Помилка. Спробуй /start', 
      keyboards.mainMenuKeyboard()
    );
    return true;
  }
};

export default { handle };