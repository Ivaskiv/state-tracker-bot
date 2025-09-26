// src/services/wheelBalanceService.js - ДОДАНО ЛОГІКУ ЩОМІСЯЧНИХ ПЕРЕВІРОК
import { getBase, tables } from '../config/database.js';
import { LIFE_SPHERES, SPHERE_FIELDS, NOTE_FIELDS } from '../config/constants.js';
import logger from '../utils/logger.js';
import { chat } from './openaiClient.js';

const base = getBase();

// ———————————————————————————————————————————————
// УТИЛІТИ
// ———————————————————————————————————————————————

const buildScoreKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [
      [
        { text: '0', callback_data: 'wheel_score_0' },
        { text: '1', callback_data: 'wheel_score_1' },
        { text: '2', callback_data: 'wheel_score_2' },
        { text: '3', callback_data: 'wheel_score_3' },
        { text: '4', callback_data: 'wheel_score_4' },
        { text: '5', callback_data: 'wheel_score_5' }
      ],
      [
        { text: '6', callback_data: 'wheel_score_6' },
        { text: '7', callback_data: 'wheel_score_7' },
        { text: '8', callback_data: 'wheel_score_8' },
        { text: '9', callback_data: 'wheel_score_9' },
        { text: '10', callback_data: 'wheel_score_10' }
      ],
      [
        { text: '🚪 Вийти з колеса', callback_data: 'wheel_exit' }
      ]
    ]
  }
});

const buildExitKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '🚪 Вийти з колеса', callback_data: 'wheel_exit' }]
    ]
  }
});

const todayISO = () => new Date().toISOString().split('T')[0];

// ———————————————————————————————————————————————
// ОСНОВНІ ОПЕРАЦІЇ З БАЗОЮ ДАНИХ
// ———————————————————————————————————————————————

const getActiveWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Active")`,
        maxRecords: 1,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .firstPage();

    return records.length > 0 ? records[0] : null;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка отримання активного колеса:', error);
    throw error;
  }
};

const cancelActiveWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Active")`
      })
      .all();

    if (records.length > 0) {
      const updates = records.map(record => ({
        id: record.id,
        fields: { Status: 'Cancelled' }
      }));
      
      await base(tables.WHEEL_BALANCE).update(updates);
      logger.info(`✅ [wheelBalance] Скасовано ${records.length} активних колес для ${tgId}`);
    }
    
    return true;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка скасування:', error);
    throw error;
  }
};

const getUserWheelStats = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        sort: [{ field: 'Completed_Date', direction: 'desc' }]
      })
      .all();
    
    return {
      total: records.length,
      lastScore: records.length > 0 ? records[0].fields.Total_Score : null,
      lastDate: records.length > 0 ? records[0].fields.Completed_Date : null,
      records: records.map(r => r.fields)
    };
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка статистики:', error);
    return { total: 0, lastScore: null, lastDate: null, records: [] };
  }
};

// ———————————————————————————————————————————————
// ✅ ЛОГІКА ПЕРЕВІРОК І НАГАДУВАНЬ (ВИПРАВЛЕНО)
// ———————————————————————————————————————————————

