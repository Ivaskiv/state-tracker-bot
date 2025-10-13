// src/features/onboarding/handlers.js
// ПОВНА ВЕРСІЯ З ВИПРАВЛЕННЯМ ПОМИЛКИ

import { 
  MESSAGES, 
  ANSWER_STEPS, 
  SUBSCRIPTION_PLANS,
  USER_STATUS,
  getTzLabel,
} from '../../config/constants.js';

import { 
  validateName, 
  validateEmail, 
  validatePhone
} from '../../utils/validators.js';

import { tables, selectFromTable, updateRows, createRows } from '../../config/database.js';
import keyboards from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';

// ===== ДОПОМІЖНІ ФУНКЦІЇ БД =====

export const getUserByTgId = async (tgId) => {
  try {
    const formula = `{TG_id} = "${tgId}"`;
    console.log(`[getUserByTgId] 🔍 Перевірка Users: TG_id=${tgId}`);
    
    const records = await selectFromTable(tables.USERS, {
      filterByFormula: formula,
      maxRecords: 1
    }).firstPage();

    if (records.length > 0) {
      console.log(`[getUserByTgId] ✅ ЗНАЙДЕНО в Users: ${records[0].id}`);
      return records[0];
    }

    console.log(`[getUserByTgId] ❌ НЕ ЗНАЙДЕНО в Users`);
    return null;
  } catch (error) {
    console.error('[getUserByTgId] ❌ Помилка:', error);
    return null;
  }
};

export const createUser = async (tgId, firstName) => {
  try {
    const userName = firstName || `User_${tgId}`;
    
    console.log(`[createUser] 📝 СТВОРЕННЯ NEW USER:`);
    console.log(`   TG_id: ${tgId}`);
    console.log(`   User Name: ${userName}`);
    
    const newUser = await createRows(tables.USERS, [{
      fields: {
        TG_id: String(tgId),
        "User Name": userName,
        Status: 'New User',
        Answer_Step: ANSWER_STEPS.OB_PITCH,
        Created_At: new Date().toISOString()
      }
    }]);

    console.log(`[createUser] ✅ NEW USER СТВОРЕНО: ${newUser[0].id}`);
    return newUser[0];
  } catch (error) {
    console.error('[createUser] ❌ Помилка:', error);
    throw error;
  }
};

export const updateUser = async (recordId, fields) => {
  try {
    console.log(`[updateUser] 🔄 Оновлення ${recordId}`);
    
    const updated = await updateRows(tables.USERS, [{
      id: recordId,
      fields: {
        ...fields,
        Updated_At: new Date().toISOString()
      }
    }]);

    console.log(`[updateUser] ✅ Оновлено`);
    return updated[0];
  } catch (error) {
    console.error('[updateUser] ❌ Помилка:', error);
    throw error;
  }
};

export const createTrialSubscription = async (userRecordId, tgId, userName) => {
  try {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + SUBSCRIPTION_PLANS.TRIAL.duration);

    console.log(`[createTrialSubscription] 💰 Створення підписки для ${tgId}`);

    const subscription = await createRows(tables.SUBSCRIPTIONS, [{
      fields: {
        TG_id: String(tgId),
        "User Name": userName || `User_${tgId}`,
        Plan_Name: SUBSCRIPTION_PLANS.TRIAL.key,
        Status: 'Active',
        Start_Date: now.toISOString().split('T')[0],
        End_Date: endDate.toISOString().split('T')[0],
        Created_At: new Date().toISOString()
      }
    }]);

    console.log(`[createTrialSubscription] ✅ Підписка створена`);
    return subscription[0];
  } catch (error) {
    console.error('[createTrialSubscription] ❌ Помилка:', error);
    throw error;
  }
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// ===== ГОЛОВНИЙ ОБРОБНИК /start =====

