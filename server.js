// server.js
import express from 'express';
import { Telegraf, session, Markup } from 'telegraf';
import dotenv from 'dotenv';
import cron from 'node-cron';
import Airtable from 'airtable';

dotenv.config();

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Airtable setup
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Middleware
app.use(express.json());

// Session middleware for bot
bot.use(session({
  defaultSession: () => ({
    step: null,
    tempData: {},
    questionType: null,
    currentQuestionIndex: 0,
    answers: []
  })
}));

// ==================== CONSTANTS ====================
const MORNING_QUESTIONS = [
  "1️⃣ Хто я сьогодні?\nОпиши себе як нову версію — з позиції сили.\n(Наприклад: я топ експерт, я власниця відомого бренду, я мільйонерка, я відома співачка...)",
  "2️⃣ Яка я?\nДай відповідь на питання.\n(Наприклад: сильна, смілива, любляча, щира, рішуча...)",
  "3️⃣ Мої 10 цілей на рік\nПропиши щодня наново — ніби вони вже реальність.\nНе дивись, що писала вчора.\n1. Я маю...\n2. Я живу...\n3. Я отримую...\n... до 10",
  "4️⃣ На яку одну ціль я фокусуюсь сьогодні?\nТе, що хочеш просунути зараз.",
  "5️⃣ Який мій стан сьогодні?\nОпиши свій стан прямо зараз.\nЯкщо стан не ресурсний — обери новий:\nвпевненість, рішучість, легкість, сила — і налаштуйся на нього.",
  "6️⃣ Чому я гідна мати все це прямо зараз?\nОдна сильна відповідь із позиції самоцінності.\n(Наприклад: бо я вже достатня / цінна / варта.)"
];

const EVENING_QUESTIONS = [
  "1️⃣ Що мене сьогодні наповнило енергією?\nЛюди, дії, ситуації, стани.",
  "2️⃣ Де я сьогодні злила енергію чи втратила стан?\nТригер, сумнів, ситуація, реакція.",
  "3️⃣ Яка програма або переконання активувалась сьогодні?\n(Наприклад: страх, \"мені не вийде\", \"я не заслуговую\"...)",
  "4️⃣ З якої точки я діяла сьогодні: сили чи страху?\nЧесна відповідь. Що керувало тобою?",
  "5️⃣ Яка моя головна перемога сьогодні?\nДія, стан, рішення — будь-який успіх."
];

const AFFIRMATIONS = [
  "Моє бачення — мій вибір. Моя сила — в мені. Я вже йду своїм шляхом.",
  "Я заслуговую на все найкраще прямо зараз.",
  "Кожен день я стаю сильнішою та мудрішою.",
  "Мої цілі вже здійснюються через мої дії.",
  "Я довіряю собі та своїм рішенням.",
  "Моя енергія створює мою реальність.",
  "Я обираю любов замість страху.",
  "Успіх — це мій природний стан."
];

// ==================== KEYBOARDS ====================
const mainMenuKeyboard = () => Markup.keyboard([
  ['📝 Ранкові питання', '🌙 Вечірні питання'],
  ['💰 Підписка', '📊 Мій прогрес'],
  ['💎 Афірмація', '❓ Допомога']
]).resize();

const subscriptionKeyboard = () => Markup.inlineKeyboard([
  [Markup.button.callback('🔹 Тиждень фокусу — 7€', 'subscribe_week')],
  [Markup.button.callback('🔹 Місяць дії — 30€', 'subscribe_month')],
  [Markup.button.callback('🔹 Рік трансформації — 300€', 'subscribe_year')],
  [Markup.button.callback('« Назад', 'main_menu')]
]);

const skipKeyboard = () => Markup.keyboard([
  ['⏭️ Пропустити'],
  ['🏠 Головне меню']
]).resize();

// ==================== UTILITY FUNCTIONS ====================
function getTodayKey() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function createReminderKey(userName, telegramId, date, questionType) {
  const dateStr = date.replace(/-/g, '');
  return `${userName}_${telegramId}_${dateStr}_${questionType}`;
}

