import { getBase, tables } from '../config/database.js';

const userService = {
  // Отримати користувача по Telegram ID
  async getUserByTelegramId(telegramId) {
    const base = getBase();
    const records = await base(tables.USERS)
      .select({ filterByFormula: `{telegram_id} = "${telegramId}"` })
      .firstPage();
    return records.length ? { id: records[0].id, ...records[0].fields } : null;
  },

  // Перевірити, чи користувач має активну підписку
  async hasActiveSubscription(telegramId) {
    const base = getBase();
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return false;

    const subscriptions = await base(tables.SUBSCRIPTIONS)
      .select({ filterByFormula: `{user_id} = "${user.id}"` })
      .firstPage();

    return subscriptions.some(sub => sub.fields.status?.toLowerCase() === 'active');
  },

  // Валідація email
  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  // Валідація телефону
  validatePhone(phone) {
    const re = /^\+380\d{9}$/;
    return re.test(phone);
  },

  // Форматування телефону
  formatPhone(phone) {
    return phone.replace(/\s+/g, '');
  },

  // Створення нового користувача
  async createUser(userData) {
    const base = getBase();
    return base(tables.USERS).create([{ fields: userData }]);
  }
};

export default userService;