const shouldShowWheelReminder = async (tgId, userRegistrationDate) => {
  try {
    console.log(`🎯 [wheelBalance] Перевірка потреби в колесі для ${tgId}`);
    
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", OR({Status}="Completed", {Status}="Active"))`,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .all();
    
    const now = new Date();
const regDate = userRegistrationDate ? new Date(userRegistrationDate) : new Date();
    
    console.log(`🎯 [wheelBalance] Знайдено ${records.length} записів колеса для ${tgId}`);
    
    // 1. Якщо немає жодного колеса - треба перше
    if (records.length === 0) {
      const daysSinceReg = Math.floor((now - regDate) / (1000 * 60 * 60 * 24));
      console.log(`🎯 [wheelBalance] Немає жодного колеса, днів з реєстрації: ${daysSinceReg}`);
      
      return {
        needed: true,
        type: 'first',
        message: daysSinceReg === 0 ? 'Вітаю з реєстрацією! Час заповнити перше колесо балансу!' : 'Час заповнити перше колесо балансу!'
      };
    }
    
    // 2. Перевіряємо чи є активне колесо
    const activeWheel = records.find(r => r.fields.Status === 'Active');
    if (activeWheel) {
      const createdDate = new Date(activeWheel.fields.Created_Date);
      const hoursSinceCreated = (now - createdDate) / (1000 * 60 * 60);
      
      console.log(`🎯 [wheelBalance] Є активне колесо, години з створення: ${hoursSinceCreated}`);
      
      return {
        needed: true,
        type: 'continue',
        recordId: activeWheel.id,
        message: hoursSinceCreated > 24 ? 
          'У тебе є незавершене колесо балансу з минулого дня. Продовжимо?' :
          'У тебе є незавершене колесо балансу. Продовжимо?'
      };
    }
    
    // 3. Перевіряємо останнє завершене колесо
    const lastCompleted = records.find(r => r.fields.Status === 'Completed');
    if (lastCompleted) {
      const completedDate = new Date(lastCompleted.fields.Completed_Date);
      const daysSinceCompleted = Math.floor((now - completedDate) / (1000 * 60 * 60 * 24));
      
      console.log(`🎯 [wheelBalance] Останнє колесо завершено ${daysSinceCompleted} днів тому`);
      
      if (daysSinceCompleted >= 30) {
        return {
          needed: true,
          type: 'monthly',
          message: `Минуло ${daysSinceCompleted} днів з останнього колеса. Час для нового!`
        };
      }
      
      console.log(`🎯 [wheelBalance] Колесо ще свіже (${daysSinceCompleted} днів), наступне через ${30 - daysSinceCompleted} днів`);
      
      return {
        needed: false,
        type: 'recent',
        daysSince: daysSinceCompleted,
        message: `Останнє колесо було ${daysSinceCompleted} днів тому. Наступне через ${30 - daysSinceCompleted} днів.`
      };
    }
    
    // 4. Fallback - щось пішло не так
    console.log(`🎯 [wheelBalance] Fallback - пропонуємо перше колесо`);
    return { needed: true, type: 'first', message: 'Час заповнити перше колесо балансу!' };
    
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка перевірки потреби:', error);
    return { needed: true, type: 'error', message: 'Заповни колесо балансу для аналізу свого стану.' };
  }
};

