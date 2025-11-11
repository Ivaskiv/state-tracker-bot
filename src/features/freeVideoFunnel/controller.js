// 📁 src/features/freeVideoFunnel/controller.js
// # Обробка callback_query для кнопок
// src/features/freeVideoFunnel/controller.js

import * as flow from './flow.js';
import * as service from './service.js';
import logger from '../../utils/logger.js';
import { ANALYTICS_EVENTS } from './constants.js';

/**
 * Запуск воронки
 */
export async function handleStartFunnel(ctx) {
  try {
    const userId = ctx.from.id;
    
    // Створюємо або отримуємо прогрес
    await database.getOrCreateFunnelProgress(userId);
    
    // Відправляємо привітальне повідомлення
    await flow.sendWelcomeMessage(ctx);
    
    // Логуємо подію
    logAnalytics(userId, ANALYTICS_EVENTS.FUNNEL_STARTED);
    
    await ctx.answerCbQuery?.();
  } catch (error) {
    logger.error('Error handling start funnel:', error);
    await ctx.reply('❌ Виникла помилка. Спробуйте ще раз.');
  }
}

/**
 * Перевірка підписки на канал
 */
export async function handleCheckSubscription(ctx) {
  try {
    const userId = ctx.from.id;
    
    // Перевіряємо підписку
    const isSubscribed = await service.checkChannelSubscription(ctx.telegram, userId);
    
    if (isSubscribed) {
      await ctx.answerCbQuery('✅ Дякую за підписку!');
      
      // Відправляємо перше відео
      await flow.sendVideoMessage(ctx, 1);
      
      // Логуємо
      logAnalytics(userId, ANALYTICS_EVENTS.SUBSCRIPTION_CHECKED, { subscribed: true });
    } else {
      await ctx.answerCbQuery('❌ Спочатку підпишіться на канал', { show_alert: true });
      
      // Логуємо
      logAnalytics(userId, ANALYTICS_EVENTS.SUBSCRIPTION_CHECKED, { subscribed: false });
    }
  } catch (error) {
    logger.error('Error checking subscription:', error);
    await ctx.answerCbQuery('❌ Помилка перевірки підписки');
  }
}

/**
 * Відправка конкретного відео
 */
export async function handleVideoRequest(ctx, videoNumber) {
  try {
    const userId = ctx.from.id;
    
    // Відправляємо відео
    await flow.sendVideoMessage(ctx, videoNumber);
    
    // Логуємо
    logAnalytics(userId, ANALYTICS_EVENTS.VIDEO_STARTED, { video: videoNumber });
    
    await ctx.answerCbQuery?.();
  } catch (error) {
    logger.error('Error handling video request:', error);
    await ctx.reply('❌ Помилка завантаження відео');
  }
}

/**
 * Завершення перегляду відео
 */
export async function handleVideoComplete(ctx, videoNumber) {
  try {
    const userId = ctx.from.id;
    
    // Позначаємо відео як завершене
    const result = await service.completeVideo(userId, videoNumber);
    
    if (result.success) {
      // Відправляємо повідомлення про завершення
      await flow.sendVideoCompletedMessage(ctx, videoNumber);
      
      // Логуємо
      logAnalytics(userId, ANALYTICS_EVENTS.VIDEO_COMPLETED, {
        video: videoNumber,
        allCompleted: result.allCompleted
      });
      
      if (result.allCompleted) {
        logAnalytics(userId, ANALYTICS_EVENTS.ALL_VIDEOS_COMPLETED);
      }
      
      await ctx.answerCbQuery('✅ Відео пройдено!');
    } else {
      await ctx.answerCbQuery('❌ Помилка збереження прогресу');
    }
  } catch (error) {
    logger.error('Error handling video complete:', error);
    await ctx.reply('❌ Помилка збереження прогресу');
  }
}

/**
 * Активація бонусу
 */
export async function handleActivateBonus(ctx) {
  try {
    const userId = ctx.from.id;
    
    // Активуємо бонус
    const result = await service.activateSevenDayBonus(userId);
    
    if (result.success) {
      // Відправляємо повідомлення
      await flow.sendBonusActivatedMessage(ctx);
      
      // Логуємо
      logAnalytics(userId, ANALYTICS_EVENTS.BONUS_ACTIVATED, {
        daysGranted: result.daysGranted
      });
      
      await ctx.answerCbQuery('🎉 Бонус активовано!');
    } else {
      let message = '';
      
      switch (result.reason) {
        case 'not_all_videos_completed':
          message = `❌ Потрібно пройти всі ${result.required} відео. Пройдено: ${result.completed}`;
          break;
        case 'bonus_already_activated':
          message = '✅ Бонус вже активовано раніше';
          break;
        default:
          message = '❌ Не вдалося активувати бонус';
      }
      
      await ctx.answerCbQuery(message, { show_alert: true });
    }
  } catch (error) {
    logger.error('Error handling activate bonus:', error);
    await ctx.reply('❌ Помилка активації бонусу');
  }
}

