// src/config/config.js
import dotenv from 'dotenv';
dotenv.config();

// Перевірка обов'язкових змінних середовища
const requiredEnvVars = [
  'TELEGRAM_TOKEN',
  'AIRTABLE_API_KEY', 
  'AIRTABLE_BASE_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

export const config = {
  // ===== API KEYS =====
  botToken: process.env.TELEGRAM_TOKEN,
  airtableApiKey: process.env.AIRTABLE_API_KEY,
  airtableBaseId: process.env.AIRTABLE_BASE_ID,
  wayforpayMerchant: process.env.WAYFORPAY_MERCHANT,
  wayforpaySecret: process.env.WAYFORPAY_SECRET,
  
  // ===== ADMIN IDS =====
  admins: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [],
  
  // ===== PRICING =====
  pricing: {
    week: { 
      price: 7, 
      duration: 7, 
      text: "🔹 Тиждень фокусу — 7€",
      description: "Тижневий план для знайомства з системою"
    },
    month: { 
      price: 30, 
      duration: 30, 
      text: "🔹 Місяць дії — 30€",
      description: "Місячний план для формування звичок"
    },
    year: { 
      price: 300, 
      duration: 365, 
      text: "🔹 Рік трансформації — 300€",
      description: "Річний план для повної трансформації"
    }
  },

  // ===== CRON SCHEDULES =====
  schedules: {
    morning: '0 8 * * *',      // 08:00 щодня
    evening: '30 20 * * *',    // 20:30 щодня
    weeklyReport: '0 21 * * 0', // неділя 21:00
    monthlyReport: '0 21 28-31 * *' // останні дні місяця 21:00
  },

  // ===== MESSAGES =====
  messages: {
    welcome: `🌱 Вітаю у твоєму особистому AI-коучі!

Я допоможу тобі щодня фокусуватися, відслідковувати прогрес та трансформуватися через структуровану рефлексію.

💰 Тарифи:
🔹 Тиждень фокусу — 7€
🔹 Місяць дії — 30€  
🔹 Рік трансформації — 300€

Готова почати трансформацію?`,

    morningIntro: `🌞 РАНКОВА СЕСІЯ

Ціль: фокус, активація бачення, підйом самоцінності, вибір стану.

Готова розпочати день з силою?`,

    eveningIntro: `🌙 ВЕЧІРНЯ СЕСІЯ

Ціль: самоаналіз, завершення дня, усвідомлення програм, фіксація перемог.

Готова підвести підсумки дня?`,
    
    subscriptionExpired: `❌ Твоя підписка неактивна.

Обери план для продовження трансформації:`,

    paymentSuccess: "✅ Оплату отримано! Твоя підписка активна. Вітаємо у спільноті трансформації! 🎉",
    
    weeklyReportIntro: "📊 ЩОТИЖНЕВИЙ AI-АНАЛІЗ\n\nОсь твій персональний звіт за останній тиждень:",
    monthlyReportIntro: "📅 ЩОМІСЯЧНИЙ AI-АНАЛІЗ\n\nОсь твій персональний звіт за місяць:",
    
    motivationMorning: "💫 Моє бачення — мій вибір. Моя сила — в мені. Я вже йду своїм шляхом.",
    motivationEvening: "🙏 Я вдячна цьому дню. Я стала сильнішою. Я обираю рухатися далі — до себе справжньої.",

    morningReminder: `☀️ Доброго ранку!

Час для ранкової сесії фокусу. Використай команду /morning щоб активувати свою внутрішню силу на цілий день.

💪 Ти готова?`,

    eveningReminder: `🌙 Добрий вечір!

Час для вечірньої рефлексії. Використай команду /evening щоб підвести підсумки дня та зафіксувати свої перемоги.

✨ Твій день був важливим!`
  },

  // ===== MORNING QUESTIONS =====
  morningQuestions: [
    {
      key: 'who_am_i_today',
      question: '1️⃣ Хто я сьогодні?\n\nОпиши себе як нову версію — з позиції сили.\n\n(Наприклад: "Я топ експерт", "Я власниця відомого бренду"...)',
      placeholder: 'Я — '
    },
    {
      key: 'what_am_i_like', 
      question: '2️⃣ Яка я?\n\n(Наприклад: сильна, смілива, любляча, щира, рішуча...)',
      placeholder: 'Я — '
    },
    {
      key: 'goals_list',
      question: '3️⃣ Мої 10 цілей на рік\n\nПропиши щодня наново — ніби вони вже реальність.\n\n1. Я маю...\n2. Я живу...\n3. Я отримую...\n... до 10',
      placeholder: 'Мої цілі:'
    },
    {
      key: 'focus_goal',
      question: '4️⃣ На яку одну ціль я фокусуюсь сьогодні?\n\nТе, що хочеш просунути зараз.',
      placeholder: 'Я фокусуюсь на: '
    },
    {
      key: 'current_state',
      question: '5️⃣ Який мій стан сьогодні?\n\nОпиши свій стан прямо зараз.',
      placeholder: 'Я відчуваю: '
    },
    {
      key: 'why_i_deserve',
      question: '6️⃣ Чому я гідна мати все це прямо зараз?\n\n(Наприклад: бо я вже достатня / цінна / варта.)',
      placeholder: 'Я — '
    }
  ],

  // ===== EVENING QUESTIONS =====
  eveningQuestions: [
    {
      key: 'energy_sources',
      question: '1️⃣ Що мене сьогодні наповнило енергією?\n\nЛюди, дії, ситуації, стани.',
      placeholder: 'Мене сьогодні наповнило енергією: '
    },
    {
      key: 'energy_drains', 
      question: '2️⃣ Де я сьогодні злила енергію чи втратила стан?\n\nТригер, сумнів, ситуація, реакція.',
      placeholder: 'Я сьогодні злила енергію в: '
    },
    {
      key: 'triggered_program',
      question: '3️⃣ Яка програма або переконання активувалась сьогодні?\n\n(Наприклад: страх, "мені не вийде", "я не заслуговую"...)',
      placeholder: 'У мене сьогодні активувалась програма: '
    },
    {
      key: 'action_source',
      question: '4️⃣ З якої точки я діяла сьогодні: сили чи страху?\n\nЧесна відповідь. Що керувало тобою?',
      placeholder: 'Мною сьогодні керувала/керував: '
    },
    {
      key: 'daily_victory',
      question: '5️⃣ Яка моя головна перемога сьогодні?\n\nДія, стан, рішення — будь-який успіх.',
      placeholder: 'Сьогодні я: '
    }
  ],

  // ===== KEYBOARDS =====
  keyboard: {
    subscription: [
      [{ text: '🔹 Тиждень фокусу — 7€', callback_data: 'sub_week' }],
      [{ text: '🔹 Місяць дії — 30€', callback_data: 'sub_month' }],
      [{ text: '🔹 Рік трансформації — 300€', callback_data: 'sub_year' }]
    ],
    
    quickSupport: [
      [{ text: '💪 Мотивація', callback_data: 'support_motivation' }],
      [{ text: '🧘 Заспокоєння', callback_data: 'support_calm' }],
      [{ text: '🎯 Фокус', callback_data: 'support_focus' }]
    ],

    confirm: [
      [{ text: '✅ Підтвердити', callback_data: 'confirm' }],
      [{ text: '❌ Скасувати', callback_data: 'cancel' }]
    ]
  },

  // ===== TABLE NAMES =====
  tables: {
    users: 'Users',
    subscriptions: 'Subscriptions', 
    userReflections: 'User Reflections',
    morningResponses: 'Morning_Responses',
    eveningResponses: 'Evening_Responses',
    affirmations: 'Affirmations'
  }
};