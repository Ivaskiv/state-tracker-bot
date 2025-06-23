// configData.js

export  const configData = {
  botName: "State Tracker Bot",
  welcomeMessage: "Ласкаво просимо до бота для відстеження твого стану!",
  errorMessage: "Щось пішло не так. Спробуйте ще раз.",
  startTime: "00:00",
  endTime: "23:59",
  admins: [],
  ai: {
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 500
  },
  frequencyOptions: {
    '15': '15 хвилин',
    '30': '30 хвилин',
    '60': '1 година',
    '120': '2 години'
  },
  themes: {
    emotionTracking: {
      emotion: "Яку емоцію ти зараз відчуваєш найсильніше?",
      feeling: "А яке глибше почуття переважає в тобі сьогодні/зараз?",
      action: "Що ти робив(ла) прямо перед тим, як відповідав(ла)?",
      customPrompt: "Опиши своїми словами:",
      completion: "Дякую! Ти зробив(ла) ще один крок до свідомого стану 🧘‍♀️\nТвої відповіді збережено. Побачимось наступного разу!"
    },
    dietTracking: {
      question: "Які твої цілі у харчуванні або дієті?",
      action: "Що ти їв(ла) сьогодні?",
      customPrompt: "Опиши свої харчові звички або дієту:",
      completion: "Дякую! Ти зробив(ла) крок до покращення свого харчування 🥗\nТвої відповіді збережено. Побачимось наступного разу!"
    },
    fitnessTracking: {
      question: "Які твої фітнес-цілі?",
      action: "Що ти робив(ла) сьогодні для покращення фізичної форми?",
      customPrompt: "Опиши свої тренування або активність:",
      completion: "Чудово! Ти рухаєшся у правильному напрямку для досягнення своїх фітнес-цілей 💪\nТвої відповіді збережено. Побачимось наступного разу!"
    },
    mentalHealthTracking: {
      question: "Як ти себе почуваєш психологічно?",
      action: "Що ти зробив(ла), щоб підтримати своє психічне здоров'я?",
      customPrompt: "Опиши свої методи підтримки психічного здоров'я:",
      completion: "Дякую! Ти зробив(ла) важливий крок до підтримки психічного здоров'я 🧠\nТвої відповіді збережено. Побачимось наступного разу!"
    }
  },
  pollSettings: {
    states: [
      { key: "resourceful", text: "Ресурсний 💪" },
      { key: "neutral", text: "Нейтральний 😐" },
      { key: "tense", text: "Напружений 😬" },
      { key: "exhausted", text: "Виснажений 💤" },
      { key: "anxious", text: "Тривожний 😟" },
      { key: "panic", text: "Панічний 😱" }
    ],
    emotions: [
      { key: "joy", text: "Радість 😀" },
      { key: "anger", text: "Гнів 😡" },
      { key: "calm", text: "Спокій 😌" },
      { key: "sadness", text: "Сум 😢" },
      { key: "fear", text: "Страх 😨" },
      { key: "gratitude", text: "Вдячність 🙏" }
    ],
    feelings: [
      { key: "love", text: "Любов ❤️" },
      { key: "guilt", text: "Провина 😔" },
      { key: "loneliness", text: "Самотність 😞" },
      { key: "acceptance", text: "Прийняття 👐" },
      { key: "shame", text: "Сором 😳" },
      { key: "hope", text: "Надія 🌟" }
    ],
    actions: [
      { key: "work", text: "Працював(ла) 💼" },
      { key: "eating", text: "Їв(ла) 🍽️" },
      { key: "social_media", text: "Був(ла) в соцмережах 📱" },
      { key: "communication", text: "Спілкувався(лась) 🗣️" },
      { key: "exercise", text: "Рухався(лась) / спорт 🏋️‍♂️" },
      { key: "rest", text: "Відпочивав(ла) 🛋️" }
    ]
  },
  reportSettings: {
    maxDaysInWeeklyReport: 7,
    minRecordsForAnalysis: 3
  },
  messages: {
    welcomeMessage: "Ласкаво просимо до бота для відстеження твого стану!",
    errorMessage: "Щось пішло не так. Спробуйте ще раз.",
    noRecords: "Ще немає записів за цей період. 🙁",
    sendReportSuccess: "Звіт успішно надіслано! 📬",
    sendEmailSuccess: "Звіт надіслано на ваш email! 📧",
    setupError: "Помилка при налаштуванні параметрів. 😞",
    sendPdfError: "Не вдалося надіслати PDF звіт. 😞",
    reportSettingsMessage: "Оберіть період або канал для звітів:",
    changeMessagePrompt: "Введіть нове повідомлення для: ",
    changeMessageSuccess: "Повідомлення успішно змінено! ✅",

    moodStep: "Як ти себе почуваєш?",
    energyStep: "Скільки в тебе енергії?",
    thoughtsStep: "Що в тебе на думці?",
    defaultStep: "Оберіть варіант:"
  },
  keyboard: {
    mainMenu:[
      { text: 'Почати реєстрацію', callback_data: 'start_registration' },
      { text: 'Переглянути налаштування', callback_data: 'view_settings' },
      { text: 'Допомога', callback_data: 'help' },
      { text: 'Очистити чат', callback_data: 'clear_chat' },
      { text: '📊 Переглянути звіт', callback_data: 'view_report' },
      { text: '📝 Почати опитування', callback_data: 'poll' }
    ],
    stateButtons: [
      { text: "Ресурсний 💪", callback_data: "state_resourceful" },
      { text: "Нейтральний 😐", callback_data: "state_neutral" },
      { text: "Напружений 😬", callback_data: "state_tense" },
      { text: "Виснажений 💤", callback_data: "state_exhausted" },
      { text: "Тривожний 😟", callback_data: "state_anxious" },
      { text: "Панічний 😱", callback_data: "state_panic" }
    ],
    emotionButtons: [
      { text: "Радість 😀", callback_data: "emotion_joy" },
      { text: "Гнів 😡", callback_data: "emotion_anger" },
      { text: "Спокій 😌", callback_data: "emotion_calm" },
      { text: "Сум 😢", callback_data: "emotion_sadness" },
      { text: "Страх 😨", callback_data: "emotion_fear" },
      { text: "Вдячність 🙏", callback_data: "emotion_gratitude" }
    ],
    feelingButtons: [
      { text: "Любов ❤️", callback_data: "feeling_love" },
      { text: "Провина 😔", callback_data: "feeling_guilt" },
      { text: "Самотність 😞", callback_data: "feeling_loneliness" },
      { text: "Прийняття 👐", callback_data: "feeling_acceptance" },
      { text: "Сором 😳", callback_data: "feeling_shame" },
      { text: "Надія 🌟", callback_data: "feeling_hope" }
    ],
    actionButtons: [
      { text: "Працював(ла) 💼", callback_data: "action_work" },
      { text: "Їв(ла) 🍽️", callback_data: "action_eating" },
      { text: "Був(ла) в соцмережах 📱", callback_data: "action_social_media" },
      { text: "Спілкувався(лась) 🗣️", callback_data: "action_communication" },
      { text: "Рухався(лась) / спорт 🏋️‍♂️", callback_data: "action_exercise" },
      { text: "Відпочивав(ла) 🛋️", callback_data: "action_rest" }
    ],
    reportSettings: [
      { label: "Щодня", action: "dailyReport" },
      { label: "Щотижня", action: "weeklyReport" },
      { label: "Щомісяця", action: "monthlyReport" },
      { label: "Всі", action: "allReport" }
    ]
  }
};