/**
 * Продовження воронки
 */
export async function handleContinueFunnel(ctx) {
  try {
    const userId = ctx.from.id;
    
    // Отримуємо поточний стан
    const state = await service.getFunnelState(userId);
    
    if (state.isExpired) {
      await flow.sendTimeExpiredMessage(ctx);
    } else if (state.livesRemaining === 0) {
      await flow.sendAllLivesLostMessage(ctx);
    } else {
      // Визначаємо наступне відео
      const nextVideo = state.currentVideo || 1;
      await flow.sendVideoMessage(ctx, nextVideo);
    }
    
    await ctx.answerCbQuery?.();
  } catch (error) {
    logger.error('Error handling continue funnel:', error);
    await ctx.reply('❌ Помилка продовження');
  }
}

/**
 * Рестарт воронки
 */
export async function handleRestartFunnel(ctx) {
  try {
    const userId = ctx.from.id;
    
    // Скидаємо прогрес
    await service.restartFunnel(userId);
    
    // Відправляємо привітальне повідомлення
    await flow.sendWelcomeMessage(ctx);
    
    await ctx.answerCbQuery('🔄 Воронка перезапущена!');
  } catch (error) {
    logger.error('Error handling restart funnel:', error);
    await ctx.reply('❌ Помилка перезапуску');
  }
}

/**
 * Показати таймер
 */
export async function handleShowTimer(ctx) {
  try {
    const userId = ctx.from.id;
    
    const state = await service.getFunnelState(userId);
    const timeLeft = service.formatTimeRemaining(state.timeRemaining);
    
    const message = `⏰ Залишилось часу: ${timeLeft}\n\n💝 Життів: ${state.livesRemaining}/5\n📹 Відео пройдено: ${state.videosCompleted}/5`;
    
    await ctx.answerCbQuery(message, { show_alert: true });
  } catch (error) {
    logger.error('Error showing timer:', error);
    await ctx.answerCbQuery('❌ Помилка');
  }
}

/**
 * Показати життя
 */
export async function handleShowLives(ctx) {
  try {
    const userId = ctx.from.id;
    
    const state = await service.getFunnelState(userId);
    
    const heartsDisplay = '💝'.repeat(state.livesRemaining) + '🖤'.repeat(5 - state.livesRemaining);
    const message = `${heartsDisplay}\n\nУ тебе ${state.livesRemaining}/5 життів`;
    
    await ctx.answerCbQuery(message, { show_alert: true });
  } catch (error) {
    logger.error('Error showing lives:', error);
    await ctx.answerCbQuery('❌ Помилка');
  }
}

/**
 * Головне меню
 */
export async function handleMainMenu(ctx) {
  try {
    await flow.sendMainMenu(ctx);
    await ctx.answerCbQuery?.();
  } catch (error) {
    logger.error('Error showing main menu:', error);
    await ctx.reply('❌ Помилка відображення меню');
  }
}

/**
 * Вихід на Tilda
 */
export async function handleExitToTilda(ctx) {
  try {
    await flow.sendExitToTildaMessage(ctx);
    await ctx.answerCbQuery?.();
  } catch (error) {
    logger.error('Error handling exit to tilda:', error);
    await ctx.reply('❌ Помилка');
  }
}

/**
 * Показати статус
 */
export async function handleShowStatus(ctx) {
  try {
    const userId = ctx.from.id;
    
    const state = await service.getFunnelState(userId);
    const timeLeft = service.formatTimeRemaining(state.timeRemaining);
    
    const statusEmoji = {
      'not_started': '🆕',
      'started': '▶️',
      'in_progress': '⏳',
      'all_completed': '✅',
      'bonus_activated': '🎁',
      'expired': '⏰'
    };
    
    const message = `
${statusEmoji[state.state] || '📊'} <b>Твій прогрес</b>

💝 Життів: ${state.livesRemaining}/5
📹 Відео пройдено: ${state.videosCompleted}/${state.totalVideos}
📈 Прогрес: ${state.completionRate}%
⏰ Залишилось часу: ${timeLeft}
${state.channelSubscribed ? '✅' : '❌'} Підписка на канал
${state.bonusActivated ? '🎁 Бонус активовано!' : ''}
    `.trim();
    
    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Error showing status:', error);
    await ctx.reply('❌ Помилка відображення статусу');
  }
}

/**
 * Логування аналітики
 */
function logAnalytics(userId, event, data = {}) {
  try {
    logger.info('Video Funnel Analytics', {
      userId,
      event,
      ...data,
      timestamp: new Date().toISOString()
    });
    
    // Тут можна додати відправку в Google Analytics, Amplitude, etc.
  } catch (error) {
    logger.error('Error logging analytics:', error);
  }
}