async function getUserByTelegramId(telegramId) {
  try {
    const records = await base('Users').select({
      filterByFormula: `{TG_id} = "${telegramId}"`
    }).firstPage();
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

async function hasActiveSubscription(telegramId) {
  try {
    const user = await getUserByTelegramId(telegramId);
    if (!user) return false;
    
    const status = user.fields['Active_Subscription_Status'];
    return status && status.toLowerCase().includes('active');
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

async function checkTodayReflection(telegramId, questionType) {
  try {
    const today = getTodayKey();
    const user = await getUserByTelegramId(telegramId);
    if (!user) return false;

    const table = questionType === 'morning' ? 'Morning_Responses' : 'Evening_Responses';
    const records = await base(table).select({
      filterByFormula: `AND({user_id} = "${telegramId}", {date} = "${today}")`
    }).firstPage();
    
    return records.length > 0;
  } catch (error) {
    console.error('Error checking today reflection:', error);
    return false;
  }
}

function getRandomAffirmation() {
  return AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
}

// ==================== BOT HANDLERS ====================

// Start command
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Користувач';
    
    let user = await getUserByTelegramId(telegramId);
    
    if (!user) {
      // Start registration
      ctx.session.step = 'registration_name';
      await ctx.reply(`🌟 Вітаю в AI-Coach для щоденної трансформації!

Привіт! Я твій персональний помічник для рефлексії та особистого зростання.

🔹 Щоранку (08:00) — 6 питань для фокусу і цілей
🔹 Щовечора (20:30) — 5 питань для аналізу дня
🔹 Щотижневі AI-звіти
🔹 Мотиваційні афірмації

Давай знайомитися! Як тебе звати?`);
    } else {
      await ctx.reply(`Привіт знову, ${user.fields['User Name']}! 👋

Радий тебе бачити! Оберіт дію:`, mainMenuKeyboard());
    }
  } catch (error) {
    console.error('Start error:', error);
    await ctx.reply('Виникла помилка. Спробуй ще раз.');
  }
});

// Handle text messages
bot.on('text', async (ctx) => {
  try {
    const text = ctx.message.text;
    const telegramId = ctx.from.id;
    
    // Handle registration steps
    if (ctx.session.step === 'registration_name') {
      if (text.length < 2) {
        await ctx.reply('Ім\'я має містити принаймні 2 символи. Спробуй ще раз:');
        return;
      }
      ctx.session.tempData = { name: text.trim() };
      ctx.session.step = 'registration_email';
      await ctx.reply('Дякую! Тепер вкажи свій email (або натисни "Пропустити"):', skipKeyboard());
      return;
    }
    
    if (ctx.session.step === 'registration_email') {
      if (text === '⏭️ Пропустити') {
        ctx.session.tempData.email = '';
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text)) {
          await ctx.reply('Некоректний email. Спробуй ще раз або натисни "Пропустити":');
          return;
        }
        ctx.session.tempData.email = text.trim();
      }
      ctx.session.step = 'registration_phone';
      await ctx.reply('Тепер вкажи свій номер телефону +380XXXXXXXXX (або натисни "Пропустити"):', skipKeyboard());
      return;
    }
    
    if (ctx.session.step === 'registration_phone') {
      let phone = '';
      if (text !== '⏭️ Пропустити') {
        const phoneRegex = /^\+380\d{9}$/;
        if (!phoneRegex.test(text.replace(/\s/g, ''))) {
          await ctx.reply('Некоректний номер. Використовуй формат +380XXXXXXXXX або натисни "Пропустити":');
          return;
        }
        phone = text.replace(/\s/g, '');
      }
      
      // Create user
      try {
        await base('Users').create([{
          fields: {
            'User Name': ctx.session.tempData.name,
            'TG_id': telegramId.toString(),
            'Email': ctx.session.tempData.email,
            'Phone': phone,
            'UserRegistered': true,
            'DateUserRegistered': new Date().toISOString(),
            'Status': 'Registered User',
            'Subscription Status': 'Empty',
            'Time Zone': 'Europe/Kiev'
          }
        }]);
        
        ctx.session = {}; // Clear session
        
        await ctx.reply('🎉 Реєстрація завершена!', { reply_markup: { remove_keyboard: true } });
        await ctx.reply('Тепер оформи підписку, щоб почати трансформацію:', subscriptionKeyboard());
      } catch (error) {
        console.error('Registration error:', error);
        await ctx.reply('Помилка реєстрації. Спробуй ще раз або зверніться до підтримки.');
      }
      return;
    }
    
    // Handle question answers
    if (ctx.session.questionType === 'morning' || ctx.session.questionType === 'evening') {
      ctx.session.answers[ctx.session.currentQuestionIndex] = text;
      ctx.session.currentQuestionIndex++;
      
      const questions = ctx.session.questionType === 'morning' ? MORNING_QUESTIONS : EVENING_QUESTIONS;
      
      if (ctx.session.currentQuestionIndex < questions.length) {
        // Send next question
        await ctx.reply(questions[ctx.session.currentQuestionIndex]);
      } else {
        // All questions answered, save to database
        await saveAnswersToDatabase(ctx, telegramId);
        
        const affirmation = getRandomAffirmation();
        await ctx.reply(`✅ Дякую! Відповіді збережено.

🌀 Афірмація для тебе:
"${affirmation}"

Повтори її кілька разів і відчуй силу цих слів! 💫`, mainMenuKeyboard());
        
        // Reset session
        ctx.session.questionType = null;
        ctx.session.currentQuestionIndex = 0;
        ctx.session.answers = [];
      }
      return;
    }
    
    // Handle menu buttons
    switch (text) {
      case '📝 Ранкові питання':
        await handleMorningQuestions(ctx);
        break;
      case '🌙 Вечірні питання':
        await handleEveningQuestions(ctx);
        break;
      case '💰 Підписка':
        await handleSubscription(ctx);
        break;
      case '📊 Мій прогрес':
        await handleProgress(ctx);
        break;
      case '💎 Афірмація':
        await handleAffirmation(ctx);
        break;
      case '❓ Допомога':
        await handleHelp(ctx);
        break;
      case '🏠 Головне меню':
        await ctx.reply('🏠 Головне меню', mainMenuKeyboard());
        break;
      case '+':
      case 'ок':
      case 'ok':
        const quickAffirmation = getRandomAffirmation();
        await ctx.reply(`✨ ${quickAffirmation} 💫`);
        break;
      default:
        // Check if user is registered
        const user = await getUserByTelegramId(telegramId);
        if (!user) {
          await ctx.reply('Спочатку пройди реєстрацію командою /start');
        } else {
          await ctx.reply('Не розумію цю команду. Використовуй меню 👇', mainMenuKeyboard());
        }
    }
  } catch (error) {
    console.error('Text handler error:', error);
    await ctx.reply('Виникла помилка. Спробуй ще раз.');
  }
});

