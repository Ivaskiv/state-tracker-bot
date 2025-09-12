// src/dialogue/services/enhancedQuestionService.js - НОВА СИСТЕМА З AI УЗАГАЛЬНЕННЯМ

import { getBase, tables } from '../../config/database.js';
import { chat } from '../../services/openaiClient.js';
import userService from '../../auth/services/userService.js';
import { ANSWER_STEPS, MORNING_QUESTIONS, EVENING_QUESTIONS } from '../../config/constants.js';
import { getUserDateString } from '../../utils/timezoneUtils.js';
import keyboards from '../../utils/keyboards.js';
import typing from '../../utils/typing.js';

const base = getBase();

// ✅ 1. ЗБЕРЕЖЕННЯ УЗАГАЛЬНЕННЯ AI
const saveAISummary = async (tgId, summaryType, aiSummary) => {
  try {
    const today = getUserDateString(tgId);
    const tgIdString = String(tgId);

    console.log(`[enhancedQuestionService] 💾 Збереження AI узагальнення:`);
    console.log(`- Користувач: ${tgIdString}`);
    console.log(`- Тип: ${summaryType}`);
    console.log(`- Дата: ${today}`);

    // Знаходимо запис за сьогодні
    const existingRecords = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", DATESTR({Date Response})="${today}")`,
      maxRecords: 1,
    }).firstPage();

    const summaryField = summaryType === 'morning' ? 'AI_Morning_Summary' : 'AI_Evening_Summary';

    if (existingRecords.length > 0) {
      // Оновлюємо існуючий запис
      await base('Responses').update([{
        id: existingRecords[0].id,
        fields: {
          [summaryField]: aiSummary,
          [`${summaryField}_Generated_At`]: new Date().toISOString()
        }
      }]);
      console.log(`[enhancedQuestionService] ✅ AI узагальнення оновлено в існуючому записі`);
    } else {
      // Створюємо новий запис (якщо якимось чином його немає)
      await base('Responses').create([{
        fields: {
          TG_id: tgIdString,
          'User Name': 'Користувач',
          'Date Response': today,
          [summaryField]: aiSummary,
          [`${summaryField}_Generated_At`]: new Date().toISOString()
        }
      }]);
      console.log(`[enhancedQuestionService] ✅ AI узагальнення збережено в новому записі`);
    }

  } catch (error) {
    console.error('[enhancedQuestionService] ❌ Помилка збереження AI узагальнення:', error);
    throw error;
  }
};

