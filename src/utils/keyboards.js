// src/utils/keyboards.js
import { TIMEZONES, SUBSCRIPTION_PLANS } from '../config/constants.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 УСІ КЛАВІАТУРИ (загальні, онбординг, меню, підписки, сесії)
// ═══════════════════════════════════════════════════════════════════════════════

const keyboards = {
  // ===== 🏠 ГОЛОВНЕ МЕНЮ =====
  mainMenuKeyboard: () => ({
    reply_markup: {
      keyboard: [
        [{ text: '📊 Мій прогрес та Звіти' }, { text: 'ℹ️ Інформація про бота' }],
        [{ text: '💰 Підписка' }, { text: '📞 Звʼязок' }],
        [{ text: '🤖 AI Наставник' }, { text: '🎯 Колесо балансу' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      is_persistent: true
    }
  }),

  // ===== ℹ️ ІНФО =====
  infoMenuInline: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Можливості', callback_data: 'show_capabilities' }],
        [{ text: '📝 Інструкції', callback_data: 'instructions' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  }),

  // ===== 📞 КОНТАКТИ =====
  contactMenuInline: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
        [{ text: '💎 Афірмація', callback_data: 'show_affirmation' }],
        [{ text: '❓ Допомога', callback_data: 'help' }],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }]
      ]
    }
  }),

  // ===== 💰 ПІДПИСКА =====
  subscriptionMenuInline: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Статус підписки', callback_data: 'subscription_status' }],
        [{ text: '💳 Оформити/Продовжити', callback_data: 'subscription_plans' }],
        [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }],
        [{ text: '🔙 Назад', callback_data: 'main_menu' }]
      ]
    }
  }),

  // ===== 🎉 ПІСЛЯ РЕЄСТРАЦІЇ =====
  afterRegistrationKeyboard: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎯 Почати колесо балансу зараз', callback_data: 'wheel_start' }],
              [{ text: '⏭️ Пізніше', callback_data: 'skip_first_wheel' }],
        [{ text: '📋 Що можу робити?', callback_data: 'show_capabilities' }]
      ]
    }
  }),

  // ===== 🌍 ТАЙМЗОНИ =====
timezoneKeyboard: () => {
    const buttons = TIMEZONES.map(tz => [
      { text: tz.label, callback_data: `tz_${tz.slug}` }
    ]);
    
    // Кнопка "Назад"
    buttons.push([{ text: '🔙 Назад', callback_data: 'back_to_phone' }]);
    
    return { reply_markup: { inline_keyboard: buttons } };
  },
  // ===== 🌞 / 🌙 РЕФЛЕКСІЇ =====
  morningStartInline: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌞 Почати ранкову рефлексію', callback_data: 'start_morning' }],
        [{ text: '⏭ Пізніше', callback_data: 'later_morning' }]
      ]
    }
  }),

  eveningStartInline: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌙 Почати вечірню рефлексію', callback_data: 'start_evening' }],
        [{ text: '⏭ Пізніше', callback_data: 'later_evening' }]
      ]
    }
  }),

  // ===== 🧾 ВИБІР ІМЕНІ =====
  nameChoiceInline: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Використати імʼя з Telegram', callback_data: 'use_telegram_name' }],
        [{ text: '✏️ Ввести інше', callback_data: 'enter_custom_name' }]
      ]
    }
  }),

  kbConfirmName: (n) => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: `✅ Залишити «${n}»`, callback_data: 'confirm_name' }],
        [{ text: '✏️ Ввести інше імʼя', callback_data: 'change_name' }]
      ]
    }
  }),

kbSkipEmail: () => ({
    reply_markup: { 
      inline_keyboard: [
        [{ text: '⏭ Пропустити e-mail', callback_data: 'skip_email' }],
        [{ text: '🔙 Назад', callback_data: 'back_to_name' }]
      ] 
    }
  }),

  kbSkipPhone: () => ({
    reply_markup: { 
      inline_keyboard: [
        [{ text: '⏭ Пропустити телефон', callback_data: 'skip_phone' }],
        [{ text: '🔙 Назад', callback_data: 'back_to_email' }]
      ] 
    }
  }),
  // ===== 🧪 ПЛАНИ =====
  subscriptionPlansKeyboard: () => ({
    reply_markup: {
inline_keyboard: [
[{ text: '🧪 Пробний період — 7 днів (0€)', callback_data: 'activate_trial' }],
        [{ text: '📅 Тиждень фокусу — 7€', callback_data: 'subscribe_week' }],
        [{ text: '🎯 Місяць дії — 30€', callback_data: 'subscribe_month' }],
        [{ text: '⭐ Рік трансформації — 300€', callback_data: 'subscribe_year' }],
        [{ text: '⏭️ Завершити без підписки', callback_data: 'skip_subscription' }],
        [{ text: '🔙 Назад', callback_data: 'back_to_timezone' }]
            ]    }
  })
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 УНІВЕРСАЛЬНІ ГЕНЕРАТОРИ (для реюзу у flow)
// ═══════════════════════════════════════════════════════════════════════════════

export const skipKeyboard = (field, withBack = false) => {
  const buttons = [[{ text: `⏭️ Пропустити ${field}`, callback_data: `skip_${field}` }]];
  if (withBack) buttons.push([{ text: '🔙 Назад', callback_data: `back_${field}` }]);
  return { reply_markup: { inline_keyboard: buttons } };
};

export const actionKeyboard = (entity, actions = ['start', 'exit']) => {
  const icons = { start: '▶️', continue: '🔁', exit: '🚪', later: '⏭' };
  const labels = { start: 'Почати', continue: 'Продовжити', exit: 'Вийти', later: 'Пізніше' };
  const buttons = actions.map(a => [{ text: `${icons[a]} ${labels[a]}`, callback_data: `${a}_${entity}` }]);
  return { reply_markup: { inline_keyboard: buttons } };
};

export const navigationKeyboard = (backTo = null, withMainMenu = true) => {
  const buttons = [];
  if (backTo) buttons.push([{ text: '🔙 Назад', callback_data: backTo }]);
  if (withMainMenu) buttons.push([{ text: '🏠 До меню', callback_data: 'main_menu' }]);
  return { reply_markup: { inline_keyboard: buttons } };
};

export const menuKeyboard = (options, withNavigation = true) => {
  const buttons = options.map(opt => [{ text: opt.text, callback_data: opt.callback_data }]);
  if (withNavigation) buttons.push([{ text: '🏠 До меню', callback_data: 'main_menu' }]);
  return { reply_markup: { inline_keyboard: buttons } };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ ЕКСПОРТ
// ═══════════════════════════════════════════════════════════════════════════════
export default keyboards;