// ✅ НОВА ФУНКЦІЯ: отримання користувачів, яким потрібно щомісячне нагадування
const getUsersNeedingMonthlyWheel = async () => {
  try {
    console.log('🎯 [wheelBalance] Пошук користувачів для щомісячного нагадування');

    // Використовуємо вже ініціалізований base & tables (без повторного імпорту)
    const activeUsers = await base(tables.USERS)
      .select({
        filterByFormula: `FIND('✅ Активна', {Active_Subscription_Status}) > 0`,
        fields: ['TG_id', 'User Name', 'Created_Date', 'Registration Date']
      })
      .all();

    console.log(`🎯 [wheelBalance] Знайдено ${activeUsers.length} активних користувачів`);

    const usersNeedingReminder = [];

    for (const user of activeUsers) {
      const tgId = user.fields.TG_id;
      const userName = user.fields['User Name'] || 'Користувач';
      const createdDate =
        user.fields['Registration Date'] ||
        user.fields.Created_Date ||
        new Date().toISOString();

      try {
        const wheelCheck = await shouldShowWheelReminder(tgId, createdDate);

        if (wheelCheck.needed && (wheelCheck.type === 'monthly' || wheelCheck.type === 'first')) {
          usersNeedingReminder.push({
            tgId,
            userName,
            wheelType: wheelCheck.type,
            message: wheelCheck.message
          });

          console.log(`🎯 [wheelBalance] Користувач ${tgId} (${userName}) потребує ${wheelCheck.type} колесо`);
        }

        // Затримка між запитами (анти-флуд)
        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        console.error(`❌ [wheelBalance] Помилка перевірки для користувача ${tgId}:`, error);
      }
    }

    console.log(`🎯 [wheelBalance] ✅ Знайдено ${usersNeedingReminder.length} користувачів для нагадування`);
    return usersNeedingReminder;

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка пошуку користувачів для щомісячного нагадування:', error);
    return [];
  }
};// ✅ НОВА ФУНКЦІЯ: надсилання щомісячних нагадувань
const sendMonthlyWheelReminders = async (bot) => {
  try {
    console.log('🎯 [wheelBalance] 📅 ЩОМІСЯЧНА ПЕРЕВІРКА КОЛІС БАЛАНСУ');
    
    const users = await getUsersNeedingMonthlyWheel();
    
    if (users.length === 0) {
      console.log('🎯 [wheelBalance] ℹ️ Немає користувачів для щомісячного нагадування');
      return 0;
    }
    
    let sent = 0;
    
    for (const user of users) {
      try {
        let message = '';
        let keyboard = null;
        
        if (user.wheelType === 'first') {
          message = 
            `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
            `Привіт, ${user.userName}! 👋\n\n` +
            `${user.message}\n\n` +
            `Колесо балансу допоможе:\n` +
            `• Оцінити 8 ключових сфер життя\n` +
            `• Зрозуміти сильні та слабкі сторони\n` +
            `• Отримати персональні рекомендації\n\n` +
            `⏱ Займає 5-10 хвилин`;
            
          keyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Заповнити колесо балансу', callback_data: 'wheel_start' }],
                [{ text: '❓ Дізнатися більше', callback_data: 'wheel_info' }],
                [{ text: '⏭ Пізніше', callback_data: 'dismiss_reminder' }]
              ]
            }
          };
        } else if (user.wheelType === 'monthly') {
          message = 
            `📅 ЧАС ДЛЯ НОВОГО КОЛЕСА БАЛАНСУ\n\n` +
            `Привіт, ${user.userName}! 👋\n\n` +
            `${user.message}\n\n` +
            `Регулярне заповнення колеса допомагає:\n` +
            `• Відслідковувати прогрес у розвитку\n` +
            `• Підтримувати баланс у всіх сферах\n` +
            `• Отримувати актуальні рекомендації\n\n` +
            `⏱ Оновимо твій профіль балансу?`;
            
          keyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Заповнити нове колесо', callback_data: 'wheel_start' }],
                [{ text: '📊 Переглянути прогрес', callback_data: 'wheel_stats' }],
                [{ text: '⏭ Пізніше', callback_data: 'dismiss_reminder' }]
              ]
            }
          };
        }
        
        if (message) {
          await bot.telegram.sendMessage(user.tgId, message, keyboard);
          sent++;
          console.log(`🎯 [wheelBalance] ✅ Нагадування надіслано ${user.userName} (${user.tgId})`);
          
          // Затримка між повідомленнями
          await new Promise(r => setTimeout(r, 1000));
        }
        
      } catch (sendError) {
        console.error(`❌ [wheelBalance] Помилка надсилання нагадування ${user.tgId}:`, sendError);
      }
    }
    
    console.log(`🎯 [wheelBalance] 📊 Надіслано ${sent}/${users.length} щомісячних нагадувань про колесо`);
    return sent;
    
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка щомісячних нагадувань:', error);
    return 0;
  }
};

const handleWheelBalanceRequest = async (tgId, userName, userRegistrationDate) => {
  try {
    const wheelCheck = await shouldShowWheelReminder(tgId, userRegistrationDate);
    
    if (!wheelCheck.needed) {
      return {
        type: 'not_needed',
        message: `📊 ${wheelCheck.message}\n\nТвій прогрес відслідковується. Продовжуй розвивати свої сфери життя!`,
        keyboard: {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Мій прогрес', callback_data: 'wheel_stats' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      };
    }
    
    if (wheelCheck.type === 'continue') {
      return {
        type: 'continue',
        message: `🎯 ${wheelCheck.message}`,
        keyboard: {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Продовжити', callback_data: 'wheel_continue' }],
              [{ text: '🔄 Почати заново', callback_data: 'wheel_restart' }],
              [{ text: '🚪 Вийти', callback_data: 'wheel_cancel' }]
            ]
          }
        },
        recordId: wheelCheck.recordId
      };
    }
    
    return {
      type: 'start_new',
      message: `🎯 ${wheelCheck.message}\n\nГотова оцінити 8 сфер свого життя?`,
      keyboard: {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Почати колесо', callback_data: 'wheel_start' }],
            [{ text: '❓ Що це таке?', callback_data: 'wheel_info' }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    };
    
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка обробки запиту:', error);
    return {
      type: 'error',
      message: '❌ Виникла помилка. Спробуй пізніше або зверніться до підтримки.',
      keyboard: {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    };
  }
};

// ———————————————————————————————————————————————
// ОПЕРАЦІЇ З КОЛЕСОМ
// ———————————————————————————————————————————————

const startWheelBalance = async (tgId, userName) => {
  try {
    logger.info(`🎯 [wheelBalance] ПОЧАТОК КОЛЕСА для ${tgId}`);

    // Скасовуємо активні колеса
    await cancelActiveWheel(tgId);

    // Створюємо новий запис
    const wheelData = {
      fields: {
        TG_id: String(tgId),
        'User Name': userName || 'Користувач',
        Status: 'Active',
        Step: 0,
        Created_Date: todayISO()
      }
    };

    const [wheelRecord] = await base(tables.WHEEL_BALANCE).create([wheelData], { typecast: true });
    logger.info(`🎯 [wheelBalance] ✅ Колесо створено, ID: ${wheelRecord.id}`);

    const message = 
      `🎯 КОЛЕСО БАЛАНСУ\n\n` +
      `Оціни кожну сферу життя від 0 до 10\n\n` +
      `1️⃣/8 ${LIFE_SPHERES[0]}\n\nОбери оцінку:`;

    return {
      message,
      keyboard: buildScoreKeyboard(),
      recordId: wheelRecord.id,
      currentSphere: 0
    };

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка створення:', error);
    throw error;
  }
};

const continueActiveWheel = async (tgId, ctx) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      return { error: true, message: 'Активне колесо не знайдено. Почнемо нове?' };
    }

    const currentStep = Number(activeWheel.fields.Step || 0);
    const sphereName = LIFE_SPHERES[currentStep];
    const scoreField = SPHERE_FIELDS[currentStep];
    const currentScore = activeWheel.fields[scoreField];
    
    if (currentScore != null) {
      // Якщо оцінка є - питаємо нотатку
      const message = 
        `✅ Продовжуємо колесо балансу\n\n` +
        `Оцінка ${currentScore}/10 для «${sphereName}» збережена.\n\n` +
        `✍️ Коротко опиши (2–5 речень), чому поставила таку оцінку ${currentScore} для «${sphereName}». Це допоможе точніше у звітах.`;

      ctx.session = ctx.session || {};
      ctx.session.wheel = {
        awaitingNoteFor: currentStep,
        recordId: activeWheel.id,
        lastScore: currentScore,
        sphereName: sphereName
      };

      return { message, keyboard: buildExitKeyboard() };
    } else {
      // Якщо оцінки немає - питаємо оцінку
      const message = 
        `✅ Продовжуємо колесо балансу\n\n` +
        `${currentStep + 1}️⃣/8 ${sphereName}\n\n` +
        `Обери оцінку:`;
        
      return { message, keyboard: buildScoreKeyboard() };
    }

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка продовження:', error);
    return { error: true, message: 'Помилка продовження колеса. Почнемо нове?' };
  }
};

const processWheelAnswer = async (tgId, score, ctx = null) => {
  try {
    logger.info(`🎯 [wheelBalance] Обробка відповіді ${tgId}: ${score}`);

    let activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      return { error: true, message: 'Не вдалося знайти активне колесо. Спробуй почати заново.' };
    }

    const currentStep = Number(activeWheel.fields.Step || 0);
    const sphereName = LIFE_SPHERES[currentStep];
    const airtableField = SPHERE_FIELDS[currentStep];

    // Зберігаємо оцінку
    await base(tables.WHEEL_BALANCE).update(activeWheel.id, { [airtableField]: score }, { typecast: true });

    // Питаємо нотатку
    if (ctx) {
      const message = 
        `✅ Оцінка ${score}/10 для «${sphereName}» збережена.\n\n` +
        `✍️ Коротко опиши (2–5 речень), чому поставила таку оцінку ${score} для «${sphereName}». Це допоможе точніше у звітах.`;

      try {
        await ctx.editMessageText(message, buildExitKeyboard());
      } catch {
        await ctx.reply(message, buildExitKeyboard());
      }

      ctx.session = ctx.session || {};
      ctx.session.wheel = {
        awaitingNoteFor: currentStep,
        recordId: activeWheel.id,
        lastScore: score,
        sphereName: sphereName
      };
    }

    return { completed: false, awaitingNoteFor: currentStep };

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка обробки оцінки:', error);
    return { error: true, message: 'Виникла помилка. Спробуй ще раз.' };
  }
};

const saveWheelNoteAndGoNext = async (ctx, noteText) => {
  try {
    const s = ctx.session?.wheel;
    if (!s || s.awaitingNoteFor == null || !s.recordId) {
      // Спроба відновлення сесії
      const tgId = ctx.from.id;
      const activeWheel = await getActiveWheel(tgId);
      
      if (!activeWheel) {
        return { error: true, message: 'Немає активної сфери для нотатки. Почни колесо заново.' };
      }
      
      const currentStep = Number(activeWheel.fields.Step || 0);
      const sphereName = LIFE_SPHERES[currentStep];
      const scoreField = SPHERE_FIELDS[currentStep];
      const currentScore = activeWheel.fields[scoreField];
      
      ctx.session = ctx.session || {};
      ctx.session.wheel = {
        awaitingNoteFor: currentStep,
        recordId: activeWheel.id,
        lastScore: currentScore,
        sphereName: sphereName
      };
    }

    const { awaitingNoteFor, recordId, sphereName } = ctx.session.wheel;

    // Перевіряємо що запис існує
    let rec;
    try {
      rec = await base(tables.WHEEL_BALANCE).find(recordId);
    } catch (error) {
      return { error: true, message: 'Активне колесо не знайдено. Почни заново.' };
    }

    // Зберігаємо нотатку
    const noteField = NOTE_FIELDS[awaitingNoteFor];
    if (!noteField) {
      return { error: true, message: 'Помилка визначення поля нотатки.' };
    }

    try {
      await base(tables.WHEEL_BALANCE).update(recordId, { [noteField]: noteText }, { typecast: true });
    } catch (updateError) {
      return { error: true, message: 'Помилка збереження нотатки в базу даних. Спробуй ще раз.' };
    }

    const prevStep = Number(rec.fields.Step || 0);
    const nextStep = prevStep + 1;
    const wasLast = prevStep >= (LIFE_SPHERES.length - 1);

    if (wasLast) {
      // Завершення колеса
      const allScores = SPHERE_FIELDS.map(f => Number(rec.fields[f]) || 0);
      const totalScore = Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10;

      const analysis = await generateWheelAnalysis(allScores);

      await base(tables.WHEEL_BALANCE).update(recordId, {
        Status: 'Completed',
        Completed_Date: todayISO(),
        Total_Score: totalScore,
        AI_Analysis: analysis,
        Step: LIFE_SPHERES.length
      }, { typecast: true });

      if (ctx.session && ctx.session.wheel) {
        ctx.session.wheel = null;
      }

      const message =
        `✅ Нотатку для «${sphereName}» збережено.\n\n` +
        `🎯 КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!\n\n` +
        `📊 Загальний бал: ${totalScore}/10\n\n` +
        `${analysis}`;

      return { completed: true, message };
    }

    // Перехід до наступної сфери
    await base(tables.WHEEL_BALANCE).update(recordId, { Step: nextStep }, { typecast: true });
    
    if (ctx.session && ctx.session.wheel) {
      ctx.session.wheel = null;
    }

    const nextSphereName = LIFE_SPHERES[nextStep];
    const message =
      `✅ Нотатку для «${sphereName}» збережено.\n\n` +
      `${nextStep + 1}️⃣/8 ${nextSphereName}\n\n` +
      `Обери оцінку:`;

    return { completed: false, message, keyboard: buildScoreKeyboard() };

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка збереження нотатки:', error);
    return { error: true, message: 'Не вдалося зберегти нотатку. Спробуй ще раз.' };
  }
};

// ———————————————————————————————————————————————
// АНАЛІТИКА
// ———————————————————————————————————————————————

const generateWheelAnalysis = async (scoresArr) => {
  try {
    const pairs = LIFE_SPHERES.map((name, i) => ({ 
      name, 
      score: scoresArr[i] || 0 
    }));
    
    // Розрахунок середнього балу
    const avgScore = (scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length).toFixed(1);
    
    // Визначення сфер що потребують уваги
    const weakSpheres = pairs.filter(s => s.score <= 5);
    const strongSpheres = pairs.filter(s => s.score >= 8);
    
    const prompt =
      `Проаналізуй результати колеса балансу:\n\n` +
      `${pairs.map(s => `${s.name}: ${s.score}/10`).join('\n')}\n\n` +
      `Середній бал: ${avgScore}/10\n\n` +
      `Створи аналіз у форматі:\n` +
      `✅ Колесо балансу завершено! Середній бал: ${avgScore}/10\n\n` +
      `🌟 Сильні сфери: [2-3 найвищі сфери з конкретними балами]\n` +
      `⚡ Потребують уваги: [сфери з оцінкою ≤5]\n` +
      `🎯 Рекомендації:\n` +
      `• [конкретна дія для найслабшої сфери]\n` +
      `• [порада для балансу]\n` +
      `• [як використати сильні сфери]\n\n` +
      `📈 Відстежуй прогрес щомісяця в розділі "Мій прогрес".\n\n` +
      `До 120 слів, українською мовою, практичний тон.`;

    const analysis = await chat(
      [
        { role: 'system', content: 'Ти коуч-аналітик колеса балансу. Даєш конкретні рекомендації на основі оцінок.' },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      300
    );

    // Якщо AI не відповів, створюємо fallback з логікою
    if (!analysis) {
      const weakSpheresText = weakSpheres.length > 0 
        ? weakSpheres.map(s => `${s.name} (${s.score})`).join(', ')
        : 'всі сфери збалансовані';
        
      const strongSpheresText = strongSpheres.length > 0
        ? strongSpheres.map(s => `${s.name} (${s.score})`).join(', ')
        : 'потребують підтримки';

      return `✅ Колесо балансу завершено! Середній бал: ${avgScore}/10\n\n` +
             `🌟 Сильні сфери: ${strongSpheresText}\n` +
             `⚡ Потребують уваги: ${weakSpheresText}\n\n` +
             `🎯 Рекомендація: зосередься на сферах з оцінкою ≤5 - це твої точки росту.\n\n` +
             `📈 Відстежуй прогрес щомісяця в розділі "Мій прогрес".`;
    }

    return analysis;

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка аналізу:', error);
    
    // Fallback з базовою логікою
    const avgScore = (scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length).toFixed(1);
    const lowScores = scoresArr.filter(score => score <= 5).length;
    
    return `✅ Колесо балансу завершено! Середній бал: ${avgScore}/10\n\n` +
           `🎯 ${lowScores > 0 
             ? `Рекомендую зосередитися на ${lowScores} сферах з оцінкою ≤5.` 
             : 'Чудовий баланс! Підтримуй досягнутий рівень.'}\n\n` +
           `📈 Відстежуй прогрес щомісяця в розділі "Мій прогрес".`;
  }
};

// ———————————————————————————————————————————————
// ДОПОМІЖНІ ФУНКЦІЇ
// ———————————————————————————————————————————————

const getWheelInfo = () => ({
  message: 
    `🎯 КОЛЕСО БАЛАНСУ ЖИТТЯ\n\n` +
    `📋 Що це:\n` +
    `• Інструмент самоаналізу з 8 ключових сфер життя\n` +
    `• Оцінка від 0 до 10 для кожної сфери\n` +
    `• AI-аналіз твоїх результатів\n\n` +
    `🎯 8 сфер життя:\n` +
    `${LIFE_SPHERES.map((sphere, i) => `${i + 1}. ${sphere}`).join('\n')}\n\n` +
    `⏱ Займає: 5-10 хвилин\n` +
    `📊 Результат: персональний звіт з рекомендаціями\n\n` +
    `Готова почати?`,
  keyboard: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎯 Так, почати!', callback_data: 'wheel_start' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  }
});

const isWheelActive = async (tgId) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    return !!activeWheel;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка перевірки активності:', error);
    return false;
  }
};

const isAwaitingNote = (ctx) => {
  return !!(ctx.session?.wheel?.awaitingNoteFor != null && ctx.session?.wheel?.recordId);
};

const needsWheelBalance = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        maxRecords: 1,
        sort: [{ field: 'Completed_Date', direction: 'desc' }]
      })
      .firstPage();
    
    if (records.length === 0) return true;
    
    const lastWheel = records[0];
    const completedDate = new Date(lastWheel.fields.Completed_Date);
    const now = new Date();
    const daysDiff = Math.floor((now - completedDate) / (1000 * 60 * 60 * 24));
    
    return daysDiff >= 30;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка перевірки потреби:', error);
    return false;
  }
};

// ✅ ФУНКЦІЯ ДЛЯ ВІДНОВЛЕННЯ ЗАВИСЛОГО КОЛЕСА
const recoverStuckWheel = async (tgId, ctx) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    
    if (!activeWheel) {
      return { 
        error: true, 
        message: 'Активне колесо не знайдено.' 
      };
    }

    const currentStep = Number(activeWheel.fields.Step || 0);
    const sphereName = LIFE_SPHERES[currentStep];
    const scoreField = SPHERE_FIELDS[currentStep];
    const currentScore = activeWheel.fields[scoreField];
    
    if (currentScore != null) {
      // Є оцінка, чекаємо нотатку
      ctx.session = ctx.session || {};
      ctx.session.wheel = {
        awaitingNoteFor: currentStep,
        recordId: activeWheel.id,
        lastScore: currentScore,
        sphereName: sphereName
      };
      
      return {
        error: false,
        message: `Продовжуємо з нотатки для «${sphereName}» (оцінка ${currentScore}/10).\n\nОпиши коротко (2-5 речень), чому така оцінка:`,
        keyboard: buildExitKeyboard()
      };
    } else {
      // Немає оцінки, питаємо оцінку
      return {
        error: false,
        message: `Продовжуємо з оцінки.\n\n${currentStep + 1}️⃣/8 ${sphereName}\n\nОбери оцінку:`,
        keyboard: buildScoreKeyboard()
      };
    }
    
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка відновлення:', error);
    return { 
      error: true, 
      message: 'Помилка відновлення колеса. Почни заново.' 
    };
  }
};

// ———————————————————————————————————————————————
// ЕКСПОРТИ
// ———————————————————————————————————————————————

export default {
  // Основні операції
  getActiveWheel,
  cancelActiveWheel,
  getUserWheelStats,
  
  // Логіка перевірок
  shouldShowWheelReminder,
  handleWheelBalanceRequest,
  
  // ✅ НОВІ ФУНКЦІЇ ДЛЯ ЩОМІСЯЧНИХ НАГАДУВАНЬ
  getUsersNeedingMonthlyWheel,
  sendMonthlyWheelReminders,
  
  // Операції з колесом
  startWheelBalance,
  continueActiveWheel,
  processWheelAnswer,
  saveWheelNoteAndGoNext,
  recoverStuckWheel,
  
  // Допоміжні функції
  getWheelInfo,
  isWheelActive,
  isAwaitingNote,
  needsWheelBalance,
  buildExitKeyboard,
  buildScoreKeyboard,
  
  // Константи
  LIFE_SPHERES
};