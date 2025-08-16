// services/telegramBot.js
import TelegramBot from 'node-telegram-bot-api';
import { AirtableService } from './airtableService.js';
import { RegistrationHandler } from '../handlers/registrationHandler.js';
import { QuestionHandler } from '../handlers/questionHandler.js';
import { MenuHandler } from '../handlers/menuHandler.js';
import { REGISTRATION_STATES } from '../utils/constants.js';

class TelegramBotService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
      polling: true,
      request: {
        agentOptions: {
          keepAlive: true,
          family: 4
        }
      }
    });
    
    this.setupHandlers();
  }

  setupHandlers() {
    // Обробка команд
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/menu/, (msg) => this.handleMenu(msg));
    this.bot.onText(/\/status/, (msg) => this.handleStatus(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));

    // Обробка текстових повідомлень
    this.bot.on('message', (msg) => this.handleMessage(msg));
    
    // Обробка callback кнопок
    this.bot.on('callback_query', (query) => this.handleCallbackQuery(query));

    // Обробка помилок
    this.bot.on('error', (error) => {
      console.error('Telegram bot error:', error);
    });

    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });

    console.log('🤖 Telegram bot handlers initialized');
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'Друже';
    const telegramId = msg.from.id;

    try {
      // Перевіряємо чи користувач вже зареєстрований
      const existingUser = await AirtableService.getUserByTelegramId(telegramId);
      
      if (existingUser) {
        const subscriptionStatus = existingUser.get('Active_Subscription_Status');
        
        if (subscriptionStatus && subscriptionStatus.includes('✅ Активна')) {
          // Користувач з активною підпискою
          await this.bot.sendMessage(chatId, `👋 З поверненням, ${existingUser.get('User Name')}! 

🎉 Твоя підписка активна: ${subscriptionStatus}

Що будемо робити сьогодні?`);
          
          setTimeout(() => {
            MenuHandler.showMainMenu(this.bot, chatId);
          }, 1500);
        } else {
          // Користувач з неактивною підпискою
          await this.bot.sendMessage(chatId, `👋 Привіт, ${existingUser.get('User Name')}!

❌ Твоя підписка закінчилася: ${subscriptionStatus}

💡 Хочеш поновити підписку? Зверніться до підтримки: nadyastarway@gmail.com`);
        }
      } else {
        // Новий користувач - запускаємо реєстрацію
        await RegistrationHandler.startRegistration(this.bot, chatId, userName);
      }
    } catch (error) {
      console.error('Error in handleStart:', error);
      await this.bot.sendMessage(chatId, "❌ Помилка підключення. Спробуйте пізніше або зверніться до підтримки.");
    }
  }

  async handleMenu(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const user = await AirtableService.getUserByTelegramId(telegramId);
    if (this.checkUserAccess(user, chatId)) {
      await MenuHandler.showMainMenu(this.bot, chatId);
    }
  }

  async handleStatus(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const user = await AirtableService.getUserByTelegramId(telegramId);
    if (this.checkUserAccess(user, chatId)) {
      await MenuHandler.showMyStatus(this.bot, chatId, telegramId);
    }
  }

  async handleHelp(msg) {
    const chatId = msg.chat.id;
    const helpMessage = `ℹ️ **ДОВІДКА**

🔸 **/start** — почати роботу з ботом
🔸 **/menu** — головне меню
🔸 **/status** — мій статус та підписка
🔸 **"+"** або **"ок"** — швидка афірмація

📋 **Як користуватися:**
1. Відповідайте на ранкові питання о 08:00
2. Завершуйте день вечірніми питаннями о 20:30
3. Отримуйте щотижневі та місячні AI-звіти

💬 **Підтримка:** nadyastarway@gmail.com`;

    await this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  }

  async handleMessage(msg) {
    // Ігноруємо команди - вони оброблені окремо
    if (msg.text?.startsWith('/')) return;

    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const telegramId = msg.from.id;

    // Швидкі афірмації
    if (text === '+' || text?.toLowerCase() === 'ок' || text?.toLowerCase() === 'ok') {
      await MenuHandler.sendQuickAffirmation(this.bot, chatId);
      return;
    }

    // Перевіряємо чи користувач в процесі реєстрації
    const registrationSession = RegistrationHandler.getSessionState(chatId);
    if (registrationSession) {
      await this.handleRegistrationMessage(chatId, text, registrationSession);
      return;
    }

    // Перевіряємо чи користувач відповідає на питання
    const questionSession = QuestionHandler.getQuestionSession(chatId);
    if (questionSession) {
      await QuestionHandler.handleQuestionAnswer(this.bot, chatId, text);
      return;
    }

    // Перевіряємо чи користувач зареєстрований
    const user = await AirtableService.getUserByTelegramId(telegramId);
    if (!user) {
      await this.bot.sendMessage(chatId, "👋 Привіт! Для початку роботи натисніть /start");
      return;
    }

    // Для зареєстрованих користувачів - показуємо меню або обробляємо запити
    if (text?.toLowerCase().includes('меню') || text?.toLowerCase().includes('menu')) {
      await MenuHandler.showMainMenu(this.bot, chatId);
    } else if (text?.toLowerCase().includes('афірмац') || text?.toLowerCase().includes('підтрим')) {
      await MenuHandler.sendQuickAffirmation(this.bot, chatId);
    } else if (text?.toLowerCase().includes('звіт') || text?.toLowerCase().includes('аналіз')) {
      await MenuHandler.showReportsMenu(this.bot, chatId);
    } else {
      // Загальна підтримка з контекстом
      const supportMessage = `💬 Дякую за повідомлення!

Я можу допомогти тобі з:
• 🌅 Ранковими питаннями
• 🌙 Вечірніми питаннями  
• 📊 Звітами та аналітикою
• ✨ Афірмаціями для підтримки

Напиши "+" для швидкої афірмації або використовуй /menu для повного меню.`;

      await this.bot.sendMessage(chatId, supportMessage);
    }
  }

  async handleRegistrationMessage(chatId, text, session) {
    const telegramId = chatId; // В Telegram chatId = user.id для приватних чатів

    switch (session.state) {
      case REGISTRATION_STATES.AWAITING_NAME:
        if (text && text.length > 1 && text.length < 50) {
          await RegistrationHandler.handleName(this.bot, chatId, text);
        } else {
          await this.bot.sendMessage(chatId, "❌ Будь ласка, введіть коректне ім'я (2-50 символів)");
        }
        break;

      case REGISTRATION_STATES.AWAITING_PHONE:
        if (this.validatePhone(text)) {
          await RegistrationHandler.handlePhone(this.bot, chatId, text);
        } else {
          await this.bot.sendMessage(chatId, "❌ Неправильний формат телефону. Приклад: +380501234567");
        }
        break;

      case REGISTRATION_STATES.AWAITING_EMAIL:
        if (this.validateEmail(text)) {
          await RegistrationHandler.handleEmail(this.bot, chatId, text);
        } else {
          await this.bot.sendMessage(chatId, "❌ Неправильний формат email. Приклад: example@gmail.com");
        }
        break;

      default:
        await this.bot.sendMessage(chatId, "❓ Не зрозумів. Спробуй ще раз або натисни /start");
    }
  }

  async handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const data = query.data;
    const telegramId = query.from.id;
    const userName = query.from.first_name;

    // Відповідаємо на callback щоб прибрати "годинник" з кнопки
    await this.bot.answerCallbackQuery(query.id);

    try {
      switch (data) {
        // Реєстрація
        case 'plan_week':
        case 'plan_month':  
        case 'plan_year':
          const planType = data.split('_')[1];
          await RegistrationHandler.handlePlanSelection(this.bot, chatId, planType);
          break;

        case 'confirm_registration':
          await RegistrationHandler.confirmRegistration(this.bot, chatId, telegramId, userName);
          break;

        case 'edit_registration':
          await RegistrationHandler.editRegistration(this.bot, chatId);
          break;

        // Питання
        case 'start_morning':
          await QuestionHandler.handleQuestionStart(this.bot, chatId, 'morning');
          break;

        case 'start_evening':
          await QuestionHandler.handleQuestionStart(this.bot, chatId, 'evening');
          break;

        case 'morning_questions':
          const user1 = await AirtableService.getUserByTelegramId(telegramId);
          if (this.checkUserAccess(user1, chatId)) {
            await QuestionHandler.startMorningQuestions(this.bot, chatId, user1);
          }
          break;

        case 'evening_questions':
          const user2 = await AirtableService.getUserByTelegramId(telegramId);
          if (this.checkUserAccess(user2, chatId)) {
            await QuestionHandler.startEveningQuestions(this.bot, chatId, user2);
          }
          break;

        case 'skip_question':
          await QuestionHandler.skipQuestion(this.bot, chatId);
          break;

        case 'remind_later_morning':
          await QuestionHandler.remindLater(this.bot, chatId, 'morning');
          break;

        case 'remind_later_evening':
          await QuestionHandler.remindLater(this.bot, chatId, 'evening');
          break;

        // Меню
        case 'main_menu':
          await MenuHandler.showMainMenu(this.bot, chatId);
          break;

        case 'my_status':
          await MenuHandler.showMyStatus(this.bot, chatId, telegramId);
          break;

        case 'reports_menu':
          await MenuHandler.showReportsMenu(this.bot, chatId);
          break;

        case 'weekly_report':
          await MenuHandler.generateWeeklyReport(this.bot, chatId, telegramId);
          break;

        case 'monthly_report':
          await MenuHandler.generateMonthlyReport(this.bot, chatId, telegramId);
          break;

        case 'get_affirmation':
          await MenuHandler.sendQuickAffirmation(this.bot, chatId);
          break;

        case 'support':
          await MenuHandler.showSupport(this.bot, chatId);
          break;

        default:
          await this.bot.sendMessage(chatId, "❓ Невідома команда. Використовуйте /menu");
      }
    } catch (error) {
      console.error('Error handling callback query:', error);
      await this.bot.sendMessage(chatId, "❌ Помилка обробки запиту. Спробуйте ще раз.");
    }
  }

  checkUserAccess(user, chatId) {
    if (!user) {
      this.bot.sendMessage(chatId, "❌ Користувач не знайдений. Використовуйте /start для реєстрації.");
      return false;
    }

    const subscriptionStatus = user.get('Active_Subscription_Status');
    if (!subscriptionStatus || !subscriptionStatus.includes('✅ Активна')) {
      this.bot.sendMessage(chatId, `❌ Ваша підписка неактивна: ${subscriptionStatus || 'Немає підписки'}

💡 Для поновлення зверніться до підтримки: nadyastarway@gmail.com`);
      return false;
    }

    return true;
  }

  validatePhone(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone?.replace(/\s/g, ''));
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  startPolling() {
    console.log('🤖 Telegram bot polling started');
  }

  stopPolling() {
    this.bot.stopPolling();
    console.log('🤖 Telegram bot polling stopped');
  }
}

export const telegramBot = new TelegramBotService();