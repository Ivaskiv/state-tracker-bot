import { userService } from '../services/userService.js';
import { MESSAGES } from '../utils/messages.js';
import { skipKeyboard, subscriptionKeyboard, removeKeyboard } from '../utils/keyboards.js';

class RegistrationHandler {
  async handleName(ctx, name) {
    try {
      if (!name || name.length < 2) {
        await ctx.reply('⚠️ Ім\'я має містити принаймні 2 символи. Спробуй ще раз:');
        return;
      }

      ctx.session.tempData = { name: name.trim() };
      ctx.session.step = 'registration_email';
      await ctx.reply(MESSAGES.REGISTRATION_EMAIL, skipKeyboard());
    } catch (error) {
      console.error('Error handling name:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  }

  async handleEmail(ctx, email) {
    try {
      if (email && !userService.validateEmail(email)) {
        await ctx.reply('⚠️ Некоректний email. Спробуй ще раз або натисни "Пропустити":');
        return;
      }

      ctx.session.tempData.email = email ? email.trim() : '';
      ctx.session.step = 'registration_phone';
      await ctx.reply(MESSAGES.REGISTRATION_PHONE, skipKeyboard());
    } catch (error) {
      console.error('Error handling email:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  }

  async handlePhone(ctx, phone) {
    try {
      let formattedPhone = '';
      if (phone && phone !== '⏭️ Пропустити') {
        if (!userService.validatePhone(phone)) {
          await ctx.reply('⚠️ Некоректний номер телефону. Спробуй у форматі +380XXXXXXXXX або натисни "Пропустити":');
          return;
        }
        formattedPhone = userService.formatPhone(phone);
      }

      ctx.session.tempData.phone = formattedPhone;

      const userData = {
        name: ctx.session.tempData.name,
        email: ctx.session.tempData.email,
        phone: ctx.session.tempData.phone,
        telegramId: ctx.from.id
      };

      await userService.createUser(userData);
      ctx.session = {};

      await ctx.reply(MESSAGES.REGISTRATION_COMPLETE, removeKeyboard());
      await ctx.reply(MESSAGES.SUBSCRIPTION_INFO, subscriptionKeyboard());
    } catch (error) {
      console.error('Error handling phone:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  }

  async skipField(ctx) {
    try {
      switch (ctx.session.step) {
        case 'registration_email':
          await this.handleEmail(ctx, '');
          break;
        case 'registration_phone':
          await this.handlePhone(ctx, '');
          break;
        default:
          await ctx.reply('Немає поля для пропуску');
      }
    } catch (error) {
      console.error('Error skipping field:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  }

  async checkExistingUser(telegramId) {
    try {
      return await userService.getUserByTelegramId(telegramId);
    } catch (error) {
      console.error('Error checking existing user:', error);
      return null;
    }
  }

  async resetRegistration(ctx) {
    ctx.session = {};
    await ctx.reply('Реєстрацію скинуто. Почни заново командою /start');
  }
}

export default new RegistrationHandler();
