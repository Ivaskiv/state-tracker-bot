// src/controllers/handlers/textHandler.js - ФІКС: TRY-CATCH PER CASE + ЛОГИ REPLY + EMOJI-SAFE

import userService from '../../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { CURRENT_ACTIVITY, GENERAL_AFFIRMATIONS } from '../../config/constants.js';

export const handle = async (ctx) => {
  const tgId = ctx.from.id;
  const rawText = ctx.message?.text || '';
  const text = rawText.trim().replace(/\s+/g, ' ').toLowerCase(); // ✅ Lowercase NORM
  if (!text) return false;

  console.log(`[textHandler] 🔍 RAW: "${rawText}" → NORM: "${text}" від ${tgId}`);

  try {
    const user = await userService.getUserByTgId(tgId);
    console.log(`[textHandler] 👤 User: ${user?.['User Name']}, Registered: ${user?.UserRegistered}`);

    if (!user || !user.UserRegistered) {
      console.log(`[textHandler] ❌ Не зареєстрований`);
      await ctx.reply('Спочатку зареєструйся /start', keyboards.mainMenuKeyboard());
      return true;
    }

    const step = user.Answer_Step || user.Current_Activity;
    console.log(`[textHandler] 📍 Step: ${step}`);

    // ===== АКТИВНІ СЕСІЇ =====
    if (step === CURRENT_ACTIVITY.WHEEL) {
      console.log(`[textHandler] 🔄 Wheel активна`);
      try {
        const wheelController = (await import('../flows/wheelController.js')).default;
        await wheelController.handleText?.(ctx, rawText);
        console.log(`[textHandler] ✅ Wheel OK`);
      } catch (e) {
        console.error(`[textHandler] ❌ Wheel FAIL:`, e);
        await ctx.reply('🎯 Колесо: Скоро! Перевір підписку.', keyboards.subscriptionMenuInline());
      }
      return true;
    }

    if (step?.startsWith('Q_m_') || step?.startsWith('Q_e_')) {
      console.log(`[textHandler] 🔄 Daily активна`);
      try {
        const dailyController = (await import('../flows/dailyController.js')).default;
        await dailyController.handleText?.(ctx, rawText, step);
        console.log(`[textHandler] ✅ Daily OK`);
      } catch (e) {
        console.error(`[textHandler] ❌ Daily FAIL:`, e);
        await ctx.reply('📅 Daily: Продовж пізніше.', keyboards.mainMenuKeyboard());
      }
      return true;
    }

    // ✅ ЯВНИЙ ВИКЛИК + ЛОГ
    const hasAccess = userService.hasActiveAccess(user); // Без ?.
    console.log(`[textHandler] 🔑 hasActiveAccess call result: ${hasAccess} (явний виклик)`);

    const showFeatureBlocked = async (feature) => {
      const blockMsg = `🔒 "${feature}" - преміум! Активуй TRIAL.`;
      console.log(`[textHandler] 🚫 Block → Reply: ${blockMsg}`);
      await ctx.reply(blockMsg, keyboards.subscriptionPlansKeyboard());
    };

    // ===== ОБРОБКА (LOWERCASE CASE) =====
    let matched = false;
    switch (true) {
      case text.includes('ai наставник'):
        console.log(`[textHandler] ✅ MATCH: AI (includes)`);
        matched = true;
        try {
          if (!hasAccess) return await showFeatureBlocked('AI Наставник');
          const aiMentorController = (await import('../flows/aiMentorController.js')).default;
          await aiMentorController.handleAIMentorRequest(ctx);
          console.log(`[textHandler] ✅ AI reply OK`);
        } catch (e) {
          console.error(`[textHandler] ❌ AI FAIL:`, e);
          await ctx.reply('🤖 AI: Скоро!', keyboards.subscriptionMenuInline());
        }
        break;

      case text.includes('колесо балансу'):
        console.log(`[textHandler] ✅ MATCH: Колесо (includes)`);
        matched = true;
try {
  if (!hasAccess) return await showFeatureBlocked('AI Наставник');
  const aiMentorController = (await import('../flows/aiMentorController.js')).default;
  await aiMentorController.handleAIMentorRequest(ctx);
} catch(e) {
  await ctx.reply('🤖 AI: Скоро!', keyboards.subscriptionMenuInline());
}        break;

      case text.includes('звіти'):
        console.log(`[textHandler] ✅ MATCH: Звіти (includes)`);
        matched = true;
        try {
          if (!hasAccess) return await showFeatureBlocked('Звіти');
          console.log(`[textHandler] 📊 Reply: Меню звітів`);
          await ctx.reply('📊 ЗВІТИ\n\nОбери тип:', keyboards.reportsMenuInline());
        } catch (e) {
          console.error(`[textHandler] ❌ Звіти FAIL:`, e);
          await ctx.reply('📊 Звіти: Скоро!', keyboards.subscriptionMenuInline());
        }
        break;

      case text.includes('інформація про бота'):
        console.log(`[textHandler] ✅ MATCH: Інфо (includes)`);
        matched = true;
        try {
          console.log(`[textHandler] ℹ️ Reply: Меню інфо`);
          await ctx.reply('ℹ️ ІНФОРМАЦІЯ\n\nОбери:', keyboards.infoMenuInline());
        } catch (e) {
          console.error(`[textHandler] ❌ Інфо FAIL:`, e);
          await ctx.reply('ℹ️ Інфо: Скоро!', keyboards.mainMenuKeyboard());
        }
        break;

      case text.includes('підписка'):
        console.log(`[textHandler] ✅ MATCH: Підписка (includes)`);
        matched = true;
        try {
          console.log(`[textHandler] 💰 Reply: Меню підписки`);
          await ctx.reply('💰 ПІДПИСКА\n\nОбери:', keyboards.subscriptionMenuInline());
        } catch (e) {
          console.error(`[textHandler] ❌ Підписка FAIL:`, e);
          await ctx.reply('💰 Підписка: Активуй TRIAL!', keyboards.subscriptionPlansKeyboard());
        }
        break;

      case text.includes('зв\'язок'):
        console.log(`[textHandler] ✅ MATCH: Зв\'язок (includes)`);
        matched = true;
        try {
          console.log(`[textHandler] 📞 Reply: Меню зв\'язку`);
          await ctx.reply('📞 ЗВ\'ЯЗОК\n\nОбери:', keyboards.contactMenuInline());
        } catch (e) {
          console.error(`[textHandler] ❌ Зв\'язок FAIL:`, e);
          await ctx.reply('📞 Зв\'язок: @Nadya2316', keyboards.mainMenuKeyboard());
        }
        break;

      case text.includes('афірмація'):
        console.log(`[textHandler] ✅ MATCH: Афірмація (includes)`);
        matched = true;
        try {
          const affirmation = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
          console.log(`[textHandler] ✨ Reply: Афірмація`);
          await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
        } catch (e) {
          console.error(`[textHandler] ❌ Афірмація FAIL:`, e);
          await ctx.reply('✨ Афірмація: "Ти сильна!"', keyboards.mainMenuKeyboard());
        }
        break;

      case text.includes('щотижневий звіт') || text.includes('щомісячний звіт') || text.includes('мій прогрес'):
        console.log(`[textHandler] ✅ MATCH: Звіт/Прогрес (includes): ${text}`);
        matched = true;
        try {
          if (!hasAccess) return await showFeatureBlocked('Звіти');
          const reportType = text.includes('щотижневий') ? 'Щотижневий' : text.includes('щомісячний') ? 'Щомісячний' : 'Мій прогрес';
          console.log(`[textHandler] 📈 Reply: ${reportType}`);
          await ctx.reply(`📈 ${reportType} ЗВІТ\n\nАналіз скоро!`, keyboards.mainMenuKeyboard());
        } catch (e) {
          console.error(`[textHandler] ❌ Звіт FAIL:`, e);
          await ctx.reply('📈 Звіт: Скоро!', keyboards.subscriptionMenuInline());
        }
        break;


      default:
        console.log(`[textHandler] ❓ NO MATCH: "${text}"`);
        await ctx.reply('❓ Не розпізнав. Використовуй меню 👇', keyboards.mainMenuKeyboard());
        return true;
    }

  } catch (error) {
    console.error('[textHandler] ❌ GLOBAL error:', error);
    await ctx.reply('❌ Помилка. /start', keyboards.mainMenuKeyboard());
    return true;
  }
};

export default { handle };