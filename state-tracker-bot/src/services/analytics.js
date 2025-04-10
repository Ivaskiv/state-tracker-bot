// Файл services/analytics.js
import natural from 'natural';
import { NlpManager } from 'node-nlp';

// Ініціалізація NLP-менеджера
const manager = new NlpManager({ languages: ['uk'] });

// Додаємо базові фрази для розпізнавання стану
function initNLP() {
  // Позитивні стани
  manager.addDocument('uk', 'я щасливий', 'positive');
  manager.addDocument('uk', 'мені добре', 'positive');
  manager.addDocument('uk', 'я в ресурсі', 'positive');
  manager.addDocument('uk', 'відчуваю енергію', 'positive');
  
  // Нейтральні стани
  manager.addDocument('uk', 'нормально', 'neutral');
  manager.addDocument('uk', 'як завжди', 'neutral');
  manager.addDocument('uk', 'звичайно', 'neutral');
  
  // Негативні стани
  manager.addDocument('uk', 'тривожно', 'negative');
  manager.addDocument('uk', 'страшно', 'negative');
  manager.addDocument('uk', 'виснажений', 'negative');
  manager.addDocument('uk', 'втомився', 'negative');
  
  // Тренуємо модель
  return manager.train();
}

// Ініціалізація під час запуску
initNLP();

// Генерація щоденного звіту
async function generateDailyReport(records, user) {
  // Аналіз найчастішого стану
  const states = records.map(record => record.state);
  const stateCount = {};
  
  states.forEach(state => {
    stateCount[state] = (stateCount[state] || 0) + 1;
  });
  
  const mostCommonState = Object.keys(stateCount).reduce((a, b) => stateCount[a] > stateCount[b] ? a : b);
  
  // Аналіз частих емоцій
  const emotions = records.map(record => record.emotion);
  const emotionCount = {};
  
  emotions.forEach(emotion => {
    emotionCount[emotion] = (emotionCount[emotion] || 0) + 1;
  });
  
  const sortedEmotions = Object.keys(emotionCount)
    .sort((a, b) => emotionCount[b] - emotionCount[a])
    .slice(0, 3);
  
  // Аналіз тригерів (дії, що передували негативним станам)
  const triggers = [];
  
  for (let i = 1; i < records.length; i++) {
    if (['tense', 'exhausted', 'anxious', 'panic'].includes(records[i].state)) {
      triggers.push(records[i-1].action);
    }
  }
  
  const triggerCount = {};
  triggers.forEach(trigger => {
    triggerCount[trigger] = (triggerCount[trigger] || 0) + 1;
  });
  
  const commonTriggers = Object.keys(triggerCount)
    .sort((a, b) => triggerCount[b] - triggerCount[a])
    .slice(0, 2);
  
  // Генерація рекомендації
  let recommendation = '';
  
  if (commonTriggers.includes('social_media')) {
    recommendation = 'Спробуй обмежити час у соцмережах, особливо перед сном.';
  } else if (commonTriggers.includes('work')) {
    recommendation = 'Можливо, тобі потрібно більше перерв під час роботи та кращий баланс між роботою і відпочинком.';
  } else if (['tense', 'anxious', 'panic'].includes(mostCommonState)) {
    recommendation = 'Спробуй практики глибокого дихання або медитації, щоб зменшити тривогу.';
  } else if (mostCommonState === 'exhausted') {
    recommendation = 'Подбай про якісний сон та достатній відпочинок.';
  } else {
    recommendation = 'Продовжуй відстежувати свій стан, щоб помітити закономірності.';
  }
  
  // Форматування звіту
  return `📊 *Твій денний звіт*\n\n` +
    `Сьогодні ти найчастіше відчував(ла) себе *${translateState(mostCommonState)}*.\n\n` +
    `Основні емоції: ${sortedEmotions.map(translateEmotion).join(', ')}.\n\n` +
    `💡 Рекомендація: ${recommendation}\n\n` +
    `Продовжуй відстежувати свій стан регулярно для кращих результатів!`;
}

