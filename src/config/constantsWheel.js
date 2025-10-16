//src/config/constantsWheel.js
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