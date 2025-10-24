export const LIFE_SPHERES = [
  { key: 'Health',          label: "Здоров'я та енергія",     description: 'Сон, харчування, фізична активність, відновлення', noteField: 'Health_Notes' },
  { key: 'Self_Growth',     label: 'Особистісний розвиток',   description: 'Навчання, навички, ментальні моделі, внутрішній стан', noteField: 'Self_Growth_Notes' },
  { key: 'Relationships',   label: "Стосунки (сімʼя, друзі)", description: 'Якість комунікації, підтримка, близькість', noteField: 'Relationships_Notes' },
  { key: 'Career_Business', label: "Карʼєра та професія",     description: 'Сенс, результат, зростання, вплив', noteField: 'Career_Notes' },
  { key: 'Finance',         label: 'Фінанси та достаток',     description: 'Дохід, заощадження, інвестиції, фінплан', noteField: 'Finance_Notes' },
  { key: 'Rest_Leisure',    label: 'Дозвілля та відпочинок',  description: 'Хобі, подорожі, відновлення через радість', noteField: 'Leisure_Notes' },
  { key: 'Spirituality',    label: 'Духовність та цінності',  description: 'Сенс, практика усвідомленості, етика', noteField: 'Spirituality_Notes' },
  { key: 'Housing',         label: 'Побут та оточення',       description: 'Дім, порядок, робочий простір, середовище', noteField: 'Housing_Notes' }
];

export const SPHERE_FIELDS = LIFE_SPHERES.map(s => s.key);
export const NOTE_FIELDS   = LIFE_SPHERES.map(s => s.noteField);
export const getSphereMeta = (i) => LIFE_SPHERES[i] || null;

export const WHEEL_MESSAGES = Object.freeze({
  RECENTLY_COMPLETED: (dateStr, daysLeft) =>
    `⏰ Ти нещодавно завершив Колесо (${dateStr}).\n` +
    `Наступне доступне через ${daysLeft} дн${daysLeft === 1 ? 'ь' : (daysLeft <= 4 ? 'і' : 'ів')}.`
});

// ✅ ОСНОВНІ ПИТАННЯ (ключ має бути "wheel", не "wheel_deep")
export const WHEEL_QUESTIONS = Object.freeze({
  wheel: [
    {
      emoji: '❤️',
      sphere: 'Health',
      title: '💪 Енергія тепер?',
      question: `0 = енергія відсутня, 10 = енергія максимальна

Подумай:
• Якість сну ночами?
• Гідрація та харчування достатні?
• Рух у режимі дня?
• Сила та бадьорість присутні?`,
      hint: '💡 Енергія — фундамент усього',
      field: 'Health'
    },
    {
      emoji: '📚',
      sphere: 'Self_Growth',
      title: '🌱 Зростання як особистість?',
      question: `0 = застій, 10 = постійне вдосконалення

Подумай:
• Нові знання та навички набуваються?
• Змінюється спосіб мислення?
• Прогрес видимий?
• Краща версія себе створюється?`,
      hint: '💡 Розвиток — щоденний вибір',
      field: 'Self_Growth'
    },
    {
      emoji: '👥',
      sphere: 'Relationships',
      title: '💝 Зв\'язки живі?',
      question: `0 = ізоляція, 10 = взаємність та близькість

Подумай:
• Контакт з близькими людьми підтримується?
• Якість розмов та спілкування висока?
• Взаєморозуміння присутнє?
• Взаємна підтримка існує?`,
      hint: '💡 Люди — найбільший скарб',
      field: 'Relationships'
    },
    {
      emoji: '💼',
      sphere: 'Career_Business',
      title: '🎯 Робота — призвання?',
      question: `0 = демотивація, 10 = професійне задоволення

Подумай:
• Сенс у повсякденній роботі присутній?
• Відчуття впливу та корисності існує?
• Карʼєра розвивається?
• Результати визнані?`,
      hint: '💡 Робота займає третину життя',
      field: 'Career_Business'
    },
    {
      emoji: '💰',
      sphere: 'Finance',
      title: '💵 Гроші служать?',
      question: `0 = фінансовий тиск, 10 = фінансова свобода

Подумай:
• Доходи стабільні та зростають?
• Витрати під контролем?
• Резервний запас сформований?
• Фінансові цілі ясні?`,
      hint: '💡 Гроші — інструмент вибору',
      field: 'Finance'
    },
    {
      emoji: '🎨',
      sphere: 'Rest_Leisure',
      title: '🎉 Радість присутна?',
      question: `0 = тільки обов\'язки, 10 = радість присутня

Подумай:
• Час на улюблене виділяється?
• Хобі та розслаблення можливі?
• Сміх у рутині присутній?
• Активності заряджають енергією?`,
      hint: '💡 Радість — палива для душі',
      field: 'Rest_Leisure'
    },
    {
      emoji: '🧘',
      sphere: 'Spirituality',
      title: '✨ Сенс є?',
      question: `0 = пустота сенсу, 10 = сенс керує дійсність

Подумай:
• Цінності ясні та визначені?
• Дії збігаються з принципами?
• Сенс у кожному дні?
• Практики розвиваються?`,
      hint: '💡 Сенс надає вагу усьому',
      field: 'Spirituality'
    },
    {
      emoji: '🏠',
      sphere: 'Housing',
      title: '🛋️ Простір впорядкований?',
      question: `0 = хаос, 10 = гармонія та порядок

Подумай:
• Дім як безпечне місце сприймається?
• Оточення натхненням чи тягарем?
• Порядок у речах та думках?
• Простір для розвитку надається?`,
      hint: '💡 Простір — дзеркало внутрішнього',
      field: 'Housing'
    }
  ]
});

// 🚀 ШВИДКА ВЕРСІЯ
export const WHEEL_QUESTIONS_QUICK = Object.freeze({
  wheel_quick: [
    { emoji: '❤️', title: '❤️ Енергія?', hint: '0-10' },
    { emoji: '📚', title: '📚 Ріст?', hint: '0-10' },
    { emoji: '👥', title: '👥 Стосунки?', hint: '0-10' },
    { emoji: '💼', title: '💼 Робота?', hint: '0-10' },
    { emoji: '💰', title: '💰 Гроші?', hint: '0-10' },
    { emoji: '🎨', title: '🎨 Радість?', hint: '0-10' },
    { emoji: '🧘', title: '🧘 Сенс?', hint: '0-10' },
    { emoji: '🏠', title: '🏠 Простір?', hint: '0-10' }
  ]
});

export default {
  WHEEL_QUESTIONS,
  WHEEL_QUESTIONS_QUICK
};

console.log('✅ [constants] Питання завантажені');