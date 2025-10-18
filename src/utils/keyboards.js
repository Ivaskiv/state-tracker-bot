// src/utils/keyboards.js

import { TIMEZONES } from "../config/index.js";

// ── helpers ───────────────────────────────────────────────────────────────────
const kbRow = (...btns) => btns.map((b) => ({ text: b.text, callback_data: b.callback_data }));
// ── головний набір клавіатур ─────────────────────────────────────────────────
const keyboards = {
  // 🏠 ГОЛОВНЕ МЕНЮ (reply keyboard)
  mainMenuKeyboard: () => ({
    reply_markup: {
      keyboard: [
        [{ text: '📊 Мій прогрес та Звіти' }, { text: 'ℹ️ Інформація про бота' }],
        [{ text: '💰 Підписка' }, { text: '📞 Звʼязок' }],
        [{ text: '🤖 AI Наставник' }, { text: '🎯 Колесо балансу' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      is_persistent: true,
    },
  }),

  // ℹ️ ІНФО
  infoMenuInline: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '📋 Можливості', callback_data: 'show_capabilities' }),
        kbRow({ text: '📝 Інструкції', callback_data: 'instructions' }),
        kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }),
      ],
    },
  }),

  // 📞 КОНТАКТИ
  contactMenuInline: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '📞 Підтримка', callback_data: 'contact_support' }),
        kbRow({ text: '💎 Афірмація', callback_data: 'show_affirmation' }),
        kbRow({ text: '❓ Допомога', callback_data: 'help' }),
        kbRow({ text: '🔙 Назад', callback_data: 'main_menu' }),
      ],
    },
  }),

  // 💰 ПІДПИСКА
  subscriptionMenuInline: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '📋 Статус підписки', callback_data: 'subscription_status' }),
        kbRow({ text: '💳 Оформити/Продовжити', callback_data: 'subscription_plans' }),
        kbRow({ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }),
        kbRow({ text: '🔙 Назад', callback_data: 'main_menu' }),
      ],
    },
  }),

  // 🎉 ПІСЛЯ РЕЄСТРАЦІЇ
  afterRegistrationKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🎯 Почати колесо балансу зараз', callback_data: 'wheel_start' }),
        kbRow({ text: '⏭️ Пізніше', callback_data: 'skip_first_wheel' }),
        kbRow({ text: '📋 Що можу робити?', callback_data: 'show_capabilities' }),
      ],
    },
  }),

  // 🌍 ТАЙМЗОНИ
  timezoneKeyboard: () => {
    const rows = TIMEZONES.map((tz) =>
      kbRow({ text: tz.label, callback_data: `tz_${tz.slug}` })
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

  buildExitKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [kbRow({ text: '🚪 Вийти з сесії', callback_data: 'exit_session' })],
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

  // 🧪 ПЛАНИ
  subscriptionPlansKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🧪 Пробний період — 7 днів (0€)', callback_data: 'activate_trial' }),
        kbRow({ text: '📅 Тиждень фокусу — 7€', callback_data: 'subscribe_week' }),
        kbRow({ text: '🎯 Місяць дії — 30€', callback_data: 'subscribe_month' }),
        kbRow({ text: '⭐ Рік трансформації — 300€', callback_data: 'subscribe_year' }),
        kbRow({ text: '⏭️ Завершити без підписки', callback_data: 'skip_subscription' }),
        kbRow({ text: '🔙 Назад', callback_data: 'back_to_timezone' }),
      ],
    },
  }),
    // ——— dailySessions ———
  buildRestartWarningKeyboard: (type) => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🔄 Почати заново', callback_data: `restart_${type}` }),
        kbRow({ text: '✅ Залишити як є', callback_data: 'dismiss_reminder' }),
        kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }),
      ],
    },
  }),

  buildEveningWithoutMorningKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({ text: '🌞 Пройти ранкові зараз', callback_data: 'start_morning' }),
        kbRow({ text: '⏭️ Пропустити ранкові', callback_data: 'skip_morning_do_evening' }),
        kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }),
      ],
    },
  }),

  buildSessionStartKeyboard: (type) => ({
    reply_markup: {
      inline_keyboard: [
        kbRow({
          text: type === 'morning' ? '🌞 Почати ранкову' : '🌙 Почати вечірню',
          callback_data: `start_${type}`,
        }),
        kbRow({ text: '⏭️ Пізніше', callback_data: `later_${type}` }),
      ],
    },
  }),

};

// ── універсальні генератори ───────────────────────────────────────────────────
export const skipKeyboard = (field, withBack = false) => {
  const rows = [kbRow({ text: `⏭️ Пропустити ${field}`, callback_data: `skip_${field}` })];
  if (withBack) rows.push(kbRow({ text: '🔙 Назад', callback_data: `back_${field}` }));
  return { reply_markup: { inline_keyboard: rows } };
};

export const actionKeyboard = (entity, actions = ['start', 'exit']) => {
  const icons = { start: '▶️', continue: '🔁', exit: '🚪', later: '⏭' };
  const labels = { start: 'Почати', continue: 'Продовжити', exit: 'Вийти', later: 'Пізніше' };
  const rows = actions.map((a) =>
    kbRow({ text: `${icons[a]} ${labels[a]}`, callback_data: `${a}_${entity}` })
  );
  return { reply_markup: { inline_keyboard: rows } };
};

export const navigationKeyboard = (backTo = null, withMainMenu = true) => {
  const rows = [];
  if (backTo) rows.push(kbRow({ text: '🔙 Назад', callback_data: backTo }));
  if (withMainMenu) rows.push(kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }));
  return { reply_markup: { inline_keyboard: rows } };
};

export const menuKeyboard = (options, withNavigation = true) => {
  const rows = options.map((opt) => kbRow({ text: opt.text, callback_data: opt.callback_data }));
  if (withNavigation) rows.push(kbRow({ text: '🏠 До меню', callback_data: 'main_menu' }));
  return { reply_markup: { inline_keyboard: rows } };
};

// ── колесо балансу ────────────────────────────────────────────────────────────
export const wheelScoreKeyboard = () => ({
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
});

export const wheelCompletedKeyboard = () => ({
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      kbRow({ text: '🔄 Пройти колесо ще раз', callback_data: 'wheel_restart_confirmed' }),
      kbRow({ text: '📊 Історія коліс', callback_data: 'wheel_history' }),
      kbRow({ text: '🏠 До головного меню', callback_data: 'main_menu' }),
    ],
  },
});

export const wheelActiveKeyboard = () => ({
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      kbRow({ text: '✅ Продовжити', callback_data: 'wheel_continue' }),
      kbRow({ text: '🔄 Почати заново', callback_data: 'wheel_restart' }),
      kbRow({ text: '❌ Скасувати', callback_data: 'wheel_exit' }),
    ],
  },
});

export const wheelNoteKeyboard = (step) => ({
  reply_markup: {
    inline_keyboard: [
      kbRow({ text: '⏭️ Пропустити нотатку', callback_data: `wheel_skip_note_${step}` }),
      kbRow({ text: '⬅️ Змінити оцінку', callback_data: 'wheel_go_back' }),

      kbRow({ text: '🚪 Вийти', callback_data: 'wheel_exit' }),
    ],
  },
});

export const wheelCooldownKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [
      kbRow(
        { text: '📊 Переглянути аналіз колеса', callback_data: 'wheel_view_analysis' },
        { text: '🔘 Пройти ще раз', callback_data: 'wheel_restart' },
        { text: '🚫 Вийти', callback_data: 'wheel_exit' },
      ),
    ],
  },
});

export default keyboards;
