// handlers/registrationHandler.js
import userService from '../services/userService.js';
import { MESSAGES } from '../../utils/messages.js';
import { skipKeyboard, subscriptionKeyboard, removeKeyboard } from '../../utils/keyboards.js';

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
      
      // Create user
      const userData = {
        name: ctx.session.tempData.name,
        email: ctx.session.tempData.email,
        phone: ctx.session.tempData.phone,
        telegramId: ctx.from.id
      };

      await userService.createUser(userData);
      
      // Clear session
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

  async validateRegistration(userData) {
    const errors = [];

    if (!userData.name || userData.name.length < 2) {
      errors.push('Ім\'я має містити принаймні 2 символи');
    }

    if (userData.email && !userService.validateEmail(userData.email)) {
      errors.push('Некоректний email');
    }

    if (userData.phone && !userService.validatePhone(userData.phone)) {
      errors.push('Некоректний номер телефону');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
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

  async getRegistrationProgress(ctx) {
    const step = ctx.session.step;
    const tempData = ctx.session.tempData || {};

    switch (step) {
      case 'registration_name':
        return 'Очікую твоє ім\'я';
      case 'registration_email':
        return `Ім\'я: ${tempData.name}\nОчікую email`;
      case 'registration_phone':
        return `Ім\'я: ${tempData.name}\nEmail: ${tempData.email || 'не вказано'}\nОчікую номер телефону`;
      default:
        return 'Реєстрація не розпочата';
    }
  }

  async resumeRegistration(ctx) {
    try {
      const progress = await this.getRegistrationProgress(ctx);
      await ctx.reply(`📝 Продовження реєстрації:\n\n${progress}`);

      switch (ctx.session.step) {
        case 'registration_name':
          await ctx.reply(MESSAGES.REGISTRATION_START, removeKeyboard());
          break;
        case 'registration_email':
          await ctx.reply(MESSAGES.REGISTRATION_EMAIL, skipKeyboard());
          break;
        case 'registration_phone':
          await ctx.reply(MESSAGES.REGISTRATION_PHONE, skipKeyboard());
          break;
        default:
          await ctx.reply(MESSAGES.REGISTRATION_START, removeKeyboard());
          ctx.session.step = 'registration_name';
      }
    } catch (error) {
      console.error('Error resuming registration:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  }
}

export default new RegistrationHandler();