// ==================== MENU HANDLERS ====================
async function handleMorningQuestions(ctx) {
  const telegramId = ctx.from.id;
  
  // Check if user is registered
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    await ctx.reply('Спочатку пройди реєстрацію командою /start');
    return;
  }
  
  // Check subscription
  const hasSubscription = await hasActiveSubscription(telegramId);
  if (!hasSubscription) {
    await ctx.reply('❌ У тебе немає активної підписки.\n\nОформи підписку, щоб користуватися всіма можливостями:', subscriptionKeyboard());
    return;
  }
  
  // Check if already answered today
  const alreadyAnswered = await checkTodayReflection(telegramId, 'morning');
  if (alreadyAnswered) {
    await ctx.reply('✅ Ти вже сьогодні відповіла на ранкові питання!\n\nПовертайся завтра о 08:00 🌅');
    return;
  }
  
  // Start morning questions
  ctx.session.questionType = 'morning';
  ctx.session.currentQuestionIndex = 0;
  ctx.session.answers = [];
  
  await ctx.reply(`🌞 РАНКОВІ ПИТАННЯ

Час для фокусу та активації! 
Відповідай щиро - це для твоєї трансформації ✨`);
  
  await ctx.reply(MORNING_QUESTIONS[0]);
}

async function handleEveningQuestions(ctx) {
  const telegramId = ctx.from.id;
  
  // Check if user is registered
  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    await ctx.reply('Спочатку пройди реєстрацію командою /start');
    return;
  }
  
  // Check subscription
  const hasSubscription = await hasActiveSubscription(telegramId);
  if (!hasSubscription) {
    await ctx.reply('❌ У тебе немає активної підписки.\n\nОформи підписку, щоб користуватися всіма можливостями:', subscriptionKeyboard());
    return;
  }
  
  // Check if already answered today
  const alreadyAnswered = await checkTodayReflection(telegramId, 'evening');
  if (alreadyAnswered) {
    await ctx.reply('✅ Ти вже сьогодні відповіла на вечірні питання!\n\nПовертайся завтра о 20:30 🌙');
    return;
  }
  
  // Start evening questions
  ctx.session.questionType = 'evening';
  ctx.session.currentQuestionIndex = 0;
  ctx.session.answers = [];
  
  await ctx.reply(`🌙 ВЕЧІРНІ ПИТАННЯ

Час проаналізувати день і зафіксувати перемоги 🏆`);
  
  await ctx.reply(EVENING_QUESTIONS[0]);
}

