// src/aiMentor/controllers/aiMentorController.js - СПРОЩЕНО

import userService from '../../auth/services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { aiMentorSession } from '../session.js';
import { chat } from '../../services/openaiClient.js';

const handleAIMentorRequest = async (ctx) => {
  const tgId = String(ctx.from.id);
  
  try {
    console.log(`🤖 [AI MENTOR] Запит від ${tgId}`);

    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      console.log(`❌ [AI MENTOR] Користувач ${tgId} не знайдений`);
      return ctx.reply('Спочатку зареєструйся /start', keyboards.mainMenuKeyboard());
    }

    // Перевіряємо підписку
    const isActive = (user['Active_Subscription_Status'] || '').includes('✅ Активна') ||
                     user['Subscription Status'] === 'Active';
                     
    if (!isActive) {
      console.log(`❌ [AI MENTOR] Підписка неактивна для ${tgId}`);
      return ctx.reply(
        '🤖 AI-наставник доступний з активною підпискою.\n\n💰 Активуй підписку для персональної підтримки.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
    }

    // Запускаємо сесію
    aiMentorSession.start(tgId);
    console.log(`🤖 [AI MENTOR] Сесія запущена для ${tgId}`);

    const helpText = 
      `🤖 AI-НАСТАВНИК\n\n` +
      `Я твій персональний коуч! Готовий відповісти:\n\n` +
      `💡 Персональні поради\n` +
      `🎯 Мікро-дії для цілей\n` +
      `⚡ Підтримка в складних ситуаціях\n\n` +
      `Напиши своє питання! 👇`;

    await ctx.reply(helpText, keyboards.aiMentorStartKeyboard());

  } catch (error) {
    console.error('❌ [AI MENTOR] Помилка запиту:', error);
    await ctx.reply('❌ Помилка AI-наставника. Спробуй пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleAIMentorQuestion = async (ctx, question) => {
  const tgId = String(ctx.from.id);
  
  try {
    console.log(`🤖 [AI MENTOR] Питання від ${tgId}: "${question.substring(0, 50)}..."`);

    // Перевіряємо чи активна сесія
    if (!aiMentorSession.isActive(tgId)) {
      console.log(`❌ [AI MENTOR] Сесія неактивна для ${tgId}`);
      return ctx.reply('Сесія неактивна. Запусти AI-наставника заново.', keyboards.mainMenuKeyboard());
    }

    const user = await userService.getUserByTelegramId(tgId);
    if (!user || !(user['Active_Subscription_Status'] || '').includes('✅ Активна')) {
      aiMentorSession.end(tgId);
      return ctx.reply('🤖 Потрібна активна підписка', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }]
          ]
        }
      });
    }

    // Генеруємо відповідь
    const responseText = await generateAIResponse(question, user);
    
    await ctx.reply(responseText, keyboards.aiMentorControlKeyboard());
    console.log(`✅ [AI MENTOR] Відповідь надіслано для ${tgId}`);

  } catch (error) {
    console.error('❌ [AI MENTOR] Помилка питання:', error);
    await ctx.reply('❌ Помилка при обробці питання. Спробуй ще раз.');
  }
};

const generateAIResponse = async (question, user) => {
  try {
    const systemPrompt = `Ти — експертний AI-наставник рівня Tony Robbins. 
    
Принципи:
- Говори з позиції "ти вже маєш силу всередині"
- Конкретні мікро-дії, не загальні поради
- До 150 слів
- Підтримуючий тон
- Українською мовою

Формат відповіді:
🎯 [інсайт про ситуацію]
💡 [конкретні дії]
✨ [мотиваційне закриття]`;

    const prompt = `Користувач: ${user['User Name'] || 'Користувач'}
Питання: "${question}"

Дай персональну підтримуючу відповідь з конкретними діями.`;

    console.log(`[AI MENTOR] Відправляємо запит до OpenAI`);
    
    const response = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 300);

    if (!response?.trim()) {
      throw new Error('Порожня відповідь від OpenAI');
    }

    return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${response}`;

  } catch (error) {
    console.error('[AI MENTOR] Помилка OpenAI:', error);

    // Fallback відповіді
    const fallbacks = [
      '🎯 Твоє питання показує силу духу.\n💡 Почни з одного маленького кроку вперед.\n✨ Ти знаєш відповідь, довіряй собі! ✨',
      '🎯 Я бачу твою рішучість знайти рішення.\n💡 Зроби паузу, подихай і запиши одну ідею для дії.\n✨ Ти вже на правильному шляху! 💪',
      '🎯 Твоя енергія всередині тебе!\n💡 Зроби 5-хвилинну прогулянку і подумай над одним кроком.\n✨ Ти сильніший, ніж думаєш! 🌟'
    ];

    return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${fallbacks[Math.floor(Math.random() * fallbacks.length)]}`;
  }
};

const handleAIMentorCallback = async (ctx) => {
  const tgId = String(ctx.from.id);
  const data = ctx.callbackQuery.data;

  try {
    console.log(`📱 [AI MENTOR] Callback: ${data} від ${tgId}`);

    if (data === 'ai_continue' || data === 'ai_start_question') {
      await ctx.reply('💬 Напиши своє питання, і я дам персональну пораду!', keyboards.aiMentorControlKeyboard());
      await ctx.answerCbQuery('Продовжуємо діалог');

    } else if (data === 'ai_exit') {
      aiMentorSession.end(tgId);
      await ctx.reply('👋 Дякую за спілкування! Повертаємося до меню.', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery('Вихід з AI-наставника');
      console.log(`🚪 [AI MENTOR] Користувач ${tgId} вийшов`);
      
    } else {
      console.log(`❓ [AI MENTOR] Невідомий callback: ${data}`);
      await ctx.answerCbQuery('Команда не розпізнана');
    }

  } catch (error) {
    console.error('[AI MENTOR] Помилка callback:', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    await ctx.answerCbQuery('Помилка');
  }
};

export default {
  handleAIMentorRequest,
  handleAIMentorQuestion,
  handleAIMentorCallback
}; 