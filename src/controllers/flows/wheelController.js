// src/controllers/flows/wheelController.js - КОНТРОЛЕР КОЛЕСА БАЛАНСУ

import userService from '../../services/userService.js';
import wheelBalanceService from '../../services/wheelBalanceService.js';
import keyboards from '../../utils/keyboards.js';
import path from 'path';

const wheelController = {
  
  // ===== ПОЧАТКОВИЙ ЗАПИТ =====
  async handleRequest(ctx) {
    const tgId = ctx.from.id;
    
    console.log(`[WHEEL] 🎯 Запит на колесо від ${tgId}`);
    
    try {
      
      const user = await userService.getUserByTgId(tgId);
      
      // Перевіряємо доступ
      if (!userService.hasActiveAccess(user)) {
        await this.showAccessDenied(ctx);
        return;
      }
      
      // Перевіряємо активне колесо
      const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
      
      if (activeWheel) {
        await this.showActiveWheel(ctx, activeWheel);
        return;
      }
      
      // Перевіряємо потребу в новому колесі
      const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
      const regDate = user?.['Registration Date'] || user?.Created_Date || new Date().toISOString();
      
      const wheelCheck = await wheelBalanceService.shouldShowWheelReminder(tgId, regDate);
      
      if (!wheelCheck.needed) {
        await this.showRecentWheel(ctx, wheelCheck);
        return;
      }
      
      // Запускаємо нове колесо
      await this.startNewWheel(ctx, userName);
      
    } catch (error) {
      console.error('[WHEEL] ❌ Помилка запиту:', error);
      await ctx.reply('❌ Помилка запуску колеса. Спробуй пізніше.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ОБРОБКА ТЕКСТУ =====
  async handleText(ctx, text) {
    const tgId = ctx.from.id;
    
    // Перевіряємо чи очікуємо нотатку
    if (!ctx.session?.wheel?.awaitingNoteFor && ctx.session?.wheel?.awaitingNoteFor !== 0) {
      return false;
    }
    
    console.log(`[WHEEL] 📝 Нотатка від ${tgId}: "${text.substring(0, 50)}..."`);
    
    if (!text || text.length < 10) {
      await ctx.reply(
        '✍️ Додай трохи більше деталей (2–5 речень).\n\n💡 Опиши, чому поставила саме таку оцінку - це допоможе AI створити точніший аналіз.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚪 Вийти з колеса', callback_data: 'wheel_exit' }]
            ]
          }
        }
      );
      return true;
    }

    try {
      const result = await wheelBalanceService.saveWheelNoteAndGoNext(ctx, text);
      
      if (result.error) {
        await ctx.reply(
          result.message || '❌ Помилка збереження нотатки.\n\n🔄 Спробуй ще раз.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚪 Вийти з колеса', callback_data: 'wheel_exit' }]
              ]
            }
          }
        );
        return true;
      }
      
      if (result.completed) {
        // Колесо завершено
        await userService.updateUserStep(tgId, 'completed');
        
        await ctx.reply(result.message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Переглянути статистику', callback_data: 'wheel_stats' }],
              [{ text: '🏠 До головного меню', callback_data: 'main_menu' }]
            ]
          }
        });
        
        console.log(`[WHEEL] ✅ Колесо завершено для ${tgId}`);
      } else {
        // Переходимо до наступної сфери
        await ctx.reply(result.message, result.keyboard || keyboards.wheelScoreInlineKeyboard());
        console.log(`[WHEEL] ➡️ Наступна сфера для ${tgId}`);
      }
      
      return true;
      
    } catch (error) {
      console.error('[WHEEL] ❌ Помилка обробки нотатки:', error);
      await ctx.reply(
        '❌ Технічна помилка збереження.\n\n🔄 Спробуй ще раз через хвилину.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚪 Вийти з колеса', callback_data: 'wheel_exit' }]
            ]
          }
        }
      );
      return true;
    }
  },

  // ===== ОБРОБКА CALLBACK =====
  async handleCallback(ctx, data) {
    const tgId = ctx.from.id;
    
    console.log(`[WHEEL] 📱 Callback: ${data} від ${tgId}`);

    try {
      switch (true) {
        case data === 'wheel_start':
        case data === 'wheel_restart':
        case data === 'wheel_start_new':
          await this.handleStartWheel(ctx);
          break;
          
        case data === 'wheel_continue':
          await this.handleContinueWheel(ctx);
          break;
          
        case data === 'wheel_cancel':
        case data === 'wheel_exit':
          await this.handleExitWheel(ctx);
          break;
          
        case data === 'wheel_info':
          await this.showWheelInfo(ctx);
          break;
          
        case data === 'wheel_stats':
          await this.showWheelStats(ctx);
          break;
          
        case data.startsWith('wheel_score_'):
          const score = parseInt(data.replace('wheel_score_', ''), 10);
          await this.handleScore(ctx, score);
          break;
          
        default:
          console.log(`[WHEEL] ❓ Невідомий callback: ${data}`);
          await ctx.answerCbQuery('Команда не розпізнана');
      }
    } catch (error) {
      console.error('[WHEEL] ❌ Помилка callback:', error);
      await ctx.answerCbQuery('Помилка обробки');
    }
  },

  // ===== ДОПОМІЖНІ МЕТОДИ =====

  async showAccessDenied(ctx) {
    await ctx.reply(
      '🎯 Колесо балансу — преміум інструмент!\n\n📊 Отримай детальний аналіз 8 сфер життя з персональними рекомендаціями.\n\n💰 Активуй підписку для доступу.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
  },

  async showActiveWheel(ctx, activeWheel) {
    const currentStep = Number(activeWheel.fields.Step || 0);
    const sphereName = wheelBalanceService.LIFE_SPHERES[currentStep];
    const createdDate = new Date(activeWheel.fields.Created_Date);
    const hoursAgo = Math.floor((new Date() - createdDate) / (1000 * 60 * 60));

    let timeText = '';
    if (hoursAgo < 1) {
      timeText = 'щойно почате';
    } else if (hoursAgo < 24) {
      timeText = `${hoursAgo} год. тому`;
    } else {
      timeText = `${Math.floor(hoursAgo / 24)} дн. тому`;
    }

    await ctx.reply(
      `🎯 У тебе є незавершене колесо балансу!\n\n📍 Поточна сфера: ${currentStep + 1}️⃣/8 «${sphereName}»\n⏰ Почате: ${timeText}\n\n⚠️ Під час заповнення колеса інші дії заблоковані для точного результату.\n\n🎯 Продовжимо або почнемо заново?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Продовжити колесо', callback_data: 'wheel_continue' }],
            [{ text: '🔄 Почати заново', callback_data: 'wheel_restart' }],
            [{ text: '🚪 Вийти із сесії', callback_data: 'wheel_exit' }]
          ]
        }
      }
    );
  },

  async showRecentWheel(ctx, wheelCheck) {
    await ctx.reply(
      `📊 ${wheelCheck.message}\n\nТвій прогрес відслідковується. Продовжуй розвивати свої сфери життя!`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Мій прогрес', callback_data: 'wheel_stats' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
  },

  async startNewWheel(ctx, userName) {
    const tgId = ctx.from.id;
    
    try {
      const startResult = await wheelBalanceService.startWheelBalance(tgId, userName);
      await userService.updateUserStep(tgId, 'WheelBalance');

      // Спробуємо надіслати з картинкою
      try {
        const imagePath = path.join(process.cwd(), 'src', 'img', 'koleso_balansu.png');
        
        await ctx.replyWithPhoto(
          { source: imagePath },
          {
            caption: startResult.message,
            ...startResult.keyboard
          }
        );
        
        console.log(`[WHEEL] ✅ Колесо запущено з зображенням для ${tgId}`);
      } catch (imageError) {
        console.warn(`[WHEEL] ⚠️ Не вдалося надіслати зображення:`, imageError.message);
        
        await ctx.reply(startResult.message, startResult.keyboard);
        console.log(`[WHEEL] ✅ Колесо запущено без зображення для ${tgId}`);
      }
    } catch (error) {
      console.error('[WHEEL] ❌ Помилка запуску нового колеса:', error);
      await ctx.reply('❌ Помилка запуску колеса. Спробуй пізніше.', keyboards.mainMenuKeyboard());
    }
  },

async handleStartWheel(ctx) {
  const tgId = ctx.from.id;
  
  try {
    const user = await userService.getUserByTgId(tgId);
    
    if (!userService.hasActiveAccess(user)) {
      await ctx.answerCbQuery('Потрібна активна підписка');
      return;
    }
    
    const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
    const startResult = await wheelBalanceService.startWheelBalance(tgId, userName);
    await userService.updateUserStep(tgId, 'WheelBalance');

    // ✅ ПЕРЕВІРЯЄМО ЧИ ТРЕБА НАДСИЛАТИ ЗОБРАЖЕННЯ
    if (startResult.withImage) {
      const imagePath = path.join(process.cwd(), 'src', 'img', 'koleso_balansu.png');
      
      try {
        await ctx.replyWithPhoto(
          { source: imagePath },
          {
            caption: startResult.message,
            ...startResult.keyboard
          }
        );
        
        console.log(`[WHEEL] ✅ Колесо запущено З ЗОБРАЖЕННЯМ для ${tgId}`);
      } catch (imageError) {
        console.warn(`[WHEEL] ⚠️ Не вдалося надіслати зображення:`, imageError.message);
        
        // Fallback - надсилаємо без зображення
        await ctx.reply(startResult.message, startResult.keyboard);
        console.log(`[WHEEL] ✅ Колесо запущено БЕЗ зображення для ${tgId}`);
      }
    } else {
      // Без зображення (для continue/restart)
      try {
        await ctx.editMessageText(startResult.message, startResult.keyboard);
      } catch {
        await ctx.reply(startResult.message, startResult.keyboard);
      }
    }
    
    await ctx.answerCbQuery('🎯 Колесо запущено');
    
  } catch (error) {
    console.error('[WHEEL] ❌ Помилка handleStartWheel:', error);
    await ctx.answerCbQuery('Помилка запуску');
  }
}, 
  async handleContinueWheel(ctx) {
    const tgId = ctx.from.id;
    
    try {
      const activeWheel = await wheelBalanceService.getActiveWheel(tgId);

      if (!activeWheel) {
        console.log(`[WHEEL] ❌ Активне колесо не знайдено для ${tgId}`);
        
        // Запускаємо нове колесо
        const user = await userService.getUserByTgId(tgId);
        const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
        const startResult = await wheelBalanceService.startWheelBalance(tgId, userName);
        await userService.updateUserStep(tgId, 'WheelBalance');
        
        try {
          await ctx.editMessageText(startResult.message, startResult.keyboard);
        } catch {
          await ctx.reply(startResult.message, startResult.keyboard);
        }
        
        await ctx.answerCbQuery('🆕 Починаємо нове колесо');
        return;
      }

      const step = Number(activeWheel.fields.Step || 0);
      const sphereName = wheelBalanceService.LIFE_SPHERES[step];
      const scoreField = wheelBalanceService.SPHERE_FIELDS[step];
      const currentScore = activeWheel.fields[scoreField];
      
      if (currentScore != null) {
        // Є оцінка - питаємо нотатку
        const message = 
          `✅ Продовжуємо колесо балансу\n\n` +
          `Оцінка ${currentScore}/10 для «${sphereName}» збережена.\n\n` +
          `✍️ Коротко опиши (2–5 речень), чому поставила таку оцінку ${currentScore} для «${sphereName}». Це допоможе точніше у звітах.`;

        ctx.session = ctx.session || {};
        ctx.session.wheel = {
          awaitingNoteFor: step,
          recordId: activeWheel.id,
          lastScore: currentScore,
          sphereName: sphereName
        };

        try {
          await ctx.editMessageText(message, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚪 Вийти з колеса', callback_data: 'wheel_exit' }]
              ]
            }
          });
        } catch {
          await ctx.reply(message, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚪 Вийти з колеса', callback_data: 'wheel_exit' }]
              ]
            }
          });
        }
        
      } else {
        // Немає оцінки - питаємо оцінку
        const message = `✅ Продовжуємо колесо балансу\n\n${step + 1}️⃣/8 ${sphereName}\n\nОбери оцінку:`;
        
        try {
          await ctx.editMessageText(message, keyboards.wheelScoreInlineKeyboard());
        } catch {
          await ctx.reply(message, keyboards.wheelScoreInlineKeyboard());
        }
      }

      await userService.updateUserStep(tgId, 'WheelBalance');
      await ctx.answerCbQuery('▶️ Продовжуємо колесо');
      
    } catch (error) {
      console.error('[WHEEL] ❌ Помилка handleContinueWheel:', error);
      await ctx.answerCbQuery('Помилка продовження');
    }
  },

  async handleExitWheel(ctx) {
    const tgId = ctx.from.id;
    
    try {
      await wheelBalanceService.cancelActiveWheel(tgId);
      await userService.updateUserStep(tgId, 'completed');

      try {
        await ctx.editMessageText(
          '🚪 Сесію колеса завершено.\n\n💡 Регулярне заповнення колеса (раз на місяць) допомагає відслідковувати прогрес у розвитку та підтримувати баланс у всіх сферах життя.'
        );
      } catch {
        await ctx.reply(
          '🚪 Сесію колеса завершено.\n\n💡 Регулярне заповнення колеса (раз на місяць) допомагає відслідковувати прогрес у розвитку та підтримувати баланс у всіх сферах життя.'
        );
      }
      
      await ctx.answerCbQuery('✅ Сесію завершено');

      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 1000);
      
    } catch (error) {
      console.error('[WHEEL] ❌ Помилка handleExitWheel:', error);
      await ctx.answerCbQuery('Помилка виходу');
    }
  },

  async handleScore(ctx, score) {
    const tgId = ctx.from.id;
    
    if (isNaN(score) || score < 0 || score > 10) {
      await ctx.answerCbQuery('❌ Невірна оцінка');
      return;
    }
    
    try {
      const user = await userService.getUserByTgId(tgId);
      const step = user?.Current_Activity;
      
      if (step !== 'WheelBalance') {
        await ctx.reply(
          '⚠️ Сесія колеса балансу неактивна.\n\n🎯 Запусти нове колесо балансу через головне меню.',
          keyboards.mainMenuKeyboard()
        );
        await ctx.answerCbQuery('Сесія неактивна');
        return;
      }

      const result = await wheelBalanceService.processWheelAnswer(tgId, score, ctx);
      
      if (result.error) {
        await ctx.reply(
          result.message || '❌ Помилка збереження оцінки.\n\n🔄 Спробуй обрати оцінку ще раз.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚪 Вийти з колеса', callback_data: 'wheel_exit' }]
              ]
            }
          }
        );
        await ctx.answerCbQuery('Помилка збереження');
        return;
      }

      await ctx.answerCbQuery(`✅ Оцінка ${score} збережена`);
      console.log(`[WHEEL] ✅ Оцінка ${score} збережена для ${tgId}`);
      
    } catch (error) {
      console.error('[WHEEL] ❌ Помилка handleScore:', error);
      await ctx.answerCbQuery('Помилка');
    }
  },

  async showWheelInfo(ctx) {
    const message = 
      `🎯 КОЛЕСО БАЛАНСУ ЖИТТЯ\n\n` +
      `📋 Що це:\n` +
      `• Інструмент самоаналізу з 8 ключових сфер життя\n` +
      `• Оцінка від 0 до 10 для кожної сфери\n` +
      `• AI-аналіз твоїх результатів\n\n` +
      `🎯 8 сфер життя:\n` +
      `${wheelBalanceService.LIFE_SPHERES.map((sphere, i) => `${i + 1}. ${sphere}`).join('\n')}\n\n` +
      `⏱ Займає: 5-10 хвилин\n` +
      `📊 Результат: персональний звіт з рекомендаціями\n\n` +
      `Готова почати?`;

    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Так, почати!', callback_data: 'wheel_start' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    });
    
    await ctx.answerCbQuery('ℹ️ Інформація про колесо');
  },

  async showWheelStats(ctx) {
    const tgId = ctx.from.id;
    
    try {
      const stats = await wheelBalanceService.getUserWheelStats(tgId);
      let message = '📊 СТАТИСТИКА КОЛІС БАЛАНСУ\n\n';
      
      if (stats.total === 0) {
        message += 'Ти ще не заповнила жодного колеса балансу.\n\n';
        message += '🎯 Перше колесо дасть:\n';
        message += '• Чітке розуміння поточного стану\n';
        message += '• Персональні рекомендації від AI\n';
        message += '• План розвитку на місяць\n\n';
        message += '⏰ Час почати!';
      } else {
        message += `📈 Всього заповнено: ${stats.total}\n`;
        
        if (stats.lastScore) {
          message += `⭐ Останній середній бал: ${stats.lastScore}/10\n`;
        }
        
        if (stats.lastDate) {
          const daysSince = Math.floor((new Date() - new Date(stats.lastDate)) / (1000 * 60 * 60 * 24));
          message += `📅 Останнє колесо: ${daysSince} днів тому\n\n`;
          
          if (daysSince >= 30) {
            message += '⏰ Час для нового колеса!\n';
            message += '📈 Регулярний моніторинг допомагає:\n';
            message += '• Бачити прогрес у розвитку\n';
            message += '• Підтримувати баланс\n';
            message += '• Вчасно коригувати пріоритети';
          } else {
            message += `📅 Наступне рекомендоване: через ${30 - daysSince} днів\n\n`;
            message += '💪 Відмінна регулярність! Продовжуй відслідковувати прогрес.';
          }
        }
      }
      
      await ctx.editMessageText(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Нове колесо', callback_data: 'wheel_start' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      });
      
      await ctx.answerCbQuery('📊 Статистика завантажена');
      
    } catch (error) {
      console.error('[WHEEL] ❌ Помилка showWheelStats:', error);
      await ctx.answerCbQuery('Помилка завантаження статистики');
    }
  }
};

export default wheelController;