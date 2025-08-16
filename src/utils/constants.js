// utils/constants.js

export const SUBSCRIPTION_PLANS = {
  week: {
    name: 'Тиждень фокусу',
    type: 'week',
    price: 7,
    duration: 7
  },
  month: {
    name: 'Місяць дії',
    type: 'month', 
    price: 30,
    duration: 30
  },
  year: {
    name: 'Рік трансформації',
    type: 'year',
    price: 300,
    duration: 365
  }
};

export const REGISTRATION_STATES = {
  AWAITING_NAME: 'awaiting_name',
  AWAITING_PHONE: 'awaiting_phone',
  AWAITING_EMAIL: 'awaiting_email',
  SELECTING_PLAN: 'selecting_plan',
  CONFIRMING_REGISTRATION: 'confirming_registration'
};

export const MORNING_QUESTIONS = [
  {
    key: 'question1',
    text: '**1. Хто я сьогодні?**\n\nОпиши себе як нову версію — з позиції сили.',
    example: '💡 *Наприклад: я топ експерт, я власниця відомого бренду, я мільйонерка...*'
  },
  {
    key: 'question2', 
    text: '**2. Яка я?**\n\nДай відповідь на питання про свої якості.',
    example: '💡 *Наприклад: сильна, смілива, любляча, щира, рішуча...*'
  },
  {
    key: 'question3',
    text: '**3. Мої 10 цілей на рік**\n\nПропиши щодня наново — ніби вони вже реальність. Не дивись, що писала вчора.',
    example: '💡 *Наприклад:\n1. Я маю успішний бізнес\n2. Я живу в розкішній квартирі\n3. Я отримую 10000$ на місяць...*'
  },
  {
    key: 'question4',
    text: '**4. На яку одну ціль я фокусуюсь сьогодні?**\n\nТе, що хочеш просунути зараз.',
    example: '💡 *Наприклад: розвиток бізнесу, здоров\'я, стосунки...*'
  },
  {
    key: 'question5',
    text: '**5. Який мій стан сьогодні?**\n\nОпиши свій стан прямо зараз.',
    example: '💡 *Якщо стан не ресурсний — обери новий: впевненість, рішучість, легкість, сила — і налаштуйся на нього.*'
  },
  {
    key: 'question6',
    text: '**6. Чому я гідна мати все це прямо зараз?**\n\nОдна сильна відповідь із позиції самоцінності.',
    example: '💡 *Наприклад: бо я вже достатня / цінна / варта.*'
  }
];

export const EVENING_QUESTIONS = [
  {
    key: 'question1',
    text: '**1. Що мене сьогодні наповнило енергією?**\n\nЛюди, дії, ситуації, стани.',
    example: '💡 *Наприклад: розмова з подругою, прогулянка, успішна презентація...*'
  },
  {
    key: 'question2',
    text: '**2. Де я сьогодні злила енергію чи втратила стан?**\n\nТригер, сумнів, ситуація, реакція.',
    example: '💡 *Наприклад: конфлікт, прокрастинація, негативні новини...*'
  },
  {
    key: 'question3',
    text: '**3. Яка програма або переконання активувалась сьогодні?**',
    example: '💡 *Наприклад: страх, "мені не вийде", "я не заслуговую"...*'
  },
  {
    key: 'question4',
    text: '**4. З якої точки я діяла сьогодні: сили чи страху?**\n\nЧесна відповідь. Що керувало тобою?',
    example: '💡 *Наприклад: сила, впевненість, страх невдачі, тривога...*'
  },
  {
    key: 'question5',
    text: '**5. Яка моя головна перемога сьогодні?**\n\nДія, стан, рішення — будь-який успіх.',
    example: '💡 *Наприклад: зробила важливий дзвінок, подолала страх, прийняла рішення...*'
  }
];

export const BOT_MESSAGES = {
  WELCOME: '🌟 Привіт! Вітаю в AI-Коучі особистого зростання!',
  REGISTRATION_SUCCESS: '🎉 Вітаємо! Реєстрацію завершено!',
  SUBSCRIPTION_EXPIRED: '❌ Ваша підписка закінчилася.',
  ERROR_GENERAL: '❌ Виникла помилка. Спробуйте пізніше.',
  SUPPORT_EMAIL: 'nadyastarway@gmail.com'
};

export const AFFIRMATION_CATEGORIES = [
  'Особистий розвиток',
  'Бізнес-зріст', 
  'Ясність цілей',
  'Впевненість',
  'Інше'
];

export const USER_STATUSES = {
  NEW_USER: 'New User',
  REGISTERED_USER: 'Registered User',
  ACTIVE_USER: 'Active User'
};

export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed'
};