// ✅ 2. ГЕНЕРАЦІЯ AI УЗАГАЛЬНЕННЯ
const generateAISummary = async (tgId, summaryType, responses) => {
  try {
    console.log(`[enhancedQuestionService] 🤖 Генерація AI узагальнення для ${summaryType}`);

    let prompt = '';
    let systemPrompt = '';

    if (summaryType === 'morning') {
      systemPrompt = `Ти AI-коуч трансформації. Проаналізуй ранкові відповіді користувача та створи персональне узагальнення.

Фокусуйся на:
- Силу та ресурсі в відповідях
- Ясність цілей та намірів
- Мікро-дії для прогресу
- Підтримуючі інсайти

Формат відповіді (до 120 слів):
🎯 [Головна ціль на день]
💪 [Сильні якості користувача]  
⚡ [Ключові мікро-дії]
✨ [Мотивуючий інсайт]`;

      prompt = `Проаналізуй ранкові відповіді користувача:

1. Хто я сьогодні: "${responses.q1 || 'не відповів'}"
2. Яка я: "${responses.q2 || 'не відповів'}"
3. Мої цілі: "${responses.q3 || 'не відповів'}"
4. Фокус сьогодні: "${responses.q4 || 'не відповів'}"
5. Стан: "${responses.q5 || 'не відповів'}"
6. Чому гідна: "${responses.q6 || 'не відповів'}"

Створи персональне узагальнення українською мовою з позиції підтримки та сили.`;

    } else {
      systemPrompt = `Ти AI-коуч трансформації. Проаналізуй вечірні відповіді користувача та створи підсумок дня.

Фокусуйся на:
- Усвідомлення енергії та ресурсів
- Розпізнавання блокуючих програм
- Фіксація перемог та досягнень
- Поради на завтра

Формат відповіді (до 120 слів):
🌟 [Головна перемога дня]
⚡ [Джерела енергії] 
🔍 [Блоки для усвідомлення]
💡 [Інсайт на завтра]`;

      prompt = `Проаналізуй вечірні відповіді користувача:

1. Що наповнило енергією: "${responses.q1 || 'не відповів'}"
2. Де злила енергію: "${responses.q2 || 'не відповів'}"
3. Активні програми: "${responses.q3 || 'не відповів'}"
4. Діяла з позиції: "${responses.q4 || 'не відповів'}"
5. Головна перемога: "${responses.q5 || 'не відповів'}"

Створи підтримуючий підсумок дня українською мовою з позиції сили.`;
    }

    const aiResponse = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 300);

    console.log(`[enhancedQuestionService] ✅ AI узагальнення згенеровано: ${aiResponse.length} символів`);
    return aiResponse || `${summaryType === 'morning' ? '🌞' : '🌙'} Дякую за щирі відповіді! Ти на правильному шляху до своїх цілей. Продовжуй рухатися вперед! 💪`;

  } catch (error) {
    console.error('[enhancedQuestionService] ❌ Помилка генерації AI узагальнення:', error);
    const fallback = summaryType === 'morning' 
      ? '🌞 Твої ранкові відповіді показують готовність до дії! Сфокусуйся на головній цілі та роби крок за кроком. Ти маєш усе необхідне для успіху! 💪'
      : '🌙 Дякую за чесний аналіз дня! Кожна усвідомлена дія наближує тебе до мети. Завтра - новий день для нових перемог! ✨';
    return fallback;
  }
};

// ✅ 3. СИСТЕМА ПИТАННЯ-ВІДПОВІДЬ БЕЗ ДУБЛІКАТІВ
class QuestionSession {
  constructor(tgId, sessionType) {
    this.tgId = tgId;
    this.sessionType = sessionType; // 'morning' або 'evening'
    this.responses = {};
    this.currentQuestionIndex = 0;
    this.isActive = true;
    this.questions = sessionType === 'morning' ? MORNING_QUESTIONS : EVENING_QUESTIONS;
    this.maxQuestions = this.questions.length;
  }

  getCurrentQuestion() {
    if (this.currentQuestionIndex < this.maxQuestions) {
      return {
        index: this.currentQuestionIndex,
        total: this.maxQuestions,
        question: this.questions[this.currentQuestionIndex],
        isLast: this.currentQuestionIndex === this.maxQuestions - 1
      };
    }
    return null;
  }

  addResponse(response) {
    const questionKey = `q${this.currentQuestionIndex + 1}`;
    this.responses[questionKey] = response;
    console.log(`[QuestionSession] Збережено відповідь ${questionKey}: "${response.substring(0, 50)}..."`);
  }

  nextQuestion() {
    this.currentQuestionIndex++;
    return this.getCurrentQuestion();
  }

  isCompleted() {
    return this.currentQuestionIndex >= this.maxQuestions;
  }

  getAllResponses() {
    return this.responses;
  }
}

// Активні сесії
const activeSessions = new Map();

// ✅ 4. ЗАХИСТ ВІД ІНШИХ ДІЙ ПІД ЧАС СЕСІЇ
const hasActiveSession = (tgId) => {
  return activeSessions.has(tgId);
};

const getActiveSession = (tgId) => {
  return activeSessions.get(tgId);
};