export const handleStart = async (ctx) => {
  const tgId = ctx.from.id;
  const firstName = ctx.from.first_name || '';

  try {
    await typing(ctx);

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`[handleStart] 🚀 /start від ${tgId} (${firstName})`);
    console.log('═══════════════════════════════════════════════════════');

    const user = await getUserByTgId(tgId);

    // КОРИСТУВАЧА НЕМАЄ
    if (!user) {
      console.log('[handleStart] 🆕 НОВИЙ КОРИСТУВАЧ');
      
      await ctx.reply(
        `👋 Привіт, ${firstName}!\n\n` +
        `Я твій AI-мотиватор та коуч! Допомагаю:\n` +
        `🎯 Ставити та досягати цілі\n` +
        `⚖️ Знаходити баланс у житті\n` +
        `💪 Підтримувати мотивацію\n` +
        `📈 Відслідковувати прогрес\n\n` +
        `Готова розпочати?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Почати реєстрацію', callback_data: 'start_registration' }],
              [{ text: '⏭️ Пізніше', callback_data: 'later_registration' }],
              [{ text: '❌ Завершити без реєстрації', callback_data: 'skip_registration' }]
            ]
          }
        }
      );
      
      console.log('═══════════════════════════════════════════════════════');
      return true;
    }

    // КОРИСТУВАЧ Є
    const status = user.fields.Status;
    const answerStep = user.fields.Answer_Step;
    const userName = user.fields['User Name'] || firstName;

    console.log(`[handleStart] ✅ ІСНУЮЧИЙ: Status=${status}, Step=${answerStep}`);

    // ЗАРЕЄСТРОВАНИЙ
    const isRegistered = status === 'Registered User' || status === 'Active User';

    if (isRegistered) {
      console.log('[handleStart] → Показуємо меню');

      const subscriptionStatus = user.fields['Subscription_Status'];
      const endDate = user.fields.End_Date;

      const stats = {
        currentStreak: user.fields.Current_Streak || 0,
        completedSessions: user.fields.Total_Sessions || 0,
        wheelCompleted: user.fields.Wheel_Completed || false,
        goalProgress: user.fields.Goal_Progress || 0
      };

      if (subscriptionStatus === 'Active' && endDate) {
        await ctx.reply(
          MESSAGES.WELCOME_BACK_ACTIVE(userName, formatDate(endDate), stats),
          keyboards.mainMenuKeyboard()
        );
      } else {
        await ctx.reply(
          MESSAGES.WELCOME_BACK_INACTIVE(userName, stats),
          keyboards.mainMenuKeyboard()
        );
      }

      console.log('═══════════════════════════════════════════════════════');
      return true;
    }

    // NEW USER - ПРОДОВЖУЄМО
    console.log('[handleStart] → Продовжуємо реєстрацію');

    if (!answerStep || answerStep === ANSWER_STEPS.OB_PITCH) {
      await ctx.reply(
        MESSAGES.ONBOARDING_NAME_CHOICE(userName),
        keyboards.nameChoiceInline()
      );
      console.log('═══════════════════════════════════════════════════════');
      return true;
    }

    if (answerStep === ANSWER_STEPS.OB_NAME) {
      await ctx.reply(
        MESSAGES.ONBOARDING_NAME_CHOICE(userName),
        keyboards.kbConfirmName(userName)
      );
      console.log('═══════════════════════════════════════════════════════');
      return true;
    }

    if (answerStep === ANSWER_STEPS.OB_EMAIL) {
      await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.kbSkipEmail());
      console.log('═══════════════════════════════════════════════════════');
      return true;
    }

    if (answerStep === ANSWER_STEPS.OB_PHONE) {
      await ctx.reply(MESSAGES.ASK_PHONE, keyboards.kbSkipPhone());
      console.log('═══════════════════════════════════════════════════════');
      return true;
    }

    if (answerStep === ANSWER_STEPS.OB_TZ) {
      await ctx.reply(MESSAGES.ASK_TIMEZONE, keyboards.timezoneKeyboard());
      console.log('═══════════════════════════════════════════════════════');
      return true;
    }

    if (answerStep === ANSWER_STEPS.OB_PLAN) {
      await ctx.reply(MESSAGES.ASK_PLAN, keyboards.subscriptionPlansKeyboard());
      console.log('═══════════════════════════════════════════════════════');
      return true;
    }

    console.log('═══════════════════════════════════════════════════════');
    return true;

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════');
    console.error('[handleStart] ❌ ПОМИЛКА:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════');
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

// ===== ОБРОБКА CALLBACK =====

export const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  const tgId = ctx.from.id;

  if (!data) return false;

  console.log(`[handleCallback] 🎯 Callback: ${data} від ${tgId}`);

  try {
    await ctx.answerCbQuery();
    await typing(ctx);

    // ПОЧАТОК РЕЄСТРАЦІЇ
    if (data === 'start_registration') {
      console.log('[handleCallback] ✅ ПОЧАТОК РЕЄСТРАЦІЇ');
      
      let user = await getUserByTgId(tgId);
      
      if (!user) {
        console.log('[handleCallback] → Створюємо NEW USER');
        user = await createUser(tgId, ctx.from.first_name);
      }
      
      const userName = user.fields['User Name'] || ctx.from.first_name;
      
      await ctx.reply(
        MESSAGES.ONBOARDING_NAME_CHOICE(userName),
        keyboards.nameChoiceInline()
      );
      return true;
    }

    // ПІЗНІШЕ
    if (data === 'later_registration') {
      console.log('[handleCallback] ⏭️ ПІЗНІШЕ');
      
      let user = await getUserByTgId(tgId);
      
      if (!user) {
        user = await createUser(tgId, ctx.from.first_name);
      }
      
      await ctx.reply(
        '✅ Добре! Коли будеш готова - натисни /start',
        keyboards.mainMenuKeyboard()
      );
      return true;
    }

    // ЗАВЕРШИТИ БЕЗ РЕЄСТРАЦІЇ
    if (data === 'skip_registration') {
      console.log('[handleCallback] ❌ БЕЗ РЕЄСТРАЦІЇ');
      
      let user = await getUserByTgId(tgId);
      
      if (!user) {
        user = await createUser(tgId, ctx.from.first_name);
      }
      
      await ctx.reply(
        '✅ Окей! Базові функції доступні.\n\nДля повного доступу - /start',
        keyboards.mainMenuKeyboard()
      );
      return true;
    }

    // ВСІ ІНШІ КНОПКИ - ПОТРЕБУЮТЬ КОРИСТУВАЧА
    const user = await getUserByTgId(tgId);
    
    if (!user) {
      console.error('[handleCallback] ❌ Користувач не знайдений');
      await ctx.reply('❌ Помилка. Почни заново: /start');
      return false;
    }

    console.log('[handleCallback] ✅ Користувач знайдений, обробляємо');

    // ІМ'Я
    if (data === 'use_telegram_name') {
      await updateUser(user.id, { Answer_Step: ANSWER_STEPS.OB_EMAIL });
      await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.kbSkipEmail());
      return true;
    }

    if (data === 'enter_custom_name' || data === 'change_name') {
      await updateUser(user.id, { Answer_Step: ANSWER_STEPS.OB_NAME });
      await ctx.reply(MESSAGES.ASK_NAME);
      return true;
    }

    if (data === 'confirm_name') {
      await updateUser(user.id, { Answer_Step: ANSWER_STEPS.OB_EMAIL });
      await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.kbSkipEmail());
      return true;
    }

    // EMAIL
    if (data === 'skip_email') {
      await updateUser(user.id, { Answer_Step: ANSWER_STEPS.OB_PHONE });
      await ctx.reply(MESSAGES.ASK_PHONE, keyboards.kbSkipPhone());
      return true;
    }

    if (data === 'back_to_name') {
      const userName = user.fields['User Name'] || 'Користувач';
      await updateUser(user.id, { Answer_Step: ANSWER_STEPS.OB_NAME });
      await ctx.reply(
        MESSAGES.ONBOARDING_NAME_CHOICE(userName),
        keyboards.kbConfirmName(userName)
      );
      return true;
    }

    // ТЕЛЕФОН
    if (data === 'skip_phone') {
      await updateUser(user.id, { Answer_Step: ANSWER_STEPS.OB_TZ });
      await ctx.reply(MESSAGES.ASK_TIMEZONE, keyboards.timezoneKeyboard());
      return true;
    }

    if (data === 'back_to_email') {
      await updateUser(user.id, { Answer_Step: ANSWER_STEPS.OB_EMAIL });
      await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.kbSkipEmail());
      return true;
    }

    // ЧАСОВИЙ ПОЯС
    if (data.startsWith('tz_')) {
      const tzSlug = data.replace('tz_', '');
      const tzLabel = getTzLabel(tzSlug) || tzSlug;

      await updateUser(user.id, {
        "Time Zone": tzLabel,
        Answer_Step: ANSWER_STEPS.OB_PLAN
      });

      await ctx.reply(MESSAGES.ASK_PLAN, keyboards.subscriptionPlansKeyboard());
      return true;
    }

    if (data === 'back_to_phone') {
      await updateUser(user.id, { Answer_Step: ANSWER_STEPS.OB_PHONE });
      await ctx.reply(MESSAGES.ASK_PHONE, keyboards.kbSkipPhone());
      return true;
    }

    // ПІДПИСКА
    if (data === 'activate_trial') {
      await completeRegistration(ctx, 'TRIAL');
      return true;
    }

    if (data === 'subscribe_week') {
      await completeRegistration(ctx, 'WEEK');
      return true;
    }

    if (data === 'subscribe_month') {
      await completeRegistration(ctx, 'MONTH');
      return true;
    }

    if (data === 'subscribe_year') {
      await completeRegistration(ctx, 'YEAR');
      return true;
    }

    if (data === 'skip_subscription') {
      await completeRegistration(ctx, null);
      return true;
    }

    if (data === 'back_to_timezone') {
      await updateUser(user.id, { Answer_Step: ANSWER_STEPS.OB_TZ });
      await ctx.reply(MESSAGES.ASK_TIMEZONE, keyboards.timezoneKeyboard());
      return true;
    }

    console.log('[handleCallback] ℹ️ Callback не оброблений');
    return false;

  } catch (error) {
    console.error('[handleCallback] ❌ ПОМИЛКА:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

// ===== ТЕКСТОВІ ПОВІДОМЛЕННЯ =====

export const handleNameInput = async (ctx, text) => {
  const tgId = ctx.from.id;

  try {
    await typing(ctx);

    const validation = validateName(text);

    if (!validation.valid) {
      await ctx.reply(`${MESSAGES.ERROR_NAME}\n\n💡 ${validation.error}`);
      return true;
    }

    const user = await getUserByTgId(tgId);
    if (!user) {
      await ctx.reply(MESSAGES.ERROR_GENERIC);
      return false;
    }

    await updateUser(user.id, {
      "User Name": validation.value,
      Answer_Step: ANSWER_STEPS.OB_EMAIL
    });

    await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.kbSkipEmail());
    return true;
  } catch (error) {
    console.error('[handleNameInput] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

export const handleEmailInput = async (ctx, text) => {
  const tgId = ctx.from.id;

  try {
    await typing(ctx);

    const validation = validateEmail(text);

    if (!validation.valid) {
      await ctx.reply(`${MESSAGES.ERROR_EMAIL}\n\n💡 ${validation.error}`, keyboards.kbSkipEmail());
      return true;
    }

    const user = await getUserByTgId(tgId);
    if (!user) {
      await ctx.reply(MESSAGES.ERROR_GENERIC);
      return false;
    }

    await updateUser(user.id, {
      Email: validation.value,
      Answer_Step: ANSWER_STEPS.OB_PHONE
    });

    await ctx.reply(MESSAGES.ASK_PHONE, keyboards.kbSkipPhone());
    return true;
  } catch (error) {
    console.error('[handleEmailInput] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

export const handlePhoneInput = async (ctx, text) => {
  const tgId = ctx.from.id;

  try {
    await typing(ctx);

    const validation = validatePhone(text);

    if (!validation.valid) {
      await ctx.reply(`${MESSAGES.ERROR_PHONE}\n\n💡 ${validation.error}`, keyboards.kbSkipPhone());
      return true;
    }

    const user = await getUserByTgId(tgId);
    if (!user) {
      await ctx.reply(MESSAGES.ERROR_GENERIC);
      return false;
    }

    await updateUser(user.id, {
      Phone: validation.value,
      Answer_Step: ANSWER_STEPS.OB_TZ
    });

    await ctx.reply(MESSAGES.ASK_TIMEZONE, keyboards.timezoneKeyboard());
    return true;
  } catch (error) {
    console.error('[handlePhoneInput] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

export const handleText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();

  if (!text) return false;

  try {
    const user = await getUserByTgId(tgId);
    if (!user) return false;

    const answerStep = user.fields.Answer_Step;

    if (answerStep === ANSWER_STEPS.OB_NAME) {
      return await handleNameInput(ctx, text);
    }

    if (answerStep === ANSWER_STEPS.OB_EMAIL) {
      return await handleEmailInput(ctx, text);
    }

    if (answerStep === ANSWER_STEPS.OB_PHONE) {
      return await handlePhoneInput(ctx, text);
    }

    return false;
  } catch (error) {
    console.error('[handleText] ❌ Помилка:', error);
    return false;
  }
};

// ===== ЗАВЕРШЕННЯ РЕЄСТРАЦІЇ =====

export const completeRegistration = async (ctx, planKey = 'TRIAL') => {
  const tgId = ctx.from.id;

  try {
    await typing(ctx, 1200);

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`[completeRegistration] 🎉 ЗАВЕРШЕННЯ`);
    console.log('═══════════════════════════════════════════════════════');

    const user = await getUserByTgId(tgId);
    
    if (!user) {
      await ctx.reply(MESSAGES.ERROR_GENERIC);
      return false;
    }

    const userName = user.fields['User Name'] || `User_${tgId}`;

    let subscription = null;
    
    if (planKey === 'TRIAL') {
      subscription = await createTrialSubscription(user.id, tgId, userName);
      
      console.log('[completeRegistration] ✅ STATUS → "Registered User"');
      await updateUser(user.id, {
        Status: 'Registered User',
        Answer_Step: ANSWER_STEPS.COMPLETED,
        "Subscription_Status": 'Active',
        "Active Subscription Plan": SUBSCRIPTION_PLANS.TRIAL.key,
        Start_Date: subscription.fields.Start_Date,
        End_Date: subscription.fields.End_Date
      });
    } else {
      console.log('[completeRegistration] ✅ STATUS → "Registered User" (без підписки)');
      await updateUser(user.id, {
        Status: 'Registered User',
        Answer_Step: ANSWER_STEPS.COMPLETED
      });
    }

    const userData = {
      name: userName,
      email: user.fields.Email || 'не вказано',
      phone: user.fields.Phone || 'не вказано',
      timezone: user.fields['Time Zone'] || 'не вказано',
      endDate: subscription ? formatDate(subscription.fields.End_Date) : 'не активовано'
    };

    await ctx.reply(
      MESSAGES.REGISTRATION_INFO(userData),
      keyboards.afterRegistrationKeyboard()
    );

    console.log('[completeRegistration] ✅ ЗАВЕРШЕНО');
    console.log('═══════════════════════════════════════════════════════');
    
    return true;
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════');
    console.error('[completeRegistration] ❌ ПОМИЛКА:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════');
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

console.log('✅ [onboarding/handlers] Handlers завантажено');