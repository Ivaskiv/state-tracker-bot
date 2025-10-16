//src/config/constantsSubscription.js
export const SUBSCRIPTION_PLANS = Object.freeze({
  TRIAL:  { key: 'TRIAL',  userName: '🧪 Пробний період — 0€', price: 0,   duration: 7,   description: 'Повний доступ на 7 днів' },
  WEEK:   { key: 'WEEK',   userName: 'Тиждень фокусу — 7€',     price: 7,   duration: 7,   description: 'Ідеально для короткого фокусу або тесту системи' },
  MONTH:  { key: 'MONTH',  userName: 'Місяць дії — 30€',        price: 30,  duration: 30,  description: 'Глибинна робота з твоїми цілями та стратегією' },
  YEAR:   { key: 'YEAR',   userName: 'Рік трансформації — 300€',price: 300, duration: 365, description: 'Максимальна економія та підтримка протягом року' }
});

export const SUBSCRIPTION_STATUS = Object.freeze({
  NEW: 'New', ACTIVE: 'Active', PAUSED: 'Paused', EXPIRED: 'Expired',
  PAID: 'Paid', PENDING: 'Pending', EMPTY: 'Empty', DECLINED: 'Declined', APPROVED: 'Approved'
});

export const SUBSCRIPTION_MESSAGES = Object.freeze({
  INFO_ACTIVE: (plan, start, end) => `✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}`,
  INFO_EXPIRING: (daysLeft) => `\n\n⚠️ Підписка закінчується через ${daysLeft} дн${daysLeft === 1 ? 'ь' : (daysLeft >= 2 && daysLeft <= 4 ? 'і' : 'ів')}!`,
  INFO_INACTIVE:
    '❌ Неактивна\n\n💰 ДОСТУПНІ ПЛАНИ:\n' +
    '🔹 Тиждень фокусу — 7€\n' +
    '🔹 Місяць дії — 30€\n' +
    '🔹 Рік трансформації — 300€\n\n' +
    '💳 Оплата через WayForPay. Натисни, щоб обрати план:',
  PLANS_LIST:
    '💰 ОБЕРИ ПЛАН ПІДПИСКИ:\н\n' +
    '🔹 Тиждень фокусу — 7€\nІдеально для короткого фокусу або тесту системи\n\n' +
    '🔹 Місяць дії — 30€\nГлибинна робота з твоїми цілями та стратегією\n\n' +
    '🔹 Рік трансформації — 300€\nМаксимальна економія та підтримка протягом року\n\n' +
    '✅ Безпечна оплата через WayForPay',
  PAYMENT: (planName, price, duration, link) =>
    `💳 ОПЛАТА ПІДПИСКИ\n\n📋 План: ${planName}\n💰 Вартість: ${price}€\n⏰ Тривалість: ${duration} днів\n\n🔗 Посилання для оплати:\n${link}\n\n💡 Після оплати натисни «🔄 Я вже оплатив».`,
  RENEWAL: (planName, price, duration, link) =>
    `🔄 ПРОДОВЖЕННЯ ПІДПИСКИ\n\n📋 План: ${planName}\n💰 Вартість: ${price}€\n⏰ Тривалість: ${duration} днів\n\n✅ Після оплати натисни «🔄 Перевірити оплату»\n\n🔗 ${link}`,
  SUPPORT: (tgId) =>
    `📞 ЗВʼЯЗОК З ПІДТРИМКОЮ\n\n• Email: nadyastarway@gmail.com\n• Telegram: @Nadya2316 (ментор)\n• Telegram: @vira_333 (техпідтримка)\n\nВкажи свій Telegram ID: ${tgId}`,
  EXPIRATION_REMINDER: (planName, endDate) =>
    `⚠️ Підписка закінчується завтра!\n\n📋 План: ${planName}\n📅 Діє до: ${endDate}\n\n💰 Продовж зараз, щоб не втратити доступ!`
});
export const WAYFORPAY_LINKS = Object.freeze({
  WEEK:  'https://secure.wayforpay.com/button/b96923b913d29',
  MONTH: 'https://secure.wayforpay.com/button/b8df87678cd43',
  YEAR:  'https://secure.wayforpay.com/button/bf28701123683'
});