const startQuestionSession = async (ctx, sessionType) => {
  const tgId = ctx.from.id;
  const userName = ctx.from.first_name || 'Користувач';

  console.log(`[enhancedQuestionService] 🚀 ПОЧАТОК ${sessionType.toUpperCase()} СЕСІЇ для ${tgId}`);

  // Перевіряємо чи немає активної сесії
  if (hasActiveSession(tgId)) {
    console.log(`[enhancedQuestionService] ⚠️ Вже є активна сесія для ${tgId}`);
    
    await typing(ctx);
    await ctx.reply(
      '🔄 У тебе вже є активна сесія питань.\n\nОбери дію:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Продовжити поточну сесію', callback_data: 'continue_active_session' }],
            [{ text: '🚪 Завершити поточну та почати нову', callback_data: `restart_${sessionType}` }],
            [{ text: '❌ Вийти', callback_data: 'exit_session' }]
          ]
        }
      }
    );
    return;
  }

  // Створюємо нову сесію
  const session = new QuestionSession(tgId, sessionType);
  activeSessions.set(tgId, session);

  // Встановлюємо відповідний крок
  const step = sessionType === 'morning' ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;
  await userService.updateUserStep(tgId, step);

  // Надсилаємо перше питання
  const currentQ = session.getCurrentQuestion();
  const introText = sessionType === 'morning' 
    ? `🌞 Ранкова рефлексія, ${userName}!\n\nЧас налаштуватися на день ✨`
    : `🌙 Вечірня рефлексія, ${userName}!\n\nЧас підсумувати день 🏆`;

  await typing(ctx);
  await ctx.reply(`${introText}\n\n${currentQ.index + 1}️⃣/${currentQ.total} ${currentQ.question}`);

  console.log(`[enhancedQuestionService] ✅ Сесію ${sessionType} розпочато для ${tgId}`);
};

const handleQuestionAnswer = async (ctx, answer) => {
  const tgId = ctx.from.id;
  const session = getActiveSession(tgId);

  if (!session) {
    console.log(`[enhancedQuestionService] ❌ Немає активної сесії для ${tgId}`);
    return false;
  }

  console.log(`[enhancedQuestionService] 📝 Обробка відповіді від ${tgId}: "${answer}"`);

  // Зберігаємо відповідь в сесії
  session.addResponse(answer);

  // Зберігаємо в базу даних
  await saveQuestionResponse(tgId, session.sessionType, session.currentQuestionIndex + 1, answer);

  // Переходимо до наступного питання
  const nextQ = session.nextQuestion();

  if (nextQ) {
    // Є ще питання
    console.log(`[enhancedQuestionService] ➡️ Наступне питання ${nextQ.index + 1}/${nextQ.total}`);
    
    await typing(ctx);
    await ctx.reply(`${nextQ.index + 1}️⃣/${nextQ.total} ${nextQ.question}`);

    // Оновлюємо крок користувача
    const stepName = session.sessionType === 'morning' 
      ? `Q_m_${nextQ.index + 1}` 
      : `Q_e_${nextQ.index + 1}`;
    await userService.updateUserStep(tgId, stepName);

  } else {
    // Сесія завершена
    console.log(`[enhancedQuestionService] ✅ Сесія ${session.sessionType} завершена для ${tgId}`);
    
    await completeQuestionSession(ctx, session);
  }

  return true;
};

