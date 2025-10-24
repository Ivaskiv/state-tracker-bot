// src/utils/keyboards.js

import { TIMEZONES } from "../config/constants.js";

// import { TIMEZONES } from "../config/index.js";

const kbRow = (...btns) => btns.map((b) => ({ text: b.text, callback_data: b.callback_data }));

const keyboards = {
  // 🏠 ГОЛОВНЕ МЕНЮ
  mainMenuKeyboard: () => ({
    reply_markup: {
      keyboard: [
        [{ text: '📊 Мій прогрес та Звіти' }, { text: 'ℹ️ Інформація про бота' }],
        [{ text: '💰 Підписка' }, { text: '📞 Звʼязок' }],
        [{ text: '🤖 AI Наставник' }, { text: '🎯 Колесо балансу' }],
        [{ text: '🌞 Ранкова сесія' }, { text: '🌙 Вечірня сесія' }],

      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      is_persistent: true,
    },
  }),

  infoMenuInline: (showCapabilities = false) => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '📋 Можливості', callback_data: 'show_capabilities' }),
        showCapabilities ? kbRow({ text: '📝 Інструкції', callback_data: 'instructions' }) : null,
        kbRow({ text: '🔙 Назад', callback_data: 'main_menu' }),
      ].filter(Boolean),
    },
  }),

  contactMenuInline: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '📞 Підтримка', callback_data: 'contact_support' }),
        kbRow({ text: '🧭 Фокус дня', callback_data: 'show_affirmation' }),
        kbRow({ text: '❓ Допомога', callback_data: 'help' }),
        kbRow({ text: '🔙 Назад', callback_data: 'main_menu' }),
      ],
    },
  }),

  subscriptionMenuInline: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '📋 Статус підписки', callback_data: 'subscription_info' }),
        kbRow({ text: '💳 Оформити/Продовжити', callback_data: 'subscription_plans' }),
        kbRow({ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }),
        kbRow({ text: '🔙 Назад', callback_data: 'main_menu' }),
      ],
    },
  }),

  afterRegistrationKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🎯 Почати колесо балансу', callback_data: 'wheel_start' }),
        kbRow({ text: '⏭️ Пізніше', callback_data: 'skip_first_wheel' }),
        kbRow({ text: '📋 Що можу робити?', callback_data: 'show_capabilities' }),
      ],
    },
  }),

  // 🌍 ТАЙМЗОНИ
  timezoneKeyboard: (TZ_PREFIX = 'ob_tz_') => {
    const rows = TIMEZONES.map((tz) =>
      kbRow({ text: tz.label, callback_data: `${TZ_PREFIX}${tz.slug}` })
    );
    rows.push(kbRow({ text: '🔙 Назад', callback_data: 'back_to_phone' }));
    return { reply_markup: { inline_keyboard: rows } };
  },

  // 🌞 / 🌙 РЕФЛЕКСІЇ
  morningStartInline: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🌞 Почати ранкову рефлексію', callback_data: 'start_morning' }),
        kbRow({ text: '⏭ Пізніше', callback_data: 'later_morning' }),
      ],
    },
  }),

  eveningStartInline: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🌙 Почати вечірню рефлексію', callback_data: 'start_evening' }),
        kbRow({ text: '⏭ Пізніше', callback_data: 'later_evening' }),
      ],
    },
  }),

  buildExitKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [kbRow({ text: '🚪 Вийти з сесії', callback_data: 'exit_session' })],
    },
  }),

  buildRestartWarningKeyboard: (type) => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🔄 Почати заново', callback_data: `restart_${type}` }),
        kbRow({ text: '✅ Залишити як є', callback_data: 'dismiss_reminder' }),
      ],
    },
  }),

  buildEveningWithoutMorningKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🌞 Пройти ранкові зараз', callback_data: 'start_morning' }),
        kbRow({ text: '⏭️ Пропустити ранкові', callback_data: 'skip_morning_do_evening' }),
      ],
    },
  }),

  // 🧪 ПЛАНИ ПІДПИСКИ
  subscriptionPlansKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🧪 Пробний період — 7 днів (0€)', callback_data: 'activate_trial' }),
        kbRow({ text: '📅 Тиждень фокусу — 7€', callback_data: 'subscribe_week' }),
        kbRow({ text: '🎯 Місяць дії — 30€', callback_data: 'subscribe_month' }),
        kbRow({ text: '⭐ Рік трансформації — 300€', callback_data: 'subscribe_year' }),
        kbRow({ text: '⏭️ Без підписки', callback_data: 'skip_subscription' }),
        kbRow({ text: '🔙 Назад', callback_data: 'back_to_timezone' }),
      ],
    },
  }),

  subscriptionInfoActiveKeyboard: (expiringSoon = false) => ({
    reply_markup: {
      inline_keyboard: [
        expiringSoon
          ? kbRow({ text: '🔄 Продовжити підписку', callback_data: 'renew_subscription' })
          : kbRow({ text: '✅ Дякую!', callback_data: 'dismiss_notification' }),
        kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }),
      ],
    },
  }),

  subscriptionInfoInactiveKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '💳 Обрати план', callback_data: 'subscription_plans' }),
        kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }),
      ],
    },
  }),

  subscriptionPaymentKeyboard: (paymentLink) => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Перейти до оплати', url: paymentLink }],
        [{ text: '🔄 Перевірити оплату', callback_data: 'sync_subscription' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }],
      ],
    },
  }),

  subscriptionRenewalKeyboard: (paymentLink) => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Продовжити', url: paymentLink }],
        [{ text: '🔄 Перевірити статус', callback_data: 'sync_subscription' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }],
      ],
    },
  }),

  subscriptionSupportKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '📧 nadyastarway@gmail.com', callback_data: 'copy_email' }],
        [{ text: '👤 @Nadya2316', url: 'https://t.me/Nadya2316' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }],
      ],
    },
  }),

  subscriptionExpiringKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Продовжити', callback_data: 'subscription_plans' }],
        [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }],
      ],
    },
  }),

  // 🎡 КОЛЕСО БАЛАНСУ
  wheelScoreKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow(
          { text: '0', callback_data: 'wheel_score_0' },
          { text: '1', callback_data: 'wheel_score_1' },
          { text: '2', callback_data: 'wheel_score_2' },
          { text: '3', callback_data: 'wheel_score_3' },
          { text: '4', callback_data: 'wheel_score_4' },
          { text: '5', callback_data: 'wheel_score_5' },
        ),
        kbRow(
          { text: '6', callback_data: 'wheel_score_6' },
          { text: '7', callback_data: 'wheel_score_7' },
          { text: '8', callback_data: 'wheel_score_8' },
          { text: '9', callback_data: 'wheel_score_9' },
          { text: '10', callback_data: 'wheel_score_10' },
        ),
        kbRow({ text: '🚪 Вийти', callback_data: 'wheel_exit' }),
      ],
    },
  }),

  wheelCompletedKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🔄 Пройти колесо ще раз', callback_data: 'wheel_restart_confirmed' }),
        kbRow({ text: '📊 Історія коліс', callback_data: 'wheel_history' }),
        kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }),
      ],
    },
  }),

  wheelActiveKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '✅ Продовжити', callback_data: 'wheel_continue' }),
        kbRow({ text: '🔄 Почати заново', callback_data: 'wheel_restart' }),
        kbRow({ text: '❌ Скасувати', callback_data: 'wheel_exit' }),
      ],
    },
  }),

  wheelNoteKeyboard: (step) => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '⏭️ Пропустити нотатку', callback_data: `wheel_skip_note_${step}` }),
        kbRow({ text: '⬅️ Змінити оцінку', callback_data: 'wheel_go_back' }),
        kbRow({ text: '🚪 Вийти', callback_data: 'wheel_exit' }),
      ],
    },
  }),

  wheelCooldownKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '📊 Переглянути аналіз', callback_data: 'wheel_view_analysis' }),
        kbRow(
          { text: '🔘 Пройти ще', callback_data: 'wheel_restart' },
          { text: '🚫 Вийти', callback_data: 'wheel_exit' }
        ),
      ],
    },
  }),

  // 📊 ЗВІТИ
  weeklyReportMenuKeyboard: () => ({
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '📊 Щомісячний звіт', callback_data: 'show_monthly_report' }),
        kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }),
      ],
    },
  }),

  monthlyReportMenuKeyboard: () => ({
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '📊 Щотижневий звіт', callback_data: 'show_weekly_report' }),
        kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }),
      ],
    },
  }),

  // 📚 КУРСИ
  courseOfferKeyboard: (problemType, offerTitle, price) => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: `📚 Дізнатись більше (${price}€)`, callback_data: `buy_course_${problemType}` }],
        [{ text: '👥 Консультація (150€)', callback_data: 'book_consultation' }],
        [{ text: '❌ Пізніше', callback_data: 'dismiss_offer' }],
      ],
    },
  }),

  courseInfoKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '📧 Написати', callback_data: 'contact_support' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }],
      ],
    },
  }),

  consultationInfoKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '📧 Записатись', callback_data: 'contact_support' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }],
      ],
    },
  }),

  dismissOfferKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Зрозуміло', callback_data: 'main_menu' }],
      ],
    },
  }),

  // ОНБОРДИНГ
  nameChoiceInline: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Використовувати мої дані', callback_data: 'use_telegram_name' }],
        [{ text: '✏️ Ввести своє ім\'я', callback_data: 'enter_custom_name' }],
      ],
    },
  }),

  kbSkipEmail: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '⏭️ Пропустити', callback_data: 'skip_email' }],
        [{ text: '🔙 Назад', callback_data: 'back_to_name' }],
      ],
    },
  }),

  kbSkipPhone: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '⏭️ Пропустити', callback_data: 'skip_phone' }],
        [{ text: '🔙 Назад', callback_data: 'back_to_email' }],
      ],
    },
  }),

  kbConfirmName: (name) => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: `✅ "${name}"`, callback_data: 'confirm_name' }],
        [{ text: '✏️ Змінити', callback_data: 'enter_custom_name' }],
      ],
    },
  }),
