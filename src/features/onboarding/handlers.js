// src/features/onboarding/handlers.js
// ВИПРАВЛЕНІ НАЗВИ ПОЛІВ — використовуємо "Time Zone" (лейбл)

import { 
  MESSAGES, 
  ANSWER_STEPS, 
  SUBSCRIPTION_PLANS,
  USER_STATUS,
  getTzLabel,                // ✅ додаємо щоб мапити slug → label
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

/**
 * Отримати користувача з БД
 */
export const getUserByTgId = async (tgId) => {
  try {
    const formula = `{TG_id} = "${tgId}"`;
    const records = await selectFromTable(tables.USERS, {
      filterByFormula: formula,
      maxRecords: 1
    }).firstPage();

    return records[0] || null;
  } catch (error) {
    console.error('[onboarding/getUserByTgId] ❌ Помилка:', error);
    return null;
  }
};

/**
 * Створити нового користувача
 */
export const createUser = async (tgId, firstName) => {
  try {
    const userName = firstName || `User_${tgId}`;
    
    const newUser = await createRows(tables.USERS, [{
      fields: {
        TG_id: String(tgId),
        "User Name": userName,
        Status: USER_STATUS.NEW,
        Answer_Step: ANSWER_STEPS.OB_NAME,
        // Created_At: new Date().toISOString()
      }
    }]);

    console.log(`[onboarding/createUser] ✅ Створено: ${tgId}`);
    return newUser[0];
  } catch (error) {
    console.error('[onboarding/createUser] ❌ Помилка:', error);
    throw error;
  }
};

/**
 * Оновити дані користувача
 */
export const updateUser = async (recordId, fields) => {
  try {
    const updated = await updateRows(tables.USERS, [{
      id: recordId,
      fields: {
        ...fields,
        // Updated_At: new Date().toISOString() // якщо є таке поле — розкоментуй
      }
    }]);

    console.log(`[onboarding/updateUser] ✅ Оновлено: ${recordId}`);
    return updated[0];
  } catch (error) {
    console.error('[onboarding/updateUser] ❌ Помилка:', error);
    throw error;
  }
};

/**
 * Створити пробну підписку
 */
export const createTrialSubscription = async (userRecordId, tgId, userName) => {
  try {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + SUBSCRIPTION_PLANS.TRIAL.duration);

    const subscription = await createRows(tables.SUBSCRIPTIONS, [{
      fields: {
        TG_id: String(tgId),
        "User Name": userName || `User_${tgId}`,
        Plan_Name: SUBSCRIPTION_PLANS.TRIAL.key,
        Status: 'Active',
        Start_Date: now.toISOString().split('T')[0],
        End_Date: endDate.toISOString().split('T')[0],
        // Created_At: new Date().toISOString()
      }
    }]);

    console.log(`[onboarding/createTrialSubscription] ✅ Підписка для ${tgId}`);
    return subscription[0];
  } catch (error) {
    console.error('[onboarding/createTrialSubscription] ❌ Помилка:', error);
    throw error;
  }
};

/**
 * Форматувати дату для відображення
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// ===== ОБРОБНИКИ КРОКІВ =====

/**
 * КРОК 1: Початок реєстрації / Привітання зареєстрованого користувача
 */
export const handleStart = async (ctx) => {
  const tgId = ctx.from.id;
  const firstName = ctx.from.first_name || '';

  try {
    await typing(ctx);

    let user = await getUserByTgId(tgId);

    // ===== КОРИСТУВАЧ ВПЕРШЕ =====
    if (!user) {
      console.log(`[onboarding/handleStart] 🆕 Новий користувач: ${tgId}`);
      user = await createUser(tgId, firstName);

      await ctx.reply(
        MESSAGES.ONBOARDING_NAME_CHOICE(firstName),
        keyboards.kbConfirmName(firstName)
      );
      return true;
    }

    // ===== КОРИСТУВАЧ ВЖЕ Є =====
    const answerStep = user.fields.Answer_Step;
    const status = user.fields.Status;
    const userName = user.fields['User Name'] || firstName;

    console.log(`[onboarding/handleStart] 👤 Користувач: ${userName}, Status: ${status}, Step: ${answerStep}`);

    // Зареєстрований користувач
    if (status === USER_STATUS.REGISTERED || status === USER_STATUS.ACTIVE || answerStep === ANSWER_STEPS.COMPLETED) {
      console.log(`[onboarding/handleStart] ✅ Зареєстрований користувач`);

      const subscriptionStatus = user.fields['Subscription_Status'];
      const endDate = user.fields.End_Date;

      // СТАТИСТИКА (якщо є такі поля)
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
      return true;
    }

    // ===== РЕЄСТРАЦІЯ НЕ ЗАВЕРШЕНА - ПРОДОВЖУЄМО =====
    console.log(`[onboarding/handleStart] ⏸️ Продовження реєстрації з кроку: ${answerStep}`);

    if (answerStep === ANSWER_STEPS.OB_NAME) {
      await ctx.reply(
        MESSAGES.ONBOARDING_NAME_CHOICE(userName),
        keyboards.kbConfirmName(userName)
      );
      return true;
    }

    if (answerStep === ANSWER_STEPS.OB_EMAIL) {
      await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.kbSkipEmail());
      return true;
    }

    if (answerStep === ANSWER_STEPS.OB_PHONE) {
      await ctx.reply(MESSAGES.ASK_PHONE, keyboards.kbSkipPhone());
      return true;
    }

    if (answerStep === ANSWER_STEPS.OB_TZ) {
      await ctx.reply(MESSAGES.ASK_TIMEZONE, keyboards.timezoneKeyboard());
      return true;
    }

    if (answerStep === ANSWER_STEPS.OB_PLAN) {
      await ctx.reply(MESSAGES.ASK_PLAN, keyboards.subscriptionPlansKeyboard());
      return true;
    }

    // Якщо статус NEW але крок невідомий - починаємо з імені
    if (status === USER_STATUS.NEW) {
      await ctx.reply(
        MESSAGES.ONBOARDING_NAME_CHOICE(userName),
        keyboards.kbConfirmName(userName)
      );
      return true;
    }

    // Фолбек — показати меню
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

    return true;
  } catch (error) {
    console.error('[onboarding/handleStart] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

/**
 * КРОК 2: Обробка введення імені
 */
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
    console.error('[onboarding/handleNameInput] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

/**
 * КРОК 3: Обробка введення email
 */
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
    console.error('[onboarding/handleEmailInput] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

/**
 * КРОК 4: Обробка введення телефону
 */
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
    console.error('[onboarding/handlePhoneInput] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

/**
 * КРОК 5: Завершення реєстрації
 */
export const completeRegistration = async (ctx, planKey = 'TRIAL') => {
  const tgId = ctx.from.id;

  try {
    await typing(ctx, 1200);

    const user = await getUserByTgId(tgId);
    if (!user) {
      await ctx.reply(MESSAGES.ERROR_GENERIC);
      return false;
    }

    const userName = user.fields['User Name'] || `User_${tgId}`;

    // Створюємо пробну підписку
    let subscription = null;
    if (planKey === 'TRIAL') {
      subscription = await createTrialSubscription(user.id, tgId, userName);
      
      // Оновлюємо користувача з датами підписки
      await updateUser(user.id, {
        Status: USER_STATUS.ACTIVE,
        Answer_Step: ANSWER_STEPS.COMPLETED,
        "Subscription_Status": 'Active',
        "Active Subscription Plan": SUBSCRIPTION_PLANS.TRIAL.key,
        Start_Date: subscription.fields.Start_Date,
        End_Date: subscription.fields.End_Date
      });
    } else {
      // Якщо інший план - оновлюємо без підписки
      await updateUser(user.id, {
        Status: USER_STATUS.ACTIVE,
        Answer_Step: ANSWER_STEPS.COMPLETED
      });
    }

    // Повідомлення про успішну реєстрацію
    const userData = {
      name: userName,
      email: user.fields.Email || 'не вказано',
      phone: user.fields.Phone || 'не вказано',
      timezone: user.fields['Time Zone'] || 'не вказано', // ✅ правильне поле
      endDate: subscription ? formatDate(subscription.fields.End_Date) : 'не активовано'
    };

    await ctx.reply(
      MESSAGES.REGISTRATION_INFO(userData),
      keyboards.afterRegistrationKeyboard()
    );

    console.log(`[onboarding/completeRegistration] ✅ Завершено: ${tgId}`);
    return true;
  } catch (error) {
    console.error('[onboarding/completeRegistration] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

/**
 * Обробка callback кнопок онбордингу
 */
export const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  const tgId = ctx.from.id;

  if (!data) return false;

  const onboardingCallbacks = [
    'use_telegram_name',
    'enter_custom_name',
    'confirm_name',
    'change_name',
    'skip_email',
    'back_to_name',
    'skip_phone',
    'back_to_email',
    'back_to_phone',
    'back_to_timezone',
    'activate_trial',
    'subscribe_week',
    'subscribe_month',
    'subscribe_year',
    'skip_subscription'
  ];

  const isTzCallback = data.startsWith('tz_');
  const isOnboardingCallback = onboardingCallbacks.includes(data) || isTzCallback;

  if (!isOnboardingCallback) return false;

  try {
    await ctx.answerCbQuery();
    await typing(ctx);

    const user = await getUserByTgId(tgId);
    if (!user) return false;

    // ===== ІМ'Я =====
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

    // ===== EMAIL =====
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

    // ===== ТЕЛЕФОН =====
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

    // ===== ЧАСОВИЙ ПОЯС =====
    if (data.startsWith('tz_')) {
      const tzSlug = data.replace('tz_', '');
      const tzLabel = getTzLabel(tzSlug) || tzSlug;   // підстраховка

      await updateUser(user.id, {
        "Time Zone": tzLabel,                          // ✅ єдине правильне поле
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

    // ===== ПІДПИСКА =====
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

    return false;
  } catch (error) {
    console.error('[onboarding/handleCallback] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return false;
  }
};

/**
 * Обробка текстових повідомлень
 */
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
    console.error('[onboarding/handleText] ❌ Помилка:', error);
    return false;
  }
};

console.log('✅ [onboarding/handlers] Handlers завантажено');
