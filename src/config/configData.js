export const config = {
  botName: "State Tracker Bot",
  welcomeMessage: "Ласкаво просимо до бота для відстеження твого стану! Тут ми не шукаємо виправдань...",
  errorMessage: "Щось пішло не так. Спробуйте ще раз.",
  startTime: "09:00",
  endTime: "21:00",
  admins: [], // Додайте Telegram ID адмінів
  ai: {
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 500,
  },
  frequencyOptions: {
    Once: "Раз на день о 9:00",
    Twice: "Двічі на день о 9:00 та 18:00",
    ThreeTimes: "Тричі на день о 9:00, 15:00, 18:00",
    FourTimes: "Чотири рази на день о 9:00, 12:00, 15:00, 18:00",
    Hourly: "Щогодини з 9:00 до 21:00",
  },
  themes: {
    emotionTracking: {
      startMessage: "Привіт! Починаємо опитування...",
      state: "Який твій стан зараз?",
      emotion: "Яку емоцію ти відчуваєш найсильніше?",
      feeling: "Яке глибше почуття переважає в тобі зараз?",
      action: "Що ти робив(ла) перед цим?",
      completion: "Дякую! Ти зробив(ла) ще один крок до свідомого стану!",
    },
  },
  pollSettings: {
    states: [
      { key: "resourceful", text: "/Ресурсний" },
      { key: "neutral", text: "/Нейтральний" },
      { key: "tense", text: "/Напружений" },
      { key: "exhausted", text: "/Виснажений" },
      { key: "anxious", text: "/Тривожний" },
      { key: "panic", text: "/Панічний" },
    ],
    emotions: [
      { key: "joy", text: "/Радість" },
      { key: "anger", text: "/Гнів" },
      { key: "calm", text: "/Спокій" },
      { key: "sadness", text: "/Сум" },
      { key: "fear", text: "/Страх" },
      { key: "gratitude", text: "/Вдячність" },
    ],
    feelings: [
      { key: "love", text: "/Любов" },
      { key: "guilt", text: "/Провина" },
      { key: "loneliness", text: "/Самотність" },
      { key: "acceptance", text: "/Прийняття" },
      { key: "shame", text: "/Сором" },
      { key: "hope", text: "/Надія" },
    ],
    actions: [
      { key: "work", text: "/Працював(ла)" },
      { key: "eating", text: "/Їв(ла)" },
      { key: "social_media", text: "/Був(ла)_в_соцмережах" },
      { key: "communication", text: "/Спілкувався(лась)" },
      { key: "exercise", text: "/Рухався(лась)_спорт" },
      { key: "rest", text: "/Відпочивав(ла)" },
    ],
  },
  keyboard: {
    frequencyButtons: [
      { text: "Раз на день о 9:00", callback_data: "freq_Once" },
      { text: "Двічі о 9:00 та 18:00", callback_data: "freq_Twice" },
      { text: "Тричі о 9:00, 15:00, 18:00", callback_data: "freq_ThreeTimes" },
      { text: "Чотири рази о 9:00, 12:00, 15:00, 18:00", callback_data: "freq_FourTimes" },
      { text: "Щогодини з 9:00 до 21:00", callback_data: "freq_Hourly" },
    ],
  },
};