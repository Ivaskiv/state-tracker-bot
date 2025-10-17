// src/features/aiMentor/index.js

import { getBase, tables } from '../../config/database.js';
import { AI_MENTOR_CONFIG } from '../../config/index.js';
import keyboards from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';
import logger from '../../utils/logger.js';
import users from '../../services/users.js';
import { chat } from '../../services/openaiClient.js';

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
        Message: message.substring(0, 50000), // Ліміт Airtable
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
    // Отримуємо історію розмови
    const history = await getConversationHistory(tgId);
    
    // Будуємо промпт
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
    
    // Відправляємо запит до AI
const response = await chat(messages, 'gpt-4o-mini', 1000);
    
    if (!response) {
      return AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
    }
    
    // Зберігаємо повідомлення користувача
    await saveConversationMessage(tgId, 'user', userMessage);
    
    // Зберігаємо відповідь AI
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

/**
 * Обробка текстового повідомлення для AI
 */
const handleText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  
  if (!text) return false;
  
  try {
    const user = await users.getUserByTgId(tgId);
    if (!user) return false;
    
    // Перевіряємо чи користувач у активному стані AI чату
    const answerStep = user.fields.Answer_Step;
    if (answerStep !== 'ai_mentor_active') {
      return false;
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
    logger.error('[aiMentor/handleText] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Обробка callback для AI наставника
 */
const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  const tgId = ctx.from.id;
  
  if (!data) return false;
  
  const aiMentorCallbacks = [
    'show_ai_mentor',
    'continue_ai_mentor'
  ];
  
  if (!aiMentorCallbacks.includes(data)) {
    return false;
  }
  
  try {
    await ctx.answerCbQuery();
    
    switch (data) {
      case 'show_ai_mentor':
      case 'continue_ai_mentor':
        // Встановлюємо статус "в чаті з AI"
        await users.updateUserFields(tgId, { Answer_Step: 'ai_mentor_active' });
        await showAIMentorChat(ctx);
        break;
      
      default:
        return false;
    }
    
    return true;
  } catch (error) {
    logger.error('[aiMentor/handleCallback] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Ініціалізація модуля
 */
export default function initAIMentor(bot) {
  console.log('🤖 [aiMentor] Ініціалізація модуля...');
  console.log('✅ [aiMentor] Модуль готовий');
}

// Експорт функцій
export {
  getConversationHistory,
  saveConversationMessage,
  getAIMentorResponse,
  showAIMentorChat,
  handleText,
  handleCallback
};

console.log('✅ [features/aiMentor] Модуль завантажено');