// Генерація тижневого звіту
async function generateWeeklyReport(records, user) {
  // Розбиваємо записи по днях
  const dayMap = {};
  
  records.forEach(record => {
    const day = record.timestamp.toISOString().split('T')[0];
    if (!dayMap[day]) {
      dayMap[day] = [];
    }
    dayMap[day].push(record);
  });
  
  // Аналізуємо тренди
  const statesByDay = {};
  const days = Object.keys(dayMap).sort();
  
  days.forEach(day => {
    const dayRecords = dayMap[day];
    const states = dayRecords.map(record => record.state);
    
    // Визначаємо найпоширеніший стан за день
    const stateCount = {};
    states.forEach(state => {
      stateCount[state] = (stateCount[state] || 0) + 1;
    });
    
    const mostCommonState = Object.keys(stateCount).reduce((a, b) => stateCount[a] > stateCount[b] ? a : b);
    statesByDay[day] = mostCommonState;
  });
  
  // Визначаємо загальний тренд
  let trend = 'стабільний';
  const firstState = statesByDay[days[0]];
  const lastState = statesByDay[days[days.length - 1]];
  
  const positiveStates = ['resourceful', 'calm'];
  const negativeStates = ['tense', 'exhausted', 'anxious', 'panic'];
  
  // Файл services/analytics.js (продовження)
  if (positiveStates.includes(firstState) && negativeStates.includes(lastState)) {
    trend = 'погіршення';
  } else if (negativeStates.includes(firstState) && positiveStates.includes(lastState)) {
    trend = 'покращення';
  }
  
  // Пошук патернів
  let patterns = [];
  
  // Перевіряємо зв'язок між діями та емоціями
  const actionEmotionMap = {};
  records.forEach(record => {
    if (!actionEmotionMap[record.action]) {
      actionEmotionMap[record.action] = {};
    }
    
    const emotionCount = actionEmotionMap[record.action];
    emotionCount[record.emotion] = (emotionCount[record.emotion] || 0) + 1;
  });
  
  Object.keys(actionEmotionMap).forEach(action => {
    const emotions = actionEmotionMap[action];
    const dominantEmotion = Object.keys(emotions).reduce((a, b) => emotions[a] > emotions[b] ? a : b);
    
    // Якщо є сильна кореляція
    if (emotions[dominantEmotion] >= 3) {
      patterns.push({
        action,
        emotion: dominantEmotion,
        count: emotions[dominantEmotion]
      });
    }
  });
  
  // Сортуємо паттерни за кількістю випадків
  patterns.sort((a, b) => b.count - a.count);
  
  // Генерація рекомендацій на основі тренду і патернів
  let recommendation = '';
  
  if (trend === 'погіршення') {
    recommendation = 'Твій емоційний стан погіршився за останній тиждень. Можливо, варто приділити більше уваги самодогляду та релаксації.';
  } else if (trend === 'покращення') {
    recommendation = 'Твій емоційний стан покращився за останній тиждень! Продовжуй те, що працює для тебе.';
  } else if (patterns.length > 0) {
    const topPattern = patterns[0];
    if (['joy', 'calm', 'gratitude'].includes(topPattern.emotion)) {
      recommendation = `Коли ти ${translateAction(topPattern.action)}, ти найчастіше відчуваєш ${translateEmotion(topPattern.emotion)}. Спробуй включати цю активність частіше!`;
    } else if (['anger', 'fear', 'sadness'].includes(topPattern.emotion)) {
      recommendation = `Коли ти ${translateAction(topPattern.action)}, ти найчастіше відчуваєш ${translateEmotion(topPattern.emotion)}. Можливо, варто обмежити або змінити цю активність.`;
    }
  } else {
    recommendation = 'Продовжуй відстежувати свій стан, щоб побачити більше закономірностей.';
  }
  
  // Форматування звіту
  let report = `📈 *Твій тижневий звіт*\n\n`;
  
  // Додаємо огляд по днях
  report += `*Огляд по днях:*\n`;
  days.forEach(day => {
    const date = new Date(day);
    const dayName = date.toLocaleDateString('uk-UA', { weekday: 'long' });
    report += `- ${dayName}: ${translateState(statesByDay[day])}\n`;
  });
  
  report += `\n*Загальний тренд:* ${trend}\n\n`;
  
  // Додаємо знайдені закономірності
  if (patterns.length > 0) {
    report += `*Виявлені закономірності:*\n`;
    patterns.slice(0, 2).forEach(pattern => {
      report += `- Коли ти ${translateAction(pattern.action)}, часто відчуваєш ${translateEmotion(pattern.emotion)}\n`;
    });
    report += `\n`;
  }
  
  report += `💡 *Рекомендація:* ${recommendation}\n\n`;
  report += `Продовжуй стежити за своїм емоційним станом! Регулярні записи допоможуть тобі краще розуміти себе.`;
  
  return report;
}

// Допоміжні функції для перекладу
function translateState(state) {
  const states = {
    'resourceful': 'ресурсний',
    'neutral': 'нейтральний',
    'tense': 'напружений',
    'exhausted': 'виснажений',
    'anxious': 'тривожний',
    'panic': 'панічний'
  };
  
  return states[state] || state;
}

function translateEmotion(emotion) {
  const emotions = {
    'joy': 'радість',
    'anger': 'гнів',
    'calm': 'спокій',
    'sadness': 'сум',
    'fear': 'страх',
    'gratitude': 'вдячність',
    'love': 'любов',
    'guilt': 'провина'
  };
  
  return emotions[emotion] || emotion;
}

function translateAction(action) {
  const actions = {
    'work': 'працюєш',
    'eating': 'їси',
    'social_media': 'користуєшся соцмережами',
    'communication': 'спілкуєшся',
    'exercise': 'займаєшся спортом',
    'rest': 'відпочиваєш'
  };
  
  return actions[action] || action;
}

// Аналіз текстової відповіді
async function analyzeSentiment(text) {
  try {
    // Аналіз настрою через NLP
    const result = await manager.process('uk', text);
    return result.intent;
  } catch (err) {
    console.error('Error analyzing sentiment:', err);
    return 'neutral'; // За замовчуванням
  }
}

export {
  generateDailyReport,
  generateWeeklyReport,
  analyzeSentiment
};