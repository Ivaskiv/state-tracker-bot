import dotenv from 'dotenv';
dotenv.config();

if (!process.env.TELEGRAM_TOKEN || !process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

export const config = {
  botToken: process.env.TELEGRAM_TOKEN,
  airtableApiKey: process.env.AIRTABLE_API_KEY,
  airtableBaseId: process.env.AIRTABLE_BASE_ID,
  
  admins: [123456789], // Add admin Telegram IDs
  
  pricing: {
    week: { price: 7, duration: 7, text: "🔹 Тиждень фокусу — 7€" },
    month: { price: 30, duration: 30, text: "🔹 Місяць дії — 30€" },
    year: { price: 300, duration: 365, text: "🔹 Рік трансформації — 300€" }
  },

  schedules: {
    morning: '0 8 * * *',
    evening: '0 20 * * *'
  },

  messages: {
    welcome: `🌱 Вітаю у твоєму особистому AI-коучі!

Я допоможу тебе щодня фокусуватися, відслідковувати прогрес та трансформуватися через структуровану рефлексію.

💰 Тарифи:
🔹 Тиждень фокусу — 7€
🔹 Місяць дії — 30€  
🔹 Рік трансформації — 300€

Готова почати трансформацію?`,

    morningIntro: "🌞 РАНОК (о 08:00)\nЦіль: фокус, активація бачення, підйом самоцінності, вибір стану.",
    eveningIntro: "🌙 ВЕЧІР (о 20:30)\nЦіль: самоаналіз, завершення дня, усвідомлення програм, фіксація перемог.",
    
    subscriptionExpired: "Ваша підписка закінчилася. Оберіть новий тариф:",
    paymentSuccess: "✅ Оплату отримано! Твоя підписка активна.",
    
    weeklyReportIntro: "📊 ЩОТИЖНЕВИЙ АНАЛІЗ\nОсь твій AI-звіт за останній тиждень:",
    monthlyReportIntro: "📅 ЩОМІСЯЧНИЙ АНАЛІЗ\nОсь твій AI-звіт за місяць:",
    
    motivationMorning: "Моє бачення — мій вибір. Моя сила — в мені. Я вже йду своїм шляхом.",
    motivationEvening: "Я вдячна цьому дню. Я стала сильнішою. Я обираю рухатися далі — до себе справжньої."
  },

  morningQuestions: [
    {
      key: 'who_am_i_today',
      question: '1. Хто я сьогодні?\nОпиши себе як нову версію — з позиції сили.\n(Наприклад: я топ експерт, я власниця відомого бренду...)',
      placeholder: 'Я — '
    },
    {
      key: 'what_am_i_like', 
      question: '2. Яка я?\n(Наприклад: сильна, смілива, любляча, щира, рішуча...)',
      placeholder: 'Я — '
    },
    {
      key: 'goals_list',
      question: '3. Мої 10 цілей на рік\nПропиши щодня наново — ніби вони вже реальність.\n1. Я маю...\n2. Я живу...\n3. Я отримую...\n... до 10',
      placeholder: 'Мої цілі:'
    },
    {
      key: 'focus_goal',
      question: '4. На яку одну ціль я фокусуюсь сьогодні?\nТе, що хочеш просунути зараз.',
      placeholder: 'Я фокусуюсь на: '
    },
    {
      key: 'current_state',
      question: '5. Який мій стан сьогодні?\nОпиши свій стан прямо зараз.',
      placeholder: 'Я відчуваю: '
    },
    {
      key: 'why_i_deserve',
      question: '6. Чому я гідна мати все це прямо зараз?\n(Наприклад: бо я вже достатня / цінна / варта.)',
      placeholder: 'Я — '
    }
  ],

  eveningQuestions: [
    {
      key: 'energy_sources',
      question: '1. Що мене сьогодні наповнило енергією?\nЛюди, дії, ситуації, стани.',
      placeholder: 'Мене сьогодні наповнило енергією: '
    },
    {
      key: 'energy_drains', 
      question: '2. Де я сьогодні злила енергію чи втратила стан?\nТригер, сумнів, ситуація, реакція.',
      placeholder: 'Я сьогодні злила енергію в: '
    },
    {
      key: 'triggered_program',
      question: '3. Яка програма або переконання активувалась сьогодні?\n(Наприклад: страх, "мені не вийде", "я не заслуговую"...)',
      placeholder: 'У мене сьогодні активувалась програма: '
    },
    {
      key: 'action_source',
      question: '4. З якої точки я діяла сьогодні: сили чи страху?\nЧесна відповідь. Що керувало тобою?',
      placeholder: 'Мною сьогодні керувала/керував: '
    },
    {
      key: 'daily_victory',
      question: '5. Яка моя головна перемога сьогодні?\nДія, стан, рішення — будь-який успіх.',
      placeholder: 'Сьогодні я: '
    }
  ],

  keyboard: {
    subscription: [
      { text: '🔹 Тиждень фокусу — 7€', callback_data: 'sub_week' },
      { text: '🔹 Місяць дії — 30€', callback_data: 'sub_month' },
      { text: '🔹 Рік трансформації — 300€', callback_data: 'sub_year' }
    ],
    
    quickSupport: [
      { text: '💪 Мотивація', callback_data: 'support_motivation' },
      { text: '🧘 Заспокоєння', callback_data: 'support_calm' },
      { text: '🎯 Фокус', callback_data: 'support_focus' }
    ]
  }
};