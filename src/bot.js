import { Telegraf, Scenes, session } from 'telegraf';
import { config } from './config/config.js';
import { initScheduler } from './utils/scheduler.js';
import { getUserByTgId, createUser, checkSubscriptionStatus } from './utils/airtable.js';
import { registrationScene } from './scenes/registration.js';
import { morningScene, eveningScene } from './scenes/polling.js';
import { paymentScene } from './scenes/payment.js';
import { createKeyboard } from './utils/helpers.js';
import { getRandom } from './utils/quotes.js';

const bot = new Telegraf(config.botToken);
const stage = new Scenes.Stage([
  registrationScene,
  morningScene, 
  eveningScene,
  paymentScene
]);

bot.use(session());
bot.use(stage.middleware());

bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const user = await getUserByTgId(userId);
  
  if (!user) {
    await createUser({
      tg_user_id: userId,
      username: ctx.from.username || '',
      first_name: ctx.from.first_name || 'Unknown',
      subscription_plan: 'trial',
      is_active: true
    });
    
    await ctx.reply(config.messages.welcome, {
      reply_markup: {
        inline_keyboard: createKeyboard(config.keyboard.subscription)
      }
    });
  } else {
    const subscription = await checkSubscriptionStatus(userId);
    
    if (subscription.active) {
      await ctx.reply(`Вітаю, ${user.fields.first_name}! 👋\n\nТвоя підписка активна до ${new Date(subscription.endDate).toLocaleDateString('uk-UA')}\n\nВикористовуй /morning або /evening для сесій.`);
    } else {
      await ctx.reply(config.messages.subscriptionExpired, {
        reply_markup: {
          inline_keyboard: createKeyboard(config.keyboard.subscription)
        }
      });
    }
  }
});

bot.command('morning', async (ctx) => {
  const userId = ctx.from.id.toString();
  const subscription = await checkSubscriptionStatus(userId);
  
  if (!subscription.active) {
    return ctx.reply(config.messages.subscriptionExpired, {
      reply_markup: {
        inline_keyboard: createKeyboard(config.keyboard.subscription)
      }
    });
  }
  
  ctx.scene.enter('morning');
});

bot.command('evening', async (ctx) => {
  const userId = ctx.from.id.toString();
  const subscription = await checkSubscriptionStatus(userId);
  
  if (!subscription.active) {
    return ctx.reply(config.messages.subscriptionExpired, {
      reply_markup: {
        inline_keyboard: createKeyboard(config.keyboard.subscription)
      }
    });
  }
  
  ctx.scene.enter('evening');
});

bot.action(/^sub_(.+)/, async (ctx) => {
  const plan = ctx.match[1];
  ctx.session.selectedPlan = plan;
  ctx.scene.enter('payment');
});

bot.action(/^support_(.+)/, async (ctx) => {
  const type = ctx.match[1];
  let message;
  
  switch(type) {
    case 'motivation':
      message = config.messages.motivationMorning;
      break;
    case 'calm':
      message = "🧘 Зроби глибокий вдих... Все під контролем. Ти справляєшся.";
      break;
    case 'focus':
      message = "🎯 Одна ціль. Один крок. Зараз. Ти можеш це.";
      break;
  }
  
  await ctx.answerCbQuery();
  await ctx.reply(message);
});

bot.on('text', async (ctx) => {
  if (ctx.message.text === '+' || ctx.message.text.toLowerCase() === 'ок') {
    const motivation = getRandom([
      config.messages.motivationMorning,
      config.messages.motivationEvening,
      "💪 Ти сильніша, ніж думаєш!",
      "🌟 Кожен крок веде до мети!",
      "✨ Ти вже на правильному шляху!"
    ]);
    
    await ctx.reply(motivation);
  }
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

bot.launch()
  .then(() => {
    console.log('🚀 Коучинг бот запущено!');
    initScheduler(bot);
  })
  .catch(err => console.error('❌ Помилка запуску:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));