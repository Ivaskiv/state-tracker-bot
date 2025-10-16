//src/config/constantsCourses.js
export const COURSE_OFFERS = Object.freeze({
  low_activity:   { title: "Система 21",          price: 33, description: "Для подолання прокрастинації та відкладання", benefit: "21 день до нової звички дії", duration: 21 },
  fear:           { title: "Страхи",               price: 33, description: "Робота з блоками та внутрішніми страхами",    benefit: "Техніки подолання страхів та тривоги", duration: 30 },
  no_goals:       { title: "Код змін",             price: 33, description: "Стратегія цілепокладання та планування",     benefit: "Система досягнення цілей за 30 днів",  duration: 30 },
  state_mastery:  { title: "Стан — ключ до успіху", price: 10, description: "Управління станом та енергією",              benefit: "Подолання апатії та втоми",            duration: 14 }
});

export const CONSULTATION_OFFER = Object.freeze({
  title: "Персональна консультація з Надею",
  price: 150,
  duration: 60,
  benefits: [
    "Глибинний аналіз блоків",
    "Персональна стратегія подолання",
    "Конкретний план дій",
    "Підтримка 7 днів після сесії"
  ]
});
export const COURSE_MESSAGES = Object.freeze({
  OFFER: (offerTitle, price, description, benefit, triggerMessage) =>
    `💡 ПЕРСОНАЛЬНА РЕКОМЕНДАЦІЯ\n\n${triggerMessage}\n\n` +
    `📚 Міні-курс "${offerTitle}" — ${price}€\n${description}\n✅ ${benefit}\n\n` +
    `або\n\n👥 Консультація — 60 хв, ${CONSULTATION_OFFER.price}€`,
  COURSE_INFO: (title, price, tgId) =>
    `📚 КУРС: ${title}\n\n💰 ${price}€\n\nНапиши: nadyastarway@gmail.com або @Nadya2316\nВкажи Telegram ID: ${tgId}`,
  CONSULTATION_INFO: (tgId) =>
    `👥 КОНСУЛЬТАЦІЯ\n⏱ 60 хв\n💰 ${CONSULTATION_OFFER.price}€\n\n` +
    `${CONSULTATION_OFFER.benefits.map(b => `• ${b}`).join('\n')}\n\nКонтакт: email або @Nadya2316\nID: ${tgId}`,
  DISMISS: '✅ Добре! Якщо передумаєш — я завжди тут. 💪'
});
