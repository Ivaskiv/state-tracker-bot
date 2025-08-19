// utils/keyboards.js
import { Markup } from 'telegraf';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

/** ================== Основне меню ================== */
const mainMenuKeyboard = () =>
  Markup.keyboard([
    ['📝 Ранкові питання', '🌙 Вечірні питання'],
    ['💰 Підписка', '📊 Мій прогрес'],
    ['💎 Афірмація', '❓ Допомога']
  ]).resize();

/** ================== Клавіатура підписок ================== */
const subscriptionKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🔹 Тиждень фокусу — 7€', 'subscribe_week')],
    [Markup.button.callback('🔹 Місяць дії — 30€', 'subscribe_month')],
    [Markup.button.callback('🔹 Рік трансформації — 300€', 'subscribe_year')],
    [Markup.button.callback('« Назад', 'back_to_main')]
  ]);

/** ================== Підтвердження підписки ================== */
const confirmSubscriptionKeyboard = (plan) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✅ Підтвердити оплату', `confirm_${plan}`)],
    [Markup.button.callback('« Назад до планів', 'back_to_subscription')]
  ]);

/** ================== Реєстрація ================== */
const registrationKeyboard = () =>
  Markup.keyboard([
    ['📝 Продовжити реєстрацію'],
    ['❓ Допомога']
  ]).resize();

/** ================== Пропуск питання ================== */
const skipKeyboard = () =>
  Markup.keyboard([
    ['⏭️ Пропустити'],
    ['❓ Допомога']
  ]).resize();

/** ================== Прогрес користувача ================== */
const progressKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('📊 Щотижневий звіт', 'weekly_report')],
    [Markup.button.callback('📈 Щомісячний звіт', 'monthly_report')],
    [Markup.button.callback('« Назад', 'back_to_main')]
  ]);

/** ================== Допомога ================== */
const helpKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Скинути прогрес', 'reset_progress')],
    [Markup.button.callback('💌 Зв\'язатися з підтримкою', 'contact_support')],
    [Markup.button.callback('« Назад', 'back_to_main')]
  ]);

/** ================== Продовження ================== */
const continueKeyboard = () =>
  Markup.keyboard([
    ['▶️ Продовжити'],
    ['🏠 Головне меню']
  ]).resize();

/** ================== Так/Ні ================== */
const yesNoKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✅ Так', 'yes')],
    [Markup.button.callback('❌ Ні', 'no')]
  ]);

/** ================== Видалити клавіатуру ================== */
const removeKeyboard = () => Markup.removeKeyboard();

/** ================== Експорт об’єкта KEYBOARDS ================== */
export const KEYBOARDS = {
  MAIN_MENU: mainMenuKeyboard(),
  BACK_TO_MENU: mainMenuKeyboard(),
  SUPPORT_MENU: subscriptionKeyboard(),
  CONFIRM_SUBSCRIPTION: confirmSubscriptionKeyboard,
  REGISTRATION: registrationKeyboard(),
  SKIP: skipKeyboard(),
  PROGRESS: progressKeyboard(),
  HELP: helpKeyboard(),
  CONTINUE: continueKeyboard(),
  YES_NO: yesNoKeyboard(),
  REMOVE: removeKeyboard()
};
