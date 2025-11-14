// src/features/aiMentor/index.js
// ✅ 3-LEVEL ARCHITECTURE
// ONE export: initAIMentor(bot) registers ALL handlers

import { getBase, tables } from '../../config/database.js';
import keyboards from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';
import logger from '../../utils/logger.js';
import { chat } from '../../services/openaiClient.js';
import { AI_MENTOR_CONFIG } from './constantsAi.js';

const base = getBase();

/**
 * Отримати останні повідомлення розмови з AI
 */
const getConversationHistory = async (tgId) => {
  try {
    const formula = `{TG_id}="${tgId}"`;
    
    const records = await base(tables.AI_CONVERSATIONS)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Timestamp', direction: 'desc' }],
        maxRecords: AI_MENTOR_CONFIG.MAX_CONVERSATION_HISTORY
      })
      .all();
    
    return records.map(r => ({
      role: r.fields.Role === 'user' ? 'user' : 'assistant',
      content: r.fields.Message || ''
    })).reverse();
  } catch (error) {
    logger.error('[aiMentor/getConversationHistory] ❌ Помилка:', error);
    return [];
  }
};

/**
 * Зберегти повідомлення AI до історії
 */
const saveConversationMessage = async (tgId, role, message) => {
  try {
    await base(tables.AI_CONVERSATIONS).create([{
      fields: {
        TG_id: String(tgId),
        Role: role === 'user' ? 'user' : 'assistant',
        Message: message.substring(0, 50000),
        Timestamp: new Date().toISOString()
      }
    }], { typecast: true });
    
    logger.info('[aiMentor] ✅ Повідомлення збережено');
  } catch (error) {
    logger.error('[aiMentor/saveConversationMessage] ❌ Помилка:', error);
  }
};

/**
 * Отримати відповідь від AI наставника
 */
const getAIMentorResponse = async (tgId, userMessage) => {
  try {
    const history = await getConversationHistory(tgId);
    
    const systemPrompt = 
      `Ти — експертний AI-наставник. Стиль: Gen Z, прямо, емпатійно, без води.
      Твоя задача — допомогти користувачу в досягненні цілей, мотивувати та давати конкретні дії.
      Мова: українська. Довжина: до 140 слів (краще 80–120).
      Не даєш медичні поради, психотерапію. Без загальних фраз.
      Тон: рішучий + підтримуючий. Конкретика > пафос.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage }
    ];
    
    const response = await chat(messages, 'gpt-4o-mini', 1000);
    
    if (!response) {
      return AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
    }
    
    await saveConversationMessage(tgId, 'user', userMessage);
    await saveConversationMessage(tgId, 'assistant', response);
    
    return response;
  } catch (error) {
    logger.error('[aiMentor/getAIMentorResponse] ❌ Помилка:', error);
    return AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
  }
};

/**
 * Показати розмову з AI наставником
 */
const showAIMentorChat = async (ctx) => {
  try {
    await typing(ctx);
    
    const message = 
      `🤖 **AI НАСТАВНИК**\n\n` +
      `Привіт! Я твій персональний AI-коуч. 🎯\n\n` +
      `Напиши мені:\n` +
      `• Про своє завдання чи проблему\n` +
      `• Що чекає перевірку\n` +
      `• З чим потрібна допомога\n\n` +
      `Я дам конкретні рекомендації та мікро-дії 💪`;
    
    await ctx.reply(
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
    
    logger.info('[aiMentor] ✅ Показаний AI наставник');
  } catch (error) {
    logger.error('[aiMentor/showAIMentorChat] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка завантаження AI наставника', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════
// 🤖 MAIN INIT FUNCTION
// ═══════════════════════════════════════════════════════════

export default function initAIMentor(bot) {
  console.log('🤖 [aiMentor] Ініціалізація модуля…');

  // ─────────────────────────────────────────────────────────
  // 📢 КОМАНДИ
  // ─────────────────────────────────────────────────────────

  bot.command('ai', async (ctx) => {
    try {
      await showAIMentorChat(ctx);
    } catch (e) {
      logger.error('[aiMentor/command] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────
  // 🎯 CALLBACK ACTIONS
  // ─────────────────────────────────────────────────────────

  bot.action('show_ai_mentor', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const user = await getUserByTgId(ctx.from.id);
      
      if (user) {
        await updateUserFields(ctx.from.id, { Answer_Step: 'ai_mentor_active' });
      }
      
      await showAIMentorChat(ctx);
    } catch (e) {
      logger.error('[aiMentor/show] ❌', e.message);
    }
  });

  bot.action('continue_ai_mentor', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const user = await getUserByTgId(ctx.from.id);
      
      if (user) {
        await updateUserFields(ctx.from.id, { Answer_Step: 'ai_mentor_active' });
      }
      
      await showAIMentorChat(ctx);
    } catch (e) {
      logger.error('[aiMentor/continue] ❌', e.message);
    }
  });

  // ─────────────────────────────────────────────────────────
  // 📝 TEXT HANDLER — обробляє повідомлення для AI
  // ─────────────────────────────────────────────────────────

  bot.on('text', async (ctx) => {
    try {
      const tgId = ctx.from.id;
      const text = ctx.message?.text?.trim();
      
      if (!text) return false;
      
      const user = await getUserByTgId(tgId);
      if (!user) return false;
      
      // Перевіряємо чи користувач у активному стані AI чату
      const answerStep = user.fields.Answer_Step;
      if (answerStep !== 'ai_mentor_active') {
        return false; // Не наш кейс
      }
      
      await typing(ctx);
      
      // Показуємо що обробляємо
      const processingMsg = await ctx.reply('⏳ Розмірковую...');
      
      // Отримуємо відповідь від AI
      const response = await getAIMentorResponse(tgId, text);
      
      // Видаляємо повідомлення про обробку
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      } catch {}
      // 🎮 ГЕЙМІФІКАЦІЯ: +2 за AI взаємодію
    await gamification.rewardAIInteraction(tgId, ctx._bot);
    
      // Відправляємо відповідь
      await ctx.reply(
        `🤖 **РЕКОМЕНДАЦІЯ**\n\n${response}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Наступне питання', callback_data: 'continue_ai_mentor' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      
      logger.info('[aiMentor] ✅ Відповідь надана');
      return true;
    } catch (error) {
      logger.error('[aiMentor/text] ❌ Помилка:', error);
      return false;
    }
  });

  console.log('✅ [aiMentor] Всі хендлери зареєстровані');
}

// ═══════════════════════════════════════════════════════════
// 📤 ЕКСПОРТИ (для використання з інших модулів)
// ═══════════════════════════════════════════════════════════

export {
  getConversationHistory,
  saveConversationMessage,
  getAIMentorResponse,
  showAIMentorChat
};

console.log('✅ [features/aiMentor] Модуль завантажено');