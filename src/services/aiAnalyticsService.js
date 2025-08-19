// services/aiAnalyticsService.js
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

class AIAnalyticsService {
  constructor() {
    this.systemPrompt = `Ти — експертний коуч трансформації рівня Tony Robbins + Simon Sinek + Tim Ferriss, який аналізує щоденні рефлексії для виявлення внутрішньої сили, шаблонів поведінки та точок росту. Твоя мета — підтримати користувача в усвідомленні власних ресурсів та наступних кроків до мети.

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

Заборонено:
- Слова "проблема", "недолік", "слабкість"
- Загальні фрази
- Медичні поради
- Повторення написаного користувачем`;
  }

  async generateWeeklyAnalysis(weeklyData) {
    if (!openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      // Prepare data for analysis
      const analysisData = this.prepareWeeklyData(weeklyData);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Проаналізуй щотижневі рефлексії:\n\n${analysisData}` }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating AI weekly analysis:', error);
      throw error;
    }
  }

  async generateMonthlyAnalysis(monthlyData) {
    if (!openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      // Prepare data for analysis
      const analysisData = this.prepareMonthlyData(monthlyData);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Проаналізуй місячні рефлексії для глибокого звіту:\n\n${analysisData}` }
        ],
        max_tokens: 800,
        temperature: 0.7
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating AI monthly analysis:', error);
      throw error;
    }
  }

  async generatePersonalizedAffirmation(userData) {
    if (!openai) {
      return this.getFallbackAffirmation();
    }

    try {
      const prompt = `На основі останніх рефлексій створи персональну афірмацію українською мовою (8-20 слів):
      
Стан: ${userData.state || 'не вказано'}
Цілі: ${userData.goals || 'не вказано'}
Перемоги: ${userData.victories || 'не вказано'}

Афірмація має бути:
- Особистою та конкретною
- Позитивною та надихаючою
- 8-20 слів
- Українською мовою`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.8
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating personalized affirmation:', error);
      return this.getFallbackAffirmation();
    }
  }

  prepareWeeklyData(weeklyData) {
    let dataText = `Дні з рефлексіями: ${weeklyData.completedDays}/7\n`;
    dataText += `Загальна кількість записів: ${weeklyData.reflections.length}\n\n`;

    // Extract key patterns
    const energyGains = this.extractField(weeklyData.reflections, 'Energy Gain');
    const energyLosses = this.extractField(weeklyData.reflections, 'Energy Loss');
    const programs = this.extractField(weeklyData.reflections, 'Programs');
    const states = this.extractField(weeklyData.reflections, 'State');
    const victories = this.extractField(weeklyData.reflections, 'Victory');

    if (energyGains.length > 0) {
      dataText += `Джерела енергії: ${energyGains.join(', ')}\n`;
    }
    
    if (energyLosses.length > 0) {
      dataText += `Витоки енергії: ${energyLosses.join(', ')}\n`;
    }
    
    if (programs.length > 0) {
      dataText += `Програми/переконання: ${programs.join(', ')}\n`;
    }
    
    if (states.length > 0) {
      dataText += `Стани: ${states.join(', ')}\n`;
    }
    
    if (victories.length > 0) {
      dataText += `Перемоги: ${victories.join(', ')}\n`;
    }

    return dataText;
  }

  prepareMonthlyData(monthlyData) {
    let dataText = `Дні з рефлексіями: ${monthlyData.completedDays}/30\n`;
    dataText += `Загальна кількість записів: ${monthlyData.reflections.length}\n\n`;

    // More detailed analysis for monthly report
    const patterns = this.analyzePatterns(monthlyData.reflections);
    
    dataText += `НАЙЧАСТІШІ ШАБЛОНИ:\n`;
    
    if (patterns.energyGains.length > 0) {
      dataText += `Енергія від: ${patterns.energyGains.slice(0, 3).map(p => `${p.pattern}(${p.count})`).join(', ')}\n`;
    }
    
    if (patterns.energyLosses.length > 0) {
      dataText += `Втрата енергії: ${patterns.energyLosses.slice(0, 3).map(p => `${p.pattern}(${p.count})`).join(', ')}\n`;
    }
    
    if (patterns.programs.length > 0) {
      dataText += `Блокуючі програми: ${patterns.programs.slice(0, 3).map(p => `${p.pattern}(${p.count})`).join(', ')}\n`;
    }
    
    if (patterns.states.length > 0) {
      dataText += `Домінуючі стани: ${patterns.states.slice(0, 3).map(p => `${p.pattern}(${p.count})`).join(', ')}\n`;
    }

    return dataText;
  }

  extractField(reflections, fieldName) {
    return reflections
      .map(r => r.fields[fieldName])
      .filter(value => value && value.trim())
      .map(value => value.trim())
      .slice(0, 10); // Limit for API
  }

  analyzePatterns(reflections) {
    const patterns = {
      energyGains: this.getPatternFrequency(reflections, 'Energy Gain'),
      energyLosses: this.getPatternFrequency(reflections, 'Energy Loss'),
      programs: this.getPatternFrequency(reflections, 'Programs'),
      states: this.getPatternFrequency(reflections, 'State'),
      victories: this.getPatternFrequency(reflections, 'Victory')
    };

    return patterns;
  }

  getPatternFrequency(reflections, fieldName) {
    const frequency = {};
    
    reflections.forEach(reflection => {
      const value = reflection.fields[fieldName];
      if (value && value.trim()) {
        const key = value.trim().toLowerCase();
        frequency[key] = (frequency[key] || 0) + 1;
      }
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }));
  }

  getFallbackAffirmation() {
    const fallbackAffirmations = [
      'Моє бачення — мій вибір. Моя сила — в мені.',
      'Я вже йду своїм шляхом до справжньої себе.',
      'Кожен день я стаю сильнішою та мудрішою.',
      'Мої цілі вже здійснюються через мої дії.',
      'Я заслуговую на все найкраще прямо зараз.'
    ];
    
    return fallbackAffirmations[Math.floor(Math.random() * fallbackAffirmations.length)];
  }

  async testConnection() {
    if (!openai) {
      return { connected: false, message: 'OpenAI API key not configured' };
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5
      });
      
      return { connected: true, message: 'OpenAI API connected successfully' };
    } catch (error) {
      return { connected: false, message: error.message };
    }
  }
}

export default new AIAnalyticsService();