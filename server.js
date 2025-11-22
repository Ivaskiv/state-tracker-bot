// server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Telegraf, session } from 'telegraf';
import { initRouter } from './src/bot/router.js';
import { 
  initMiddleware, 
  performanceMiddleware, 
  antiSpamMiddleware, 
  checkAccessMiddleware, 
  errorMiddleware,
 } from './src/bot/middleware.js';
import { testConnection, validateTables } from './src/config/database.js';
import { initScheduler, stopScheduler } from './src/services/scheduler.js';
import { clearAllUserCache } from './src/services/users.js';
import subscriptionWebhook from './src/core/subscription/webhook.js';
import { handleAirtableWebhook } from './src/webhooks/airtable.js';

const { TELEGRAM_BOT_TOKEN, NODE_ENV, PORT = 3000 } = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN відсутній');
  process.exit(1);
}

// Express
const app = express();
app.use(express.json());
app.post('/webhooks/airtable', handleAirtableWebhook);
app.post('/api/wayforpay/webhook', subscriptionWebhook);
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/admin/clear-cache', (req, res) => {
  try {
    const cleared = clearAllUserCache();
    res.json({ cleared });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bot
const bot = new Telegraf(TELEGRAM_BOT_TOKEN, { handlerTimeout: 15_000 });

bot.use(session({ defaultSession: () => ({ wheel: null, registration: null, ai: null }) }));
bot.use(errorMiddleware);           // 1️⃣ Ловимо помилки
bot.use(antiSpamMiddleware());      // 2️⃣ Захист від спаму
bot.use(initMiddleware());          // 3️⃣ Auth + State (автоматично)
bot.use(checkAccessMiddleware());   // 5️⃣ Перевірка підписки
bot.use(performanceMiddleware(2000)); // 6️⃣ Моніторинг швидкості

bot.catch((err, ctx) => {
  console.error('❌ Error:', err.message, 'User:', ctx.from?.id);
  ctx.reply('❌ Помилка. Спробуй /start').catch(() => {});
});

// Startup
(async () => {
  try {
    const db = await testConnection();
    if (!db?.success) throw new Error('Airtable недоступний');
    
    await validateTables();
    initRouter(bot);
    initScheduler(bot);
    
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
    
    app.listen(PORT, () => {
      console.log(`✅ Bot: @${bot.botInfo.username}`);
      console.log(`✅ Server: http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('❌ Startup:', e.message);
    process.exit(1);
  }
})();

// Shutdown
const shutdown = (signal) => async () => {
  console.log(`🛑 ${signal}`);
  stopScheduler();
  await bot.stop(signal);
  process.exit(0);
};

process.once('SIGINT', shutdown('SIGINT'));
process.once('SIGTERM', shutdown('SIGTERM'));

// ===== ПЕРЕРАХУНОК МІЛЬЙОНА =====

async function recalculateTargetAmount() {
  try {
    // 1. Отримуємо всі активні уроки
    const lessonsUrl = `${AIRTABLE_API}/${BASE_ID}/Lessons?filterByFormula={Is_Active}=TRUE()`;
    const lessonsRes = await axios.get(lessonsUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });
    
    const lessonRewards = lessonsRes.data.records.reduce((sum, r) => {
      return sum + (r.fields.Reward_Amount || 0);
    }, 0);

    // 2. Отримуємо всі активні бонуси
    const bonusesUrl = `${AIRTABLE_API}/${BASE_ID}/Bonuses?filterByFormula={Is_Active}=TRUE()`;
    const bonusesRes = await axios.get(bonusesUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });
    
    const bonusRewards = bonusesRes.data.records.reduce((sum, r) => {
      return sum + (r.fields.Reward_Amount || 0);
    }, 0);

    // 3. Отримуємо стандартні ачівки
    const achievements = {
      FIRST_LESSON: 50000,
      ALL_7_DAYS: 100000,
      SPEED_DEMON: 50000,
      QUALITY_WARRIOR: 75000,
      CONSISTENT: 50000,
      REFERRAL_MASTER: 75000,
      PAYMENT_EARLY: 50000,
      ULTIMATE_LEGEND: 225000
    };
    
    const achievementTotal = Object.values(achievements).reduce((a, b) => a + b, 0);

    // 4. Розраховуємо буфер
    const settings = await getAirtableRecord('Settings', `{Setting_Name} = 'BUFFER_PERCENT'`);
    const bufferPercent = settings.Setting_Value || 10;
    
    const subtotal = lessonRewards + bonusRewards + achievementTotal;
    const buffer = Math.ceil(subtotal * (bufferPercent / 100));
    
    const targetAmount = subtotal + buffer;

    // 5. ОКРУГЛЮЄМО до красивого числа
    let finalTarget;
    if (targetAmount < 1000000) {
      finalTarget = 1000000; // Мінімум мільйон
    } else if (targetAmount >= 1000000 && targetAmount < 1500000) {
      finalTarget = Math.ceil(targetAmount / 100000) * 100000; // Округлюємо до 100k
    } else {
      finalTarget = Math.ceil(targetAmount / 500000) * 500000; // Округлюємо до 500k
    }

    // 6. Оновлюємо Settings
    const settingsRecord = await getAirtableRecord('Settings', `{Setting_Name} = 'TARGET_AMOUNT'`);
    
    if (settingsRecord?.recordId) {
      await updateAirtableRecord('Settings', settingsRecord.recordId, {
        Setting_Value: finalTarget,
        Setting_String: `Target: €${finalTarget.toLocaleString()}`
      });
    }

    // 7. Логіка
    console.log(`
    ═════════════════════════════════
    ПЕРЕРАХУНОК МІЛЬЙОНА
    ═════════════════════════════════
    Уроки: €${lessonRewards.toLocaleString()}
    Бонуси: €${bonusRewards.toLocaleString()}
    Ачівки: €${achievementTotal.toLocaleString()}
    ─────────────────────────────────
    Сума: €${subtotal.toLocaleString()}
    Буфер (${bufferPercent}%): €${buffer.toLocaleString()}
    ─────────────────────────────────
    ФІНАЛЬНА ЦІЛЬ: €${finalTarget.toLocaleString()}
    ═════════════════════════════════
    `);

    return {
      lessonRewards,
      bonusRewards,
      achievementTotal,
      subtotal,
      buffer,
      finalTarget
    };

  } catch (error) {
    console.error('Помилка при перерахунку:', error);
  }
}

// ===== ДОДАННЯ НОВОГО УРОКУ =====

async function addNewLesson(courseId, day, title, text, keyIdea, reward) {
  try {
    // 1. Додаємо новий урок
    const newLesson = await createAirtableRecord('Lessons', {
      Course_ID: courseId,
      Day: day,
      Title: title,
      Lesson_Text: text,
      Key_Idea: keyIdea,
      Reward_Amount: reward,
      Badge_Name: `${title} Мастер`,
      Badge_Emoji: '⭐',
      Badge_Rarity: 'Epic',
      Position: day,
      Is_Active: true,
      XP_Reward: Math.ceil(reward / 500)
    });

    // 2. Оновлюємо налаштування
    const courseSetting = await getAirtableRecord('Settings', `{Setting_Name} = 'TOTAL_LESSONS'`);
    if (courseSetting?.recordId) {
      await updateAirtableRecord('Settings', courseSetting.recordId, {
        Setting_Value: (courseSetting.Setting_Value || 0) + 1
      });
    }

    // 3. ПЕРЕРАХОВУ МІЛЬЙОН
    const newTarget = await recalculateTargetAmount();

    return {
      success: true,
      newLessonId: newLesson,
      newTargetAmount: newTarget.finalTarget,
      message: `✅ Новий урок додан! Нова ціль: €${newTarget.finalTarget.toLocaleString()}`
    };

  } catch (error) {
    console.error('Помилка при додаванні уроку:', error);
    return { success: false, error: error.message };
  }
}

// ===== ВИДАЛЕННЯ УРОКУ =====

async function deleteLesson(lessonId) {
  try {
    // 1. Отримуємо урок перед видаленням (для логу)
    const lesson = await axios.get(
      `${AIRTABLE_API}/${BASE_ID}/Lessons/${lessonId}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    );

    // 2. Видаляємо урок
    await axios.delete(
      `${AIRTABLE_API}/${BASE_ID}/Lessons/${lessonId}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    );

    // 3. Оновлюємо налаштування
    const courseSetting = await getAirtableRecord('Settings', `{Setting_Name} = 'TOTAL_LESSONS'`);
    if (courseSetting?.recordId) {
      await updateAirtableRecord('Settings', courseSetting.recordId, {
        Setting_Value: Math.max(0, (courseSetting.Setting_Value || 1) - 1)
      });
    }

    // 4. ПЕРЕРАХОВУ МІЛЬЙОН
    const newTarget = await recalculateTargetAmount();

    return {
      success: true,
      newTargetAmount: newTarget.finalTarget,
      message: `✅ Урок видален! Нова ціль: €${newTarget.finalTarget.toLocaleString()}`
    };

  } catch (error) {
    console.error('Помилка при видаленні:', error);
    return { success: false, error: error.message };
  }
}

// ===== ДОДАННЯ БОНУСУ =====

async function addNewBonus(courseId, day, title, type, reward) {
  try {
    // 1. Додаємо новий бонус
    const newBonus = await createAirtableRecord('Bonuses', {
      Course_ID: courseId,
      Bonus_Number: day,
      Opens_On_Day: day,
      Title: title,
      Bonus_Type: type,
      Reward_Amount: reward,
      XP_Reward: Math.ceil(reward / 300),
      Badge_Name: `${title} Розблокував`,
      Rarity: 'Rare',
      Is_Active: true
    });

    // 2. Оновлюємо налаштування
    const bonusSetting = await getAirtableRecord('Settings', `{Setting_Name} = 'TOTAL_BONUSES'`);
    if (bonusSetting?.recordId) {
      await updateAirtableRecord('Settings', bonusSetting.recordId, {
        Setting_Value: (bonusSetting.Setting_Value || 0) + 1
      });
    }

    // 3. ПЕРЕРАХОВУ МІЛЬЙОН
    const newTarget = await recalculateTargetAmount();

    return {
      success: true,
      newBonusId: newBonus,
      newTargetAmount: newTarget.finalTarget,
      message: `✅ Новий бонус додан! Нова ціль: €${newTarget.finalTarget.toLocaleString()}`
    };

  } catch (error) {
    console.error('Помилка при додаванні бонусу:', error);
    return { success: false, error: error.message };
  }
}

// ===== ОТРИМАТИ ПОТОЧНУ ЦІЛЬ =====

async function getCurrentTarget() {
  const settings = await getAirtableRecord('Settings', `{Setting_Name} = 'TARGET_AMOUNT'`);
  return settings?.Setting_Value || 1000000;
}

// ===== ІНФОРМАЦІЯ ПРО МІЛЬЙОН =====

async function getMillionInfo() {
  const info = await recalculateTargetAmount();
  const currentTarget = await getCurrentTarget();

  return {
    currentTarget,
    breakdown: {
      lessons: info.lessonRewards,
      bonuses: info.bonusRewards,
      achievements: info.achievementTotal,
      buffer: info.buffer
    },
    summary: `
TARGET AMOUNT: €${currentTarget.toLocaleString()}

Розбір:
├─ Уроки: €${info.lessonRewards.toLocaleString()}
├─ Бонуси: €${info.bonusRewards.toLocaleString()}
├─ Ачівки: €${info.achievementTotal.toLocaleString()}
├─ Буфер: €${info.buffer.toLocaleString()}
└─ ВСЬОГО: €${info.finalTarget.toLocaleString()}
    `
  };
}

// ===== API ENDPOINTS =====

app.post('/api/lesson/add', async (req, res) => {
  const { courseId, day, title, text, keyIdea, reward } = req.body;
  const result = await addNewLesson(courseId, day, title, text, keyIdea, reward);
  res.json(result);
});

app.post('/api/lesson/delete', async (req, res) => {
  const { lessonId } = req.body;
  const result = await deleteLesson(lessonId);
  res.json(result);
});

app.post('/api/bonus/add', async (req, res) => {
  const { courseId, day, title, type, reward } = req.body;
  const result = await addNewBonus(courseId, day, title, type, reward);
  res.json(result);
});

app.get('/api/million/info', async (req, res) => {
  const info = await getMillionInfo();
  res.json(info);
});

app.get('/api/million/recalculate', async (req, res) => {
  const result = await recalculateTargetAmount();
  res.json({
    success: true,
    newTarget: result.finalTarget,
    breakdown: result
  });
});

// ===== ОНОВЛЕНА ФУНКЦІЯ SENDDAY =====

async function sendDay(chatId, day) {
  const lesson = await getAirtableRecord('Lessons', `{Day} = ${day}`);
  const task = await getAirtableRecord('Tasks', `{Day} = ${day}`);
  const user = await getAirtableRecord('Users', `{Chat_ID} = '${chatId}'`);
  const currentTarget = await getCurrentTarget(); // Отримуємо поточну ціль

  if (!lesson) return;

  const badge = await unlockBadge(
    chatId,
    lesson.Badge_Name,
    lesson.Badge_Emoji,
    lesson.Badge_Rarity,
    lesson.Reward_Amount
  );

  const progressBar = createProgressBar(day, 7);
  const remainingToMillion = Math.max(0, currentTarget - (user.Virtual_Balance || 0));
  
  const balanceText = `💰 Баланс: €${user.Virtual_Balance?.toLocaleString() || 0}
💎 Всього заробив: €${user.Total_Earned?.toLocaleString() || 0}
🏆 Рівень: ${user.Level || 1}/7
✨ XP: ${user.XP_Points || 0}

👑 ЦІЛЬ: €${currentTarget.toLocaleString()}
📍 Залишилось: €${remainingToMillion.toLocaleString()}

🎖️ Новий бейдж: ${lesson.Badge_Emoji} ${lesson.Badge_Name} (+€${lesson.Reward_Amount?.toLocaleString()})
${progressBar}`;

  const messageText = `${lesson.Lesson_Text}

━━━━━━━━━━━━━━━━━━
${balanceText}
━━━━━━━━━━━━━━━━━━`;

  await sendTelegramMessage(chatId, messageText);

  setTimeout(async () => {
    const taskText = `${task.Task_Intro}

1️⃣ ${task.Question_1}
2️⃣ ${task.Question_2}
3️⃣ ${task.Question_3}

⏱️ Мінімум ${task.Required_Words_Min || 50} слів в кожній відповіді = +{{bonus_xp}} XP`;

    await sendTelegramMessage(chatId, taskText, [
      [{ text: `✍️ Відповісти (День ${day})`, callback_data: `answer_day_${day}` }]
    ]);
  }, 5000);
}