const completeQuestionSession = async (ctx, session) => {
  const tgId = session.tgId;
  const sessionType = session.sessionType;
  const responses = session.getAllResponses();

  console.log(`[enhancedQuestionService] 🏁 Завершення сесії ${sessionType} для ${tgId}`);

  try {
    // Генеруємо AI узагальнення
    await typing(ctx);
    await ctx.reply('🤖 Аналізую твої відповіді...');

    const aiSummary = await generateAISummary(tgId, sessionType, responses);

    // Зберігаємо узагальнення
    await saveAISummary(tgId, sessionType, aiSummary);

    // Отримуємо афірмацію
    const { getAffirmationAndMarkUsed } = await import('../services/affirmationService.js');
    const affirmation = await getAffirmationAndMarkUsed(sessionType);

    // Зберігаємо афірмацію
    await saveQuestionResponse(tgId, sessionType, 'affirmation', affirmation);

    // Видаляємо активну сесію
    activeSessions.delete(tgId);

    // Встановлюємо завершений крок
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);

    // Надсилаємо результат
    const sessionName = sessionType === 'morning' ? 'Ранкову' : 'Вечірню';
    const completeMessage = `✅ ${sessionName} сесію завершено!\n\n🤖 AI-АНАЛІЗ:\n${aiSummary}\n\n💎 АФІРМАЦІЯ:\n${affirmation}`;
    
    await typing(ctx);
    await ctx.reply(completeMessage, keyboards.mainMenuKeyboard());

    console.log(`[enhancedQuestionService] 🎉 Сесія ${sessionType} успішно завершена для ${tgId}`);

  } catch (error) {
    console.error('[enhancedQuestionService] ❌ Помилка завершення сесії:', error);
    
    // Fallback завершення
    activeSessions.delete(tgId);
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    
    const sessionName = sessionType === 'morning' ? 'Ранкову' : 'Вечірню';
    await ctx.reply(`✅ ${sessionName} сесію завершено!\n\n💪 Дякую за щирі відповіді! Продовжуй свій шлях до цілей.`, keyboards.mainMenuKeyboard());
  }
};

const saveQuestionResponse = async (tgId, sessionType, questionNumber, response) => {
  try {
    const today = getUserDateString(tgId);
    const tgIdString = String(tgId);

    // Знаходимо або створюємо запис
    const existingRecords = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", DATESTR({Date Response})="${today}")`,
      maxRecords: 1,
    }).firstPage();

    let fieldName;
    if (questionNumber === 'affirmation') {
      fieldName = sessionType === 'morning' ? 'affirmation_m' : 'affirmation_e';
    } else {
      fieldName = sessionType === 'morning' ? `Q_m_${questionNumber}` : `Q_e_${questionNumber}`;
    }

    const fieldsToUpdate = {
      [fieldName]: response,
      'Answer_Step': ANSWER_STEPS.COMPLETED
    };

    if (existingRecords.length > 0) {
      await base('Responses').update([{
        id: existingRecords[0].id,
        fields: fieldsToUpdate
      }]);
    } else {
      await base('Responses').create([{
        fields: {
          TG_id: tgIdString,
          'User Name': 'Користувач',
          'Date Response': today,
          ...fieldsToUpdate
        }
      }]);
    }

    console.log(`[enhancedQuestionService] ✅ Відповідь збережено: ${fieldName} = "${response.substring(0, 30)}..."`);

  } catch (error) {
    console.error('[enhancedQuestionService] ❌ Помилка збереження відповіді:', error);
  }
};

// ✅ ОБРОБКА CALLBACK ДЛЯ АКТИВНИХ СЕСІЙ
const handleSessionCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  console.log(`[enhancedQuestionService] 📱 Callback: ${data} від ${tgId}`);

  if (data === 'continue_active_session') {
    const session = getActiveSession(tgId);
    if (session) {
      const currentQ = session.getCurrentQuestion();
      if (currentQ) {
        await typing(ctx);
        await ctx.reply(`${currentQ.index + 1}️⃣/${currentQ.total} ${currentQ.question}`);
        await ctx.answerCbQuery('Продовжуємо сесію');
      } else {
        await completeQuestionSession(ctx, session);
        await ctx.answerCbQuery('Сесію завершено');
      }
    }
  } else if (data.startsWith('restart_')) {
    const sessionType = data.replace('restart_', '');
    activeSessions.delete(tgId); // Видаляємо поточну сесію
    await startQuestionSession(ctx, sessionType);
    await ctx.answerCbQuery(`Перезапуск ${sessionType} сесії`);
  } else if (data === 'exit_session') {
    activeSessions.delete(tgId);
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    await typing(ctx);
    await ctx.reply('🚪 Сесію завершено. Повертаємося до меню.', keyboards.mainMenuKeyboard());
    await ctx.answerCbQuery('Сесію завершено');
  }
};

export default {
  hasActiveSession,
  getActiveSession,
  startQuestionSession,
  handleQuestionAnswer,
  handleSessionCallback,
  completeQuestionSession
};