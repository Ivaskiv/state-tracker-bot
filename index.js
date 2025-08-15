// src/index.js
import { Telegraf, Scenes, session } from 'telegraf';
import { config } from './src/config/config.js';
import { getUserByTgId, createUser, updateUser } from './src/utils/airtable.js';
import { eveningScene, morningScene } from './src/controllers/polling.js';
import { paymentScene } from './src/controllers/payment.js';
import { createKeyboard } from './src/utils/helpers.js';
import { initScheduler } from './src/controllers/registration.js';

const bot = new Telegraf(config.botToken);
const stage = new Scenes.Stage([morningScene, eveningScene, paymentScene]);

bot.use(session());
bot.use(stage.middleware());

// ===== START COMMAND =====
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const userName = ctx.from.first_name || 'Unknown';
  const username = ctx.from.username || '';

  try {
    let user = await getUserByTgId(userId);

    if (!user) {
      // Створення нового користувача
      user = await createUser({
        TG_id: userId,
        'User Name': userName,
        username: username,
        Status: 'New User',
        'Active_Subscription_Status': '❌ Немає активної підписки',
        'Active Subscription Plan': '',
        'Last Modified Time': new Date().toISOString(),
        UserRegistered: false
      });

      await ctx.reply(config.messages.welcome, {
        reply_markup: { 
          inline_keyboard: createKeyboard(config.keyboard.subscription) 
        }
      });
      return;
    }

    // Оновлення часу останньої активності
    await updateUser(userId, { 
      'Last Modified Time': new Date().toISOString(),
      'User Name': userName
    });

    // Перевірка активності підписки
    const isActive = user.fields.Status === 'Active User';
    const hasActiveSubscription = user.fields['Active_Subscription_Status']?.includes('✅ Активна');

    if (isActive && hasActiveSubscription) {
      await ctx.reply(`✅ Дякую! Дані збережено.\n🎯 У тебе вже є активна підписка. Можеш продовжити трансформацію!\n\n💫 Доступні команди:\n/morning - ранкова сесія\n/evening - вечірня сесія`);
    } else {
      await ctx.reply(config.messages.subscriptionExpired, {
        reply_markup: { 
          inline_keyboard: createKeyboard(config.keyboard.subscription) 
        }
      });
    }
  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply('❌ Виникла помилка. Спробуйте ще раз.');
  }
});

// ===== MORNING COMMAND =====
bot.command('morning', async (ctx) => {
  const userId = ctx.from.id.toString();
  
  try {
    const user = await getUserByTgId(userId);
    if (!user) {
      return ctx.reply('❌ Користувач не знайдений. Використайте /start для реєстрації.');
    }

    await updateUser(userId, { 'Last Modified Time': new Date().toISOString() });

    // Перевірка підписки
    if (user.fields.Status !== 'Active User' || !user.fields['Active_Subscription_Status']?.includes('✅ Активна')) {
      return ctx.reply(config.messages.subscriptionExpired, {
        reply_markup: { 
          inline_keyboard: createKeyboard(config.keyboard.subscription) 
        }
      });
    }

    ctx.scene.enter('morning');
  } catch (error) {
    console.error('Error in morning command:', error);
    await ctx.reply('❌ Виникла помилка. Спробуйте ще раз.');
  }
});

// ===== EVENING COMMAND =====
bot.command('evening', async (ctx) => {
  const userId = ctx.from.id.toString();
  
  try {
    const user = await getUserByTgId(userId);
    if (!user) {
      return ctx.reply('❌ Користувач не знайдений. Використайте /start для реєстрації.');
    }

    await updateUser(userId, { 'Last Modified Time': new Date().toISOString() });

    // Перевірка підписки
    if (user.fields.Status !== 'Active User' || !user.fields['Active_Subscription_Status']?.includes('✅ Активна')) {
      return ctx.reply(config.messages.subscriptionExpired, {
        reply_markup: { 
          inline_keyboard: createKeyboard(config.keyboard.subscription) 
        }
      });
    }

    ctx.scene.enter('evening');
  } catch (error) {
    console.error('Error in evening command:', error);
    await ctx.reply('❌ Виникла помилка. Спробуйте ще раз.');
  }
});

// ===== SUBSCRIPTION ACTIONS =====
bot.action(/^sub_(.+)/, async (ctx) => {
  try {
    const plan = ctx.match[1];
    ctx.session.selectedPlan = plan;
    ctx.scene.enter('payment');
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in subscription action:', error);
    await ctx.answerCbQuery('❌ Виникла помилка');
  }
});

// ===== SUPPORT ACTIONS =====
bot.action(/^support_(.+)/, async (ctx) => {
  try {
    const type = ctx.match[1];
    let message;
    
    switch(type) {
      case 'motivation':
        message = config.messages.motivationMorning;
        break;
      case 'calm':
        message = "🧘 Зроби глибокий вдих... Все під контролем. Ти сильніша, ніж здається.";
        break;
      case 'focus':
        message = "🎯 Одна ціль. Один крок. Зараз. Ти можеш це. Твоя сила — в фокусі.";
        break;
      default:
        message = "💫 Ти на правильному шляху. Продовжуй йти до своєї мети.";
    }
    
    await ctx.answerCbQuery();
    await ctx.reply(message);
  } catch (error) {
    console.error('Error in support action:', error);
    await ctx.answerCbQuery('❌ Виникла помилка');
  }
});

// ===== TEXT MESSAGES =====
bot.on('text', async (ctx) => {
  const text = ctx.message.text.toLowerCase();
  
  if (text === '+' || text === 'ок' || text === 'ok') {
    const motivationMessages = [
      config.messages.motivationMorning,
      config.messages.motivationEvening,
      "💪 Ти сильніша, ніж думаєш!",
      "🌟 Кожен крок веде до мети!",
      "✨ Ти вже на правильному шляху!",
      "🔥 Твоя сила — всередині тебе!",
      "💎 Ти — цінна і варта всього найкращого!"
    ];
    
    const randomMessage = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];
    await ctx.reply(randomMessage);
  }
});

// ===== ERROR HANDLING =====
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  if (ctx?.reply) {
    ctx.reply('❌ Виникла технічна помилка. Спробуйте ще раз або зверніться до підтримки.');
  }
});

// ===== INITIALIZATION =====
async function startBot() {
  try {
    // Ініціалізація планувальника
    await initScheduler(bot);
    
    // Запуск бота
    await bot.launch();
    console.log('🚀 Bot started successfully');
    
    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

startBot();