async function handleSubscription(ctx) {
  await ctx.reply(`💰 ПІДПИСКИ

🔹 **Тиждень фокусу — 7€**
Ідеально для короткого фокусу або тесту системи.

🔹 **Місяць дії — 30€**
Глибинна робота з твоїми цілями та стратегією.

🔹 **Рік трансформації — 300€**
Максимальна економія та підтримка протягом року.

✅ Оплата через WayForPay`, subscriptionKeyboard());
}

async function handleProgress(ctx) {
  const telegramId = ctx.from.id;
  const user = await getUserByTelegramId(telegramId);
  
  if (!user) {
    await ctx.reply('Спочатку пройди реєстрацію командою /start');
    return;
  }
  
  try {
    // Get user's reflection stats
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const morningRecords = await base('Morning_Responses').select({
      filterByFormula: `{user_id} = "${telegramId}"`
    }).firstPage();
    
    const eveningRecords = await base('Evening_Responses').select({
      filterByFormula: `{user_id} = "${telegramId}"`
    }).firstPage();
    
    const message = `📊 ТВІЙ ПРОГРЕС

👤 Профіль: ${user.fields['User Name']}
📅 Реєстрація: ${new Date(user.fields['DateUserRegistered']).toLocaleDateString('uk-UA')}
💳 Статус підписки: ${user.fields['Active_Subscription_Status'] || 'Немає активної'}

📈 Статистика рефлексій:
• Ранкових відповідей: ${morningRecords.length}
• Вечірніх відповідей: ${eveningRecords.length}
• Всього: ${morningRecords.length + eveningRecords.length}

🔥 Продовжуй в тому ж дусі!`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Progress error:', error);
    await ctx.reply('Помилка при завантаженні прогресу.');
  }
}

async function handleAffirmation(ctx) {
  const affirmation = getRandomAffirmation();
  await ctx.reply(`✨ Твоя афірмація:

"${affirmation}"

Повтори її кілька разів і відчуй силу цих слів! 💫`);
}

async function handleHelp(ctx) {
  await ctx.reply(`❓ ДОПОМОГА

Як користуватися ботом:

🔹 **Ранкові питання (08:00)** - 6 питань для фокусу на цілях та налаштування дня
🔹 **Вечірні питання (20:30)** - 5 питань для аналізу дня та фіксації перемог
🔹 **Швидка підтримка** - надішли "+" або "ок" для миттєвої афірмації
🔹 **Прогрес** - подивися свою статистику

✨ Поради:
• Відповідай щиро
• Не пропускай щоденні рефлексії  
• Використовуй афірмації регулярно

📧 Підтримка: nadyastarway@gmail.com`);
}

