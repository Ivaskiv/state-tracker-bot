// services/aiAnalytics.js
import axios from 'axios';

export class AIAnalytics {
  
  static async generateDailyAnalysis(reflectionData) {
    const prompt = `
Ти — експертний коуч трансформації рівня Tony Robbins + Simon Sinek + Tim Ferriss, який аналізує щоденні рефлексії для виявлення внутрішньої сили, шаблонів поведінки та точок росту.

Принципи роботи:
- Говори з позиції "ти вже маєш силу всередині"
- Виділяй ресурси та можливості, а не проблеми
- Блокуючі програми називай прямо, але з підтримкою
- Пропонуй конкретні мікро-дії, не загальні поради
- Використовуй мову трансформації та внутрішньої сили

Формат відповіді:
🌟 Внутрішня сила: [2-3 речення про прояви самоцінності, рішучості, позитивних виборів]
🔍 Важливі закономірності: [2-3 речення про шаблони в енергії, стані, реакціях]
💡 Точки росту: [1-2 речення про програми для трансформації]
⚡️ Практичні кроки: 
• [Дія на завтра] 
• [Вправа для стану] 
• [Мікро-вибір для посилення]

Вимоги:
- Мова: українська
- Довжина: до 150 слів
- Тон: підтримуючий, з позиції сили
- Фокус: ресурси та можливості

Дані для аналізу:
Стан: ${reflectionData.state || 'не вказано'}
Ціль: ${reflectionData.goal || 'не вказано'}  
Що наповнило енергією: ${reflectionData.energyGain || 'не вказано'}
Де злила енергію: ${reflectionData.energyLoss || 'не вказано'}
Програми: ${reflectionData.programs || 'не вказано'}
Перемога: ${reflectionData.victory || 'не вказано'}
`;

    try {
      if (!process.env.OPENAI_API_KEY) {
        return this.generateSimpleAnalysis(reflectionData);
      }

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Ти експертний AI-коуч, який допомагає людям розкрити внутрішню силу через аналіз щоденних рефлексій.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return this.generateSimpleAnalysis(reflectionData);
    }
  }

  static generateSimpleAnalysis(data) {
    const analyses = [
      `🌟 Внутрішня сила: Ти продовжуєш рухатися вперед, навіть коли виникають виклики. Твоя здатність до рефлексії показує глибину усвідомленості.

🔍 Важливі закономірності: Помітно, що ти вже вмієш розрізняти, що тебе наповнює, а що виснажує.

💡 Точки росту: Продовжуй спостерігати за своїми реакціями — це ключ до трансформації.

⚡️ Практичні кроки:
• Завтра зроби одну дію з позиції сили
• Коли відчуєш тривогу — зроби 3 глибокі вдихи
• Обери одну річ, яка тебе надихає, і приділи їй 10 хвилин`,

      `🌟 Внутрішня сила: Твоя готовність аналізувати свій день говорить про внутрішню мудрість. Ти вже на шляху змін.

🔍 Важливі закономірності: Ти починаєш краще розуміти свої емоційні реакції та їх вплив на енергію.

💡 Точки росту: Кожна програма, яку ти помічаєш — це можливість для звільнення.

⚡️ Практичні кроки:
• Обери один позитивний ритуал на ранок
• При негативних думках питай: "Чи це правда?"
• Святкуй навіть маленькі перемоги`
    ];

    return analyses[Math.floor(Math.random() * analyses.length)];
  }

  static async generateWeeklyReport(weeklyData) {
    const energyLosses = weeklyData.map(d => d.energyLoss).filter(Boolean);
    const programs = weeklyData.map(d => d.programs).filter(Boolean);
    const victories = weeklyData.map(d => d.victory).filter(Boolean);
    const energyGains = weeklyData.map(d => d.energyGain).filter(Boolean);

    return `🌱 ТВІЙ ТИЖНЕВИЙ ЗВІТ

🔻 Витоки енергії:
${energyLosses.length > 0 ? `Часто зливала енергію в: ${this.findMostCommon(energyLosses)}` : 'Енергія тримається стабільно'}

🚧 Блокуючі програми:
${programs.length > 0 ? `"${this.findMostCommon(programs)}" з'являлось найчастіше` : 'Програми під контролем'}

🌊 Наповнення:
${energyGains.length > 0 ? `Тебе надихало: ${this.findMostCommon(energyGains)}` : 'Шукай нові джерела натхнення'}

🏆 Внутрішні перемоги:
${victories.length > 0 ? victories.slice(0, 2).join(', ') : 'Кожен день рефлексії — вже перемога'}

☀️ Наступний крок:
Фокусуйся на тому, що тебе наповнює, і обмежуй витоки енергії.`;
  }

  static async generateMonthlyReport(monthlyData) {
    const goals = monthlyData.map(d => d.goal).filter(Boolean);
    const states = monthlyData.map(d => d.state).filter(Boolean);
    
    return `🌟 ТВІЙ МІСЯЧНИЙ ЗВІТ

🎯 Цілі:
Найчастіше ти фокусувалася на: ${this.findMostCommon(goals) || 'різних напрямках'}

🧭 Стан місяця:
Переважаючий стан: ${this.findMostCommon(states) || 'в процесі пізнання себе'}

⚡️ Нова точка сили:
Ти стала більш усвідомленою у своїх виборах та реакціях.

📌 Рекомендація на місяць:
- Дій із стану впевненості
- Обирай те, що тебе наповнює
- Фокусуйся на одній головній цілі

Ти на правильному шляху! 💪`;
  }

  static findMostCommon(arr) {
    if (arr.length === 0) return '';
    
    const frequency = {};
    arr.forEach(item => {
      if (item) {
        frequency[item] = (frequency[item] || 0) + 1;
      }
    });
    
    return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
  }

  static async generateAffirmation() {
    const affirmations = [
      "Твоя сила розкривається з кожним усвідомленим вибором.",
      "Ти створюєш свою реальність кожного дня через малі рішення.",
      "Твоє внутрішнє бачення веде тебе до успіху.",
      "Кожен виклик розкриває твої приховані можливості.",
      "Ти вже маєш все необхідне для досягнення цілей.",
      "Твоя енергія магнітом притягує те, що тобі потрібно.",
      "Довіра до себе — твоя найбільша суперсила.",
      "Ти трансформуєшся щодня через усвідомлені дії.",
      "Твоє серце знає правильний шлях до мети.",
      "Сміливість діяти змінює всю твою реальність."
    ];
    
    return affirmations[Math.floor(Math.random() * affirmations.length)];
  }
}