doneMorningKeyboard: () => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '▶️ Продовжити ранок', callback_data: 'continue_morning' }],
      [{ text: '🏠 До меню', callback_data: 'main_menu' }],
    ]
  }
}),
doneEveningKeyboard: () => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '▶️ Продовжити вечір', callback_data: 'continue_evening' }],
      [{ text: '🏠 До меню', callback_data: 'main_menu' }],
    ]
  }
}),
};

// ── УНІВЕРСАЛЬНІ ГЕНЕРАТОРИ ──
keyboards.menuKeyboard = (options, withNavigation = true) => {
  const rows = options.map((opt) => kbRow({ text: opt.text, callback_data: opt.callback_data }));
  if (withNavigation) rows.push(kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }));
  return { reply_markup: { inline_keyboard: rows } };
};

keyboards.navigationKeyboard = (backTo = null, withMainMenu = true) => {
  const rows = [];
  if (backTo) rows.push(kbRow({ text: '🔙 Назад', callback_data: backTo }));
  if (withMainMenu) rows.push(kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }));
  return { reply_markup: { inline_keyboard: rows } };
};

keyboards.actionKeyboard = (entity, actions = ['start', 'exit']) => {
  const icons = { start: '▶️', continue: '🔁', exit: '🚪', later: '⏭' };
  const labels = { start: 'Почати', continue: 'Продовжити', exit: 'Вийти', later: 'Пізніше' };
  const rows = actions.map((a) =>
    kbRow({ text: `${icons[a]} ${labels[a]}`, callback_data: `${a}_${entity}` })
  );
  return { reply_markup: { inline_keyboard: rows } };
};

keyboards.skipKeyboard = (field, withBack = false) => {
  const rows = [kbRow({ text: `⏭️ Пропустити`, callback_data: `skip_${field}` })];
  if (withBack) rows.push(kbRow({ text: '🔙 Назад', callback_data: `back_${field}` }));
  return { reply_markup: { inline_keyboard: rows } };
};

export default keyboards;

console.log('✅ [utils/keyboards] Keyboards завантажено');