// ==================== CALLBACK HANDLERS ====================
bot.on('callback_query', async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    
    if (data === 'main_menu') {
      await ctx.editMessageText('🏠 Головне меню\n\nОберіт дію:', mainMenuKeyboard());
    } else if (data.startsWith('subscribe_')) {
      const plan = data.replace('subscribe_', '');
      const plans = {
        week: { name: 'Тиждень фокусу', price: '7€', days: 7 },
        month: { name: 'Місяць дії', price: '30€', days: 30 },
        year: { name: 'Рік трансформації', price: '300€', days: 365 }
      };
      
      const selectedPlan = plans[plan];
      const message = `Ти обрала: **${selectedPlan.name}**
Вартість: **${selectedPlan.price}**

Це демо-версія. Підписка буде активована автоматично через 5 секунд.`;

      await ctx.editMessageText(message);
      
      // Auto-activate subscription for demo
      setTimeout(async () => {
        try {
          const user = await getUserByTelegramId(ctx.from.id);
          if (user) {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + selectedPlan.days);
            
            await base('Users').update(user.id, {
              'Active_Subscription_Status': 'Active',
              'Active Subscription Plan': selectedPlan.name,
              'Subscription Status': 'Active',
              'End_Date': endDate.toISOString()
            });
            
            await ctx.telegram.sendMessage(ctx.from.id, 
              `🎉 Підписка "${selectedPlan.name}" активована!

Тепер ти отримуватимеш:
• Ранкові питання о 08:00
• Вечірні питання о 20:30
• AI-аналіз щотижня
• Персональні рекомендації

Готова почати? Натисни "📝 Ранкові питання" 👇`, mainMenuKeyboard());
          }
        } catch (error) {
          console.error('Subscription activation error:', error);
        }
      }, 5000);
    }
    
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Callback query error:', error);
    await ctx.answerCbQuery();
  }
});

// ==================== DATABASE FUNCTIONS ====================
async function saveAnswersToDatabase(ctx, telegramId) {
  try {
    const user = await getUserByTelegramId(telegramId);
    if (!user) return;
    
    const today = getTodayKey();
    const questionType = ctx.session.questionType;
    const answers = ctx.session.answers;
    const userName = user.fields['User Name'];
    
    const reminderKey = createReminderKey(userName, telegramId, today, questionType);
    
    if (questionType === 'morning') {
      await base('Morning_Responses').create([{
        fields: {
          'Reminder Key Morning': reminderKey,
          'user_id': telegramId.toString(),
          'user_name': userName,
          'date': today,
          'question_1': answers[0] || '',
          'question_2': answers[1] || '',
          'question_3': answers[2] || '',
          'question_4': answers[3] || '',
          'question_5': answers[4] || '',
          'question_6': answers[5] || ''
        }
      }]);
    } else {
      await base('Evening_Responses').create([{
        fields: {
          'Reminder Key Evening': reminderKey,
          'user_id': telegramId.toString(),
          'user_name': userName,
          'date': today,
          'question_1': answers[0] || '',
          'question_2': answers[1] || '',
          'question_3': answers[2] || '',
          'question_4': answers[3] || '',
          'question_5': answers[4] || ''
        }
      }]);
    }
    
    console.log(`✅ Saved ${questionType} answers for user ${telegramId}`);
  } catch (error) {
    console.error('Error saving answers:', error);
  }
}

// ==================== CRON JOBS ====================
async function getActiveUsers() {
  try {
    const records = await base('Users').select({
      filterByFormula: `AND({Active_Subscription_Status} = 'Active', {Status} != '')`
    }).all();
    
    return records.map(record => ({
      telegram_id: record.fields.TG_id,
      name: record.fields['User Name']
    }));
  } catch (error) {
    console.error('Error getting active users:', error);
    return [];
  }
}

