// handlers/registrationHandler.js
import { AirtableService } from '../services/airtableService.js';
import { SUBSCRIPTION_PLANS, REGISTRATION_STATES } from '../utils/constants.js';
import { createInlineKeyboard } from '../utils/helpers.js';

export class RegistrationHandler {
  static userSessions = new Map();

  static async startRegistration(bot, chatId, userName) {
    const welcomeMessage = `
🌟 Привіт, ${userName}! Вітаю в AI-Коучі особистого зростання!

💰 **Що це таке?**
Твій персональний помічник для щоденної рефлексії, досягнення цілей та внутрішньої трансформації.

🔥 **Що ти отримаєш:**
• Щоденні ранкові питання для фокусу (08:00)
• Вечірні питання для аналізу дня (20:30)
• AI-звіти щотижня та щомісяця
• Персональні афірмації та підтримку 24/7

✨ **Як це працює:**
Просто відповідай на питання бота щодня, а він аналізує твої шаблони та дає рекомендації для зростання.

Готова почати трансформацію? 
Спочатку давай познайомимося!`;

    await bot.sendMessage(chatId, welcomeMessage);
    
    setTimeout(async () => {
      await this.askForName(bot, chatId);
    }, 2000);
  }

  static async askForName(bot, chatId) {
    this.userSessions.set(chatId, { 
      state: REGISTRATION_STATES.AWAITING_NAME 
    });

    await bot.sendMessage(chatId, "👋 Як тебе звати? (Введи своє ім'я)");
  }

  static async handleName(bot, chatId, name) {
    const session = this.userSessions.get(chatId);
    session.name = name;
    session.state = REGISTRATION_STATES.AWAITING_PHONE;

    await bot.sendMessage(chatId, `Приємно познайомитись, ${name}! 📱 

Тепер введи свій номер телефону (наприклад: +380501234567):`);
  }

  static async handlePhone(bot, chatId, phone) {
    const session = this.userSessions.get(chatId);
    session.phone = phone;
    session.state = REGISTRATION_STATES.AWAITING_EMAIL;

    await bot.sendMessage(chatId, "📧 Введи свій email адрес:");
  }

  static async handleEmail(bot, chatId, email) {
    const session = this.userSessions.get(chatId);
    session.email = email;
    session.state = REGISTRATION_STATES.SELECTING_PLAN;

    await this.showSubscriptionPlans(bot, chatId);
  }

  static async showSubscriptionPlans(bot, chatId) {
    const plansMessage = `
💰 **ОБЕРІТЬ ПЛАН ПІДПИСКИ:**

🔹 **Тиждень фокусу — 7€**
Ідеально для короткого фокусу або тесту системи.

🔹 **Місяць дії — 30€**
Глибинна робота з твоїми цілями та стратегією.

🔹 **Рік трансформації — 300€**
Максимальна економія та підтримка протягом року.

⚡️ Оберіть план, який вам підходить:`;

    const keyboard = createInlineKeyboard([
      [{ text: '🔹 Тиждень - 7€', callback_data: 'plan_week' }],
      [{ text: '🔹 Місяць - 30€', callback_data: 'plan_month' }],
      [{ text: '🔹 Рік - 300€', callback_data: 'plan_year' }]
    ]);

    await bot.sendMessage(chatId, plansMessage, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }

  static async handlePlanSelection(bot, chatId, planType) {
    const session = this.userSessions.get(chatId);
    const plan = SUBSCRIPTION_PLANS[planType];
    
    session.selectedPlan = plan;
    session.state = REGISTRATION_STATES.CONFIRMING_REGISTRATION;

    const confirmMessage = `
✅ **ПІДТВЕРДЖЕННЯ РЕЄСТРАЦІЇ**

👤 **Ім'я:** ${session.name}
📱 **Телефон:** ${session.phone}
📧 **Email:** ${session.email}
💳 **План:** ${plan.name} (${plan.price}€)

💡 **Що далі:**
Після підтвердження ти отримаєш:
• Щоденні нагадування в 08:00 та 20:30
• AI-аналіз твоїх відповідей
• Персональні рекомендації для зростання

Все правильно?`;

    const keyboard = createInlineKeyboard([
      [{ text: '✅ Підтвердити', callback_data: 'confirm_registration' }],
      [{ text: '✏️ Редагувати дані', callback_data: 'edit_registration' }]
    ]);

    await bot.sendMessage(chatId, confirmMessage, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }

  static async confirmRegistration(bot, chatId, telegramId, userName) {
    const session = this.userSessions.get(chatId);
    
    try {
      // Створюємо користувача в Airtable
      const user = await AirtableService.createUser({
        name: session.name,
        telegramId: telegramId,
        email: session.email,
        phone: session.phone,
        timezone: 'Europe/Kiev'
      });

      // Створюємо підписку
      const subscription = await AirtableService.createSubscription({
        userId: user.id,
        userName: session.name,
        userPhone: session.phone,
        userEmail: session.email,
        telegramId: telegramId,
        planName: session.selectedPlan.name,
        planType: session.selectedPlan.type,
        duration: session.selectedPlan.duration,
        amount: session.selectedPlan.price
      });

      // Оновлюємо статус користувача
      await AirtableService.updateUser(user.id, {
        'UserRegistered': true,
        'Status': 'Active User',
        'Subscription Status': 'Active',
        'Active Subscription Plan': session.selectedPlan.name
      });

      const successMessage = `
🎉 **ВІТАЄМО! РЕЄСТРАЦІЯ ЗАВЕРШЕНА!**

✅ Твій план "${session.selectedPlan.name}" активовано!

🌅 **Що далі:**
• **Завтра о 08:00** — отримаєш перші ранкові питання
• **Завтра о 20:30** — вечірні питання для рефлексії
• **Кожної неділі** — AI-звіт твого тижня
• **1-го числа** — місячна аналітика

💬 **Швидкі команди:**
• Напиши "+" для миттєвої афірмації
• /menu — головне меню
• /status — статус підписки

🚀 **Твоя трансформація починається зараз!**
Готуйся до першого ранку з новим усвідомленням себе.`;

      await bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
      
      // Показуємо головне меню
      setTimeout(async () => {
        const { MenuHandler } = await import('./menuHandler.js');
        await MenuHandler.showMainMenu(bot, chatId);
      }, 3000);

      // Очищаємо сесію
      this.userSessions.delete(chatId);

    } catch (error) {
      console.error('Registration error:', error);
      await bot.sendMessage(chatId, `❌ Помилка при реєстрації. Спробуй ще раз або звернись до підтримки: nadyastarway@gmail.com`);
    }
  }

  static async editRegistration(bot, chatId) {
    this.userSessions.delete(chatId);
    await this.askForName(bot, chatId);
  }

  static getSessionState(chatId) {
    return this.userSessions.get(chatId);
  }

  static clearSession(chatId) {
    this.userSessions.delete(chatId);
  }
}