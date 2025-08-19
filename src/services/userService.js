import { tables } from '../config/database.js';

export const userService = {
  // === User CRUD ===
  async createUser(userData) {
    try {
      const record = await tables.users.create([
        {
          fields: {
            telegram_id: userData.telegramId.toString(),
            name: userData.name,
            username: userData.username || '',
            phone: userData.phone || '',
            email: userData.email || '',
            created_at: new Date().toISOString(),
            is_active: true,
            timezone: 'Europe/Kiev'
          }
        }
      ]);
      console.log('User created:', record[0].id);
      return record[0];
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  },

  async findUser(telegramId) {
    try {
      const records = await tables.users
        .select({ filterByFormula: `{telegram_id} = "${telegramId}"` })
        .firstPage();

      return records.length > 0
        ? { id: records[0].id, ...records[0].fields }
        : null;
    } catch (error) {
      console.error('Find user error:', error);
      throw error;
    }
  },

  async getUserByTelegramId(telegramId) {
    return this.findUser(telegramId);
  },

  async updateUser(telegramId, updateData) {
    try {
      const user = await this.findUser(telegramId);
      if (!user) throw new Error('User not found');

      const record = await tables.users.update([
        {
          id: user.id,
          fields: { ...updateData, updated_at: new Date().toISOString() }
        }
      ]);
      return record[0];
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  },

  // === Validation / Formatting ===
  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  validatePhone(phone) {
    const re = /^\+380\d{9}$/;
    return re.test(phone);
  },

  formatPhone(phone) {
    return phone.replace(/\s+/g, '');
  }
};
export default userService;