// Morning reminders (08:00 Kiev time)
cron.schedule('0 8 * * *', async () => {
  console.log('Starting morning reminders...');
  
  try {
    const users = await getActiveUsers();
    console.log(`Found ${users.length} active users`);
    
    for (const user of users) {
      try {
        const alreadyAnswered = await checkTodayReflection(user.telegram_id, 'morning');
        if (!alreadyAnswered) {
          await bot.telegram.sendMessage(user.telegram_id, 
            `🌅 Доброго ранку, ${user.name}!

Час для ранкової рефлексії! Це займе лише 5 хвилин, але дасть тобі фокус на весь день.

Готова налаштуватися на успіх? 💪`, mainMenuKeyboard());
          
          console.log(`Morning reminder sent to ${user.name}`);
        }
        
        // Delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to send morning reminder to ${user.telegram_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Morning reminders failed:', error);
  }
}, {
  timezone: 'Europe/Kiev'
});

// Evening reminders (20:30 Kiev time)
cron.schedule('30 20 * * *', async () => {
  console.log('Starting evening reminders...');
  
  try {
    const users = await getActiveUsers();
    console.log(`Found ${users.length} active users`);
    
    for (const user of users) {
      try {
        const alreadyAnswered = await checkTodayReflection(user.telegram_id, 'evening');
        if (!alreadyAnswered) {
          await bot.telegram.sendMessage(user.telegram_id, 
            `🌙 Добрий вечір, ${user.name}!

Час підвести підсумки дня та зафіксувати свої перемоги! 

Вечірня рефлексія допоможе тобі усвідомити прогрес і підготуватися до завтрашнього дня.

Готова? ✨`, mainMenuKeyboard());
          
          console.log(`Evening reminder sent to ${user.name}`);
        }
        
        // Delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to send evening reminder to ${user.telegram_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Evening reminders failed:', error);
  }
}, {
  timezone: 'Europe/Kiev'
});

// Weekly reports (Sunday 19:00 Kiev time)
cron.schedule('0 19 * * 0', async () => {
  console.log('Generating weekly reports...');
  
  try {
    const users = await getActiveUsers();
    
    for (const user of users) {
      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoKey = weekAgo.toISOString().split('T')[0];
        
        const morningRecords = await base('Morning_Responses').select({
          filterByFormula: `AND({user_id} = "${user.telegram_id}", {date} >= "${weekAgoKey}")`
        }).firstPage();
        
        const eveningRecords = await base('Evening_Responses').select({
          filterByFormula: `AND({user_id} = "${user.telegram_id}", {date} >= "${weekAgoKey}")`
        }).firstPage();
        
        const totalReflections = morningRecords.length + eveningRecords.length;
        
        if (totalReflections > 0) {
          const report = `📊 ЩОТИЖНЕВИЙ ЗВІТ

Привіт, ${user.name}! 🌱
Ось твій звіт за останній тиждень:

📈 СТАТИСТИКА:
• Ранкових рефлексій: ${morningRecords.length}/7
• Вечірніх рефлексій: ${eveningRecords.length}/7
• Всього відповідей: ${totalReflections}
• Відсоток виконання: ${Math.round((totalReflections / 14) * 100)}%

🎯 РЕКОМЕНДАЦІЇ:
• Продовжуй щоденну практику рефлексії
• Звертай увагу на повторювані шаблони
• Фокусуйся на своїх сильних сторонах

✨ Пам'ятай: кожен день - це можливість стати кращою версією себе!`;

          await bot.telegram.sendMessage(user.telegram_id, report);
          console.log(`Weekly report sent to ${user.name}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to generate weekly report for ${user.telegram_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Weekly reports failed:', error);
  }
}, {
  timezone: 'Europe/Kiev'
});

// ==================== SERVER SETUP ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    timezone: 'Europe/Kiev'
  });
});

// Webhook endpoint for Telegram
app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Payment webhook (for future implementation)
app.post('/payment-webhook', (req, res) => {
  console.log('Payment webhook received:', req.body);
  res.sendStatus(200);
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Виникла помилка. Спробуй ще раз пізніше.');
});

// Start server
const PORT = process.env.PORT || 3000;

async function startBot() {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
      // Production mode with webhook
      await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`);
      console.log('✅ Webhook set successfully');
      console.log(`📡 Webhook URL: ${process.env.WEBHOOK_URL}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`);
    } else {
      // Development mode with polling
      await bot.launch();
      console.log('✅ Bot started in polling mode');
    }
    
    console.log('🤖 Bot is running...');
    console.log('🕐 Cron jobs scheduled:');
    console.log('  - Morning reminders: 08:00 Kiev time');
    console.log('  - Evening reminders: 20:30 Kiev time');
    console.log('  - Weekly reports: Sunday 19:00 Kiev time');
  } catch (error) {
    console.error('❌ Error starting bot:', error);
    process.exit(1);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startBot();
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('Received SIGINT, stopping bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('Received SIGTERM, stopping bot...');
  bot.stop('SIGTERM');
});

export default bot;