// handlers/questionHandler.js
import { AirtableService } from '../services/airtableService.js';
import { AIAnalytics } from '../services/aiAnalytics.js';
import { MORNING_QUESTIONS, EVENING_QUESTIONS } from '../utils/constants.js';
import { createInlineKeyboard } from '../utils/helpers.js';

export class QuestionHandler {
  static userQuestionSessions = new Map();

  static async startMorningQuestions(bot, chatId, user) {
    const session = {
      type: 'morning',
      userId: user.id,
      userName: user.get('User Name'),
      telegramId: user.get('TG_id'),
      currentQuestion: 0,
      answers: {},
      startTime: new Date()
    };

    this.userQuestionSessions.set(chatId, session);

    const welcomeMessage = `🌅 **ДОБРОГО РАНКУ!**

Час для ранкової рефлексії. Ці питання допоможуть тобі:
• Налаштуватись на день
• Сфокусуватись на цілях  
• Вибрати ресурсний стан
• Підвищити самоцінність

✨ Готова почати? (6 питань, ~3 хвилини)`;

    const keyboard = createInlineKeyboard([
      [{ text: '🚀 Почати ранкові питання', callback_data: 'start_morning' }],
      [{ text: '⏰ Нагадати через 15 хвилин', callback_data: 'remind_later_morning' }]
    ]);

    await bot.sendMessage(chatId, welcomeMessage, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }

  static async startEveningQuestions(bot, chatId, user) {
    const session = {
      type: 'evening',
      userId: user.id,
      userName: user.get('User Name'),
      telegramId: user.get('TG_id'),
      currentQuestion: 0,
      answers: {},
      startTime: new Date()
    };

    this.userQuestionSessions.set(chatId, session);

    const welcomeMessage = `🌙 **ДОБРИЙ ВЕЧІР!**

Час для вечірньої рефлексії. Ці питання допоможуть:
• Підсумувати день
• Усвідомити свої реакції
• Зафіксувати перемоги
• Виявити блокуючі програми

✨ Готова до аналізу дня? (5 питань, ~3 хвилини)`;

    const keyboard = createInlineKeyboard([
      [{ text: '🌟 Почати вечірні питання', callback_data: 'start_evening' }],
      [{ text: '⏰ Нагадати через 15 хвилин', callback_data: 'remind_later_evening' }]
    ]);

    await bot.sendMessage(chatId, welcomeMessage, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }

  static async handleQuestionStart(bot, chatId, type) {
    const session = this.userQuestionSessions.get(chatId);
    if (!session) return;

    session.currentQuestion = 1;
    await this.askCurrentQuestion(bot, chatId);
  }

  static async askCurrentQuestion(bot, chatId) {
    const session = this.userQuestionSessions.get(chatId);
    if (!session) return;

    const questions = session.type === 'morning' ? MORNING_QUESTIONS : EVENING_QUESTIONS;
    const currentQ = questions[session.currentQuestion - 1];

    if (!currentQ) {
      await this.completeQuestions(bot, chatId);
      return;
    }

    const progressText = `${session.currentQuestion}/${questions.length}`;
    const questionMessage = `📝 **Питання ${progressText}**

${currentQ.text}

${currentQ.example || ''}`;

    const keyboard = createInlineKeyboard([
      [{ text: '⏭️ Пропустити', callback_data: 'skip_question' }]
    ]);

    await bot.sendMessage(chatId, questionMessage, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }

  static async handleQuestionAnswer(bot, chatId, answer) {
    const session = this.userQuestionSessions.get(chatId);
    if (!session) return;

    const questionKey = `question${session.currentQuestion}`;
    session.answers[questionKey] = answer;

    // Переходимо до наступного питання
    session.currentQuestion++;
    
    // Показуємо підтвердження отримання відповіді
    await bot.sendMessage(chatId, "✅ Відповідь збережено!");
    
    setTimeout(async () => {
      await this.askCurrentQuestion(bot, chatId);
    }, 1000);
  }

  static async skipQuestion(bot, chatId) {
    const session = this.userQuestionSessions.get(chatId);
    if (!session) return;

    session.currentQuestion++;
    await bot.sendMessage(chatId, "⏭️ Питання пропущено");
    
    setTimeout(async () => {
      await this.askCurrentQuestion(bot, chatId);
    }, 800);
  }

  static async completeQuestions(bot, chatId) {
    const session = this.userQuestionSessions.get(chatId);
    if (!session) return;

    try {
      // Зберігаємо відповіді
      if (session.type === 'morning') {
        await AirtableService.saveMorningResponse({
          userId: session.userId,
          userName: session.userName,
          telegramId: session.telegramId,
          ...session.answers
        });
      } else {
        await AirtableService.saveEveningResponse({
          userId: session.userId,
          userName: session.userName,
          telegramId: session.telegramId,
          ...session.answers
        });
      }

      // Генеруємо AI аналіз для вечірніх питань
      let aiAnalysis = '';
      let affirmation = '';
      
      if (session.type === 'evening') {
        const reflectionData = {
          state: session.answers.question5 || '',
          goal: session.answers.question4 || '',
          energyGain: session.answers.question1 || '',
          energyLoss: session.answers.question2 || '',
          programs: session.answers.question3 || '',
          victory: session.answers.question5 || ''
        };

        aiAnalysis = await AIAnalytics.generateDailyAnalysis(reflectionData);
        affirmation = await AIAnalytics.generateAffirmation();

        // Зберігаємо рефлексію з аналізом
        await AirtableService.saveUserReflection({
          userName: session.userName,
          userId: session.userId,
          telegramId: session.telegramId,
          questionType: session.type,
          userResponse: Object.values(session.answers).join(' | '),
          state: reflectionData.state,
          goal: reflectionData.goal,
          energyGain: reflectionData.energyGain,
          energyLoss: reflectionData.energyLoss,
          programs: reflectionData.programs,
          victory: reflectionData.victory,
          aiAnalytics: aiAnalysis,
          affirmation: affirmation
        });
      } else {
        affirmation = await AIAnalytics.generateAffirmation();
      }

      // Відправляємо результат
      const completionMessage = session.type === 'morning' 
        ? await this.getMorningCompletionMessage(affirmation)
        : await this.getEveningCompletionMessage(aiAnalysis, affirmation);

      await bot.sendMessage(chatId, completionMessage, { parse_mode: 'Markdown' });

      // Показуємо меню
      setTimeout(async () => {
        const { MenuHandler } = await import('./menuHandler.js');
        await MenuHandler.showMainMenu(bot, chatId);
      }, 3000);

    } catch (error) {
      console.error('Error completing questions:', error);
      await bot.sendMessage(chatId, "❌ Помилка збереження відповідей. Спробуй ще раз пізніше.");
    }

    // Очищаємо сесію
    this.userQuestionSessions.delete(chatId);
  }

  static async getMorningCompletionMessage(affirmation) {
    return `✅ **РАНКОВІ ПИТАННЯ ЗАВЕРШЕНО!**

🎯 **Твій фокус на день встановлено!**

Тепер ти:
• Визначила свою роль на сьогодні
• Сфокусувалась на головній цілі
• Обрала ресурсний стан
• Підтвердила свою самоцінність

🌀 **Афірмація на день:**
*"${affirmation}"*

🌟 Нехай цей день стане кроком до твоєї мети!
Увечері о 20:30 я нагадаю про вечірні питання.`;
  }

  static async getEveningCompletionMessage(aiAnalysis, affirmation) {
    return `✅ **ВЕЧІРНІ ПИТАННЯ ЗАВЕРШЕНО!**

🔍 **AI-АНАЛІЗ ТВОГО ДНЯ:**

${aiAnalysis}

🌀 **Афірмація на вечір:**
*"${affirmation}"*

🌟 Підсумкова фраза:
*"Я вдячна цьому дню. Я стала сильнішою. Я обираю рухатися далі — до себе справжньої."*

💤 Гарного відпочинку! Завтра о 08:00 почнемо новий день разом.`;
  }

  static async remindLater(bot, chatId, type) {
    const message = type === 'morning' 
      ? "⏰ Добре! Нагадаю тобі через 15 хвилин про ранкові питання."
      : "⏰ Добре! Нагадаю тобі через 15 хвилин про вечірні питання.";

    await bot.sendMessage(chatId, message);

    // Встановлюємо таймер на 15 хвилин
    setTimeout(async () => {
      const user = await AirtableService.getUserByTelegramId(chatId);
      if (user) {
        if (type === 'morning') {
          await this.startMorningQuestions(bot, chatId, user);
        } else {
          await this.startEveningQuestions(bot, chatId, user);
        }
      }
    }, 15 * 60 * 1000); // 15 хвилин
  }

  static getQuestionSession(chatId) {
    return this.userQuestionSessions.get(chatId);
  }

  static clearSession(chatId) {
    this.userQuestionSessions.delete(chatId);
  }
}