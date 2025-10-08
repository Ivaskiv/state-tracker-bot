import responseService from './responseService.js';
import userService from './userService.js';
import keyboards from '../utils/keyboards.js';
import logger from '../utils/logger.js';
import { QUESTIONS, ANSWER_STEPS } from '../config/constants.js';

const dailyService = {

  async handleText(ctx, text, userStep) {
    try {
      const { tgId, sessionType, questionNumber } = userStep;

      if (sessionType === 'morning') {
        await responseService.saveMorningAnswer(tgId, questionNumber, text);
      } else if (sessionType === 'evening') {
        await responseService.saveEveningAnswer(tgId, questionNumber, text);
      }

      return true;
    } catch (error) {
      logger.error('[dailyService] ❌ handleText:', error);
      throw error;
    }
  },

  async handleCallback(ctx, data) {
    // обробка кнопок, наприклад завершення сесії
    const { tgId, action } = data;
    if (action === 'exit') await this.exitSession(ctx, data.sessionType);
  },

  async startSession(ctx, type) {
    const tgId = ctx.from.id;
    console.log(`[dailyService] 🚀 startSession type="${type}" tgId=${tgId}`);

    try {
      const isMorning = type === 'morning';
      
      // Перевіряємо чи є сьогоднішній запис у Responses
      const todayRecord = await responseService._getTodayRecord(tgId);
      
if (todayRecord) {
  const fields = todayRecord.fields;
  const hasAnswers = isMorning 
    ? (fields.Q_m_1 || fields.Q_m_2 || fields.Q_m_3 || fields.Q_m_4 || fields.Q_m_5 || fields.Q_m_6)
    : (fields.Q_e_1 || fields.Q_e_2 || fields.Q_e_3 || fields.Q_e_4 || fields.Q_e_5 || fields.Q_e_6 || fields.Q_e_7);

  // Якщо відповіді є, але це після reset – не показуємо попередження
  if (hasAnswers && !fields.Current_Activity?.startsWith(isMorning ? 'Q_m' : 'Q_e')) {
    return ctx.reply(
      `⚠️ Ти вже пройшла ${isMorning ? 'ранкову' : 'вечірню'} рефлексію сьогодні!\n\n` +
      `Якщо почнеш заново, попередні відповіді будуть перезаписані.\n\n` +
      `Що робимо?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Почати заново (перезаписати)', callback_data: `restart_${type}` }],
            [{ text: '✅ Залишити як є', callback_data: 'dismiss_reminder' }],
            [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
  }
}

      // Якщо запису немає або немає відповідей - створюємо новий і стартуємо
      console.log(`[dailyService] ✅ Початок нової ${type} сесії`);
      
      // Створюємо порожній запис у Responses
      if (!todayRecord) {
        const today = new Date().toISOString().split('T')[0];
        const user = await userService.getUserByTgId(tgId);
        await responseService._createOrUpdateRecord(tgId, {
          Date_Response: today,
          'User Name': user?.['User Name'] || 'Користувач'
        });
        console.log(`[dailyService] 📝 Створено новий запис у Responses`);
      }

      // Встановлюємо початковий крок
      const initialStep = isMorning ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;
      
      await userService.updateUserFields(tgId, {
        Answer_Step: initialStep
      });

      await responseService._createOrUpdateRecord(tgId, {
        Current_Activity: initialStep
      });

      console.log(`[dailyService] ✅ Answer_Step та Current_Activity встановлено: ${initialStep}`);

      // Відправляємо перше питання
      const questions = isMorning ? QUESTIONS.morning : QUESTIONS.evening;
      const firstQuestion = questions[0];
      const totalQuestions = questions.length;

      if (!firstQuestion) {
        throw new Error(`Питання не знайдено для ${type}`);
      }

      console.log(`[dailyService] 📤 Відправка питання: ${firstQuestion.text.substring(0, 50)}...`);

      // Форматування повідомлення
      const icon = isMorning ? '🌞' : '🌙';
      const title = isMorning ? 'РАНКОВА РЕФЛЕКСІЯ' : 'ВЕЧІРНЯ РЕФЛЕКСІЯ';
      
      // Емодзі цифри
      const emojiNumbers = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
      const currentEmoji = emojiNumbers[1]; // перше питання
      
      // Витягуємо перший рядок як заголовок питання
      const questionLines = firstQuestion.text.split('\n');
      const questionTitle = questionLines[0];
      
      const message = 
        `${icon} ${title}\n\n` +
        `${currentEmoji}/${totalQuestions} ${questionTitle}\n` +
        (firstQuestion.hint ? `💡 ${firstQuestion.hint}` : '');

      await ctx.reply(
        message,
        keyboards.questionKeyboard?.(firstQuestion) || { 
          reply_markup: { remove_keyboard: true } 
        }
      );

      console.log(`[dailyService] ✅ Сесія ${type} успішно запущена`);

    } catch (error) {
      console.error(`[dailyService] ❌ startSession error:`, error);
      await ctx.reply('❌ Помилка запуску сесії. Спробуй /start', keyboards.mainMenuKeyboard());
      throw error;
    }
  },

async restartSession(ctx, type) {
  const tgId = ctx.from.id;
  console.log(`[dailyService] 🔄 restartSession type="${type}" tgId=${tgId}`);

  try {
    const isMorning = type === 'morning';
    const record = await responseService._getTodayRecord(tgId);
    if (record) {
      const fieldsToReset = {};

      if (isMorning) {
        for (let i = 1; i <= 6; i++) fieldsToReset[`Q_m_${i}`] = null;
        fieldsToReset.affirmation_m = null;
        fieldsToReset.Current_Activity = null;
      } else {
        for (let i = 1; i <= 7; i++) fieldsToReset[`Q_e_${i}`] = null;
        fieldsToReset.affirmation_e = null;
        fieldsToReset.Actions_Completed_Count = null;
        fieldsToReset.Actions_Completed_List = null;
        fieldsToReset.Actions_Skipped_List = null;
        fieldsToReset.Completion_Rate = null;
        fieldsToReset.Current_Activity = null;
      }

      await responseService._createOrUpdateRecord(tgId, fieldsToReset);
      console.log(`[dailyService] 🧹 Скинуто попередні відповіді для ${type}`);
    }

    // Скидаємо Answer_Step на початковий
    const initialStep = isMorning ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;
    await userService.updateUserFields(tgId, { Answer_Step: initialStep });

    // Запускаємо сесію заново
    return this.startSession(ctx, type);

  } catch (error) {
    console.error(`[dailyService] ❌ restartSession error:`, error);
    await ctx.reply('❌ Помилка перезапуску сесії. Спробуй ще раз.');
    throw error;
  }
},
  async continueEveningSession(ctx) {
    const tgId = ctx.from.id;
    console.log(`[dailyService] ▶️ continueEveningSession tgId=${tgId}`);

    try {
      const user = await userService.getUserByTgId(tgId);
      const currentStep = user?.Answer_Step;

      if (!currentStep || currentStep === 'completed') {
        return this.startSession(ctx, 'evening');
      }

      // Знаходимо номер поточного питання (Q_e_1, Q_e_2...)
      const match = currentStep.match(/Q_e_(\d+)/i);
      if (!match) {
        return this.startSession(ctx, 'evening');
      }

      const questionNum = parseInt(match[1], 10);
      const question = QUESTIONS.evening[questionNum - 1];
      const totalQuestions = QUESTIONS.evening.length;

      if (!question) {
        return this.startSession(ctx, 'evening');
      }

      // Емодзі цифри
      const emojiNumbers = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
      const currentEmoji = emojiNumbers[questionNum];

      // Витягуємо перший рядок як заголовок питання
      const questionLines = question.text.split('\n');
      const questionTitle = questionLines[0];

      const message = 
        `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ\n\n` +
        `${currentEmoji}/${totalQuestions} ${questionTitle}\n` +
        (question.hint ? `💡 ${question.hint}` : '');

      await ctx.reply(
        message,
        keyboards.questionKeyboard?.(question) || { reply_markup: { remove_keyboard: true } }
      );

      console.log(`[dailyService] ✅ Продовжено з питання ${questionNum}`);

    } catch (error) {
      console.error('[dailyService] ❌ continueEveningSession error:', error);
      await ctx.reply('❌ Помилка. Розпочнімо спочатку?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌙 Почати спочатку', callback_data: 'start_evening' }],
            [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
          ]
        }
      });
    }
  },

  async exitSession(ctx, type) {
    const tgId = ctx.from.id;
    console.log(`[dailyService] 🚪 exitSession type="${type}" tgId=${tgId}`);

    try {
      await responseService.saveAffirmationAndFinalize(tgId, type, null);
      await userService.updateUserFields(tgId, {
        Answer_Step: 'completed'
      });

      await ctx.reply(
        `✅ Сесію ${type === 'morning' ? 'ранкову' : 'вечірню'} завершено!`,
        keyboards.mainMenuKeyboard()
      );

      console.log(`[dailyService] ✅ Сесія ${type} завершена`);

    } catch (error) {
      console.error('[dailyService] ❌ exitSession error:', error);
      await ctx.reply('❌ Помилка завершення сесії');
    }
  }
};

export default dailyService;