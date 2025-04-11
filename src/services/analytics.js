import { NlpManager } from 'node-nlp';

// Ініціалізація NLP-менеджера
const manager = new NlpManager({ languages: ['uk'] });

// Додаємо базові фрази для розпізнавання стану
function initNLP() {
  // Позитивні стани
  const positiveStates = ['я щасливий', 'мені добре', 'я в ресурсі', 'відчуваю енергію'];
  positiveStates.forEach(state => manager.addDocument('uk', state, 'positive'));

  // Нейтральні стани
  const neutralStates = ['нормально', 'як завжди', 'звичайно'];
  neutralStates.forEach(state => manager.addDocument('uk', state, 'neutral'));

  // Негативні стани
  const negativeStates = ['тривожно', 'страшно', 'виснажений', 'втомився'];
  negativeStates.forEach(state => manager.addDocument('uk', state, 'negative'));

  // Тренуємо модель
  return manager.train();
}

// Ініціалізація під час запуску
initNLP();

// Генерація щоденного звіту
async function generateDailyReport(records, user) {
  // Підготовка даних для звіту
  const states = records.map(record => record.state);
  const stateCount = countOccurrences(states);
  const mostCommonState = getMostCommon(stateCount);

  const emotions = records.map(record => record.emotion);
  const emotionCount = countOccurrences(emotions);
  const sortedEmotions = getTopEmotions(emotionCount);

  const triggers = getTriggers(records);

  const triggerCount = countOccurrences(triggers);
  const commonTriggers = getTopTriggers(triggerCount);

  const recommendation = generateRecommendation(mostCommonState, commonTriggers);

  // Форматування звіту
  return formatDailyReport(mostCommonState, sortedEmotions, recommendation);
}

// Генерація тижневого звіту
async function generateWeeklyReport(records, user) {
  // Розбиваємо записи по днях
  const dayMap = groupRecordsByDay(records);

  const statesByDay = analyzeStatesByDay(dayMap);

  const trend = calculateTrend(statesByDay);

  const patterns = findPatterns(records);

  const recommendation = generateWeeklyRecommendation(trend, patterns);

  return formatWeeklyReport(statesByDay, trend, patterns, recommendation);
}

// Допоміжні функції
function countOccurrences(arr) {
  return arr.reduce((count, item) => {
    count[item] = (count[item] || 0) + 1;
    return count;
  }, {});
}

function getMostCommon(countMap) {
  return Object.keys(countMap).reduce((a, b) => countMap[a] > countMap[b] ? a : b);
}

function getTopEmotions(emotionCount) {
  return Object.keys(emotionCount)
    .sort((a, b) => emotionCount[b] - emotionCount[a])
    .slice(0, 3);
}

function getTriggers(records) {
  const triggers = [];
  for (let i = 1; i < records.length; i++) {
    if (['tense', 'exhausted', 'anxious', 'panic'].includes(records[i].state)) {
      triggers.push(records[i-1].action);
    }
  }
  return triggers;
}

function getTopTriggers(triggerCount) {
  return Object.keys(triggerCount)
    .sort((a, b) => triggerCount[b] - triggerCount[a])
    .slice(0, 2);
}

function generateRecommendation(mostCommonState, commonTriggers) {
  if (commonTriggers.includes('social_media')) {
    return 'Спробуй обмежити час у соцмережах, особливо перед сном.';
  } else if (commonTriggers.includes('work')) {
    return 'Можливо, тобі потрібно більше перерв під час роботи та кращий баланс між роботою і відпочинком.';
  } else if (['tense', 'anxious', 'panic'].includes(mostCommonState)) {
    return 'Спробуй практики глибокого дихання або медитації, щоб зменшити тривогу.';
  } else if (mostCommonState === 'exhausted') {
    return 'Подбай про якісний сон та достатній відпочинок.';
  } else {
    return 'Продовжуй відстежувати свій стан, щоб помітити закономірності.';
  }
}

function formatDailyReport(mostCommonState, sortedEmotions, recommendation) {
  return `📊 *Твій денний звіт*\n\n` +
    `Сьогодні ти найчастіше відчував(ла) себе *${translateState(mostCommonState)}*.\n\n` +
    `Основні емоції: ${sortedEmotions.map(translateEmotion).join(', ')}.\n\n` +
    `💡 Рекомендація: ${recommendation}\n\n` +
    `Продовжуй відстежувати свій стан регулярно для кращих результатів!`;
}

function groupRecordsByDay(records) {
  const dayMap = {};
  records.forEach(record => {
    const day = record.timestamp.toISOString().split('T')[0];
    if (!dayMap[day]) {
      dayMap[day] = [];
    }
    dayMap[day].push(record);
  });
  return dayMap;
}

function analyzeStatesByDay(dayMap) {
  const statesByDay = {};
  Object.keys(dayMap).forEach(day => {
    const dayRecords = dayMap[day];
    const states = dayRecords.map(record => record.state);
    const stateCount = countOccurrences(states);
    statesByDay[day] = getMostCommon(stateCount);
  });
  return statesByDay;
}

function calculateTrend(statesByDay) {
  const days = Object.keys(statesByDay);
  const firstState = statesByDay[days[0]];
  const lastState = statesByDay[days[days.length - 1]];
  
  const positiveStates = ['resourceful', 'calm'];
  const negativeStates = ['tense', 'exhausted', 'anxious', 'panic'];

  if (positiveStates.includes(firstState) && negativeStates.includes(lastState)) {
    return 'погіршення';
  } else if (negativeStates.includes(firstState) && positiveStates.includes(lastState)) {
    return 'покращення';
  }
  
  return 'стабільний';
}

function findPatterns(records) {
  const actionEmotionMap = {};
  records.forEach(record => {
    if (!actionEmotionMap[record.action]) {
      actionEmotionMap[record.action] = {};
    }
    
    const emotionCount = actionEmotionMap[record.action];
    emotionCount[record.emotion] = (emotionCount[record.emotion] || 0) + 1;
  });
  
  let patterns = [];
  Object.keys(actionEmotionMap).forEach(action => {
    const emotions = actionEmotionMap[action];
    const dominantEmotion = getMostCommon(emotions);
    
    if (emotions[dominantEmotion] >= 3) {
      patterns.push({ action, emotion: dominantEmotion, count: emotions[dominantEmotion] });
    }
  });
  
  patterns.sort((a, b) => b.count - a.count);
  return patterns;
}

function generateWeeklyRecommendation(trend, patterns) {
  if (trend === 'погіршення') {
    return 'Твій емоційний стан погіршився за останній тиждень. Можливо, варто приділити більше уваги самодогляду та релаксації.';
  } else if (trend === 'покращення') {
    return 'Твій емоційний стан покращився за останній тиждень! Продовжуй те, що працює для тебе.';
  } else if (patterns.length > 0) {
    const topPattern = patterns[0];
    if (['joy', 'calm', 'gratitude'].includes(topPattern.emotion)) {
      return `Коли ти ${translateAction(topPattern.action)}, ти найчастіше відчуваєш ${translateEmotion(topPattern.emotion)}. Спробуй включати цю активність частіше!`;
    } else if (['anger', 'fear', 'sadness'].includes(topPattern.emotion)) {
      return `Коли ти ${translateAction(topPattern.action)}, ти найчастіше відчуваєш ${translateEmotion(topPattern.emotion)}. Можливо, варто обмежити або змінити цю активність.`;
    }
  }
  
  return 'Продовжуй відстежувати свій стан, щоб побачити більше закономірностей.';
}

function formatWeeklyReport(statesByDay, trend, patterns, recommendation) {
  let report = `📈 *Твій тижневий звіт*\n\n*Огляд по днях:*\n`;
  
  const days = Object.keys(statesByDay);
  days.forEach(day => {
    const date = new Date(day);
    const dayName = date.toLocaleDateString('uk-UA', { weekday: 'long' });
    report += `- ${dayName}: ${translateState(statesByDay[day])}\n`;
  });
  
  report += `\n*Загальний тренд:* ${trend}\n\n`;
  
  if (patterns.length > 0) {
    report += `*Виявлені закономірності:*\n`;
    patterns.slice(0, 2).forEach(pattern => {
      report += `- Коли ти ${translateAction(pattern.action)}, часто відчуваєш ${translateEmotion(pattern.emotion)}\n`;
    });
    report += `\n`;
  }
  
  report += `💡 *Рекомендація:* ${recommendation}\n\n`;
  report += `Продовжуй стежити за своїм емоційним станом та долати труднощі!`;

  return report;
}

function translateState(state) {
  const stateTranslations = {
    'positive': 'позитивний',
    'neutral': 'нейтральний',
    'negative': 'негативний',
    'resourceful': 'в ресурсі',
    'calm': 'спокійний',
    'tense': 'напружений',
    'exhausted': 'втомлений',
    'anxious': 'тривожний',
    'panic': 'панічний'
  };
  return stateTranslations[state] || state;
}

function translateEmotion(emotion) {
  const emotionTranslations = {
    'joy': 'радість',
    'calm': 'спокій',
    'gratitude': 'вдячність',
    'anger': 'гнів',
    'fear': 'страх',
    'sadness': 'смуток'
  };
  return emotionTranslations[emotion] || emotion;
}

function translateAction(action) {
  const actionTranslations = {
    'social_media': 'соціальні мережі',
    'work': 'робота',
    'exercise': 'тренування',
    'family': 'родина'
  };
  return actionTranslations[action] || action;
}

export { generateDailyReport, generateWeeklyReport, initNLP };
