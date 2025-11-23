// src/features/aiMentor/analyzer.js

import openai from '../../services/openaiClient.js';
import airtable from '../../config/airtableClient.js';
import { logger } from '../../utils/logger.js';

class AIAnalyzer {
  
  /**
   * Проаналізувати стан користувача
   */
  async analyzeUser(userId) {
    try {
      logger.info('[AI Analyzer] Starting analysis', { userId });

      // 1. Зібрати всі дані
      const userData = await this.collectUserData(userId);

      // 2. Виконати AI аналіз
      const analysis = await this.performAIAnalysis(userData);

      // 3. Зберегти результат
      await this.saveAnalysisResults(userId, analysis);

      logger.info('[AI Analyzer] Analysis completed', { userId });

      return {
        success: true,
        analysis,
        recommendations: {
          course: analysis.recommended_course,
          reason: analysis.reason,
          actions: analysis.next_actions,
          should_offer: analysis.should_offer
        }
      };

    } catch (error) {
      logger.error('[AI Analyzer] Analysis failed', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Зібрати дані користувача
   */
  async collectUserData(userId) {
    try {
      const user = await airtable('Users').find(userId);

      // Останні 7 daily sessions
      const sessions = await airtable('Daily_Sessions')
        .select({
          filterByFormula: `{User} = '${userId}'`,
          sort: [{ field: 'Date', direction: 'desc' }],
          maxRecords: 7
        })
        .all();

      // Wheel Balance (якщо є)
      let wheelBalance = {};
      try {
        const wheelRecords = await airtable('Wheel_Balance')
          .select({
            filterByFormula: `{User} = '${userId}'`,
            sort: [{ field: 'Date', direction: 'desc' }],
            maxRecords: 1
          })
          .firstPage();
        
        if (wheelRecords.length > 0) {
          wheelBalance = wheelRecords[0].fields;
        }
      } catch (err) {
        logger.warn('[AI Analyzer] No wheel balance data', { userId });
      }

      // Enrollments
      const enrollments = await airtable('Enrollments')
        .select({
          filterByFormula: `{User} = '${userId}'`
        })
        .all();

      return {
        user: {
          name: user.fields.Name,
          level: user.fields.Level || 1,
          active_days: user.fields.Active_Days || 0,
          total_sessions: user.fields.Total_Sessions || 0,
          streak: user.fields.Streak || 0
        },
        sessions: sessions.map(s => ({
          date: s.fields.Date,
          state: s.fields.State,
          mood: s.fields.Mood,
          energy: s.fields.Energy,
          reflections: s.fields.Reflections
        })),
        wheel_balance: wheelBalance,
        courses: enrollments.map(e => ({
          course: e.fields.Course,
          status: e.fields.Status,
          progress: e.fields.Progress
        }))
      };

    } catch (error) {
      logger.error('[AI Analyzer] Data collection failed', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Виконати AI аналіз через OpenAI
   */
  async performAIAnalysis(userData) {
    try {
      const prompt = this.buildAnalysisPrompt(userData);

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { 
            role: 'system', 
            content: 'Ти експерт-ментор з особистісного розвитку. Аналізуй стан користувача та давай персоналізовані рекомендації.' 
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      return analysis;

    } catch (error) {
      logger.error('[AI Analyzer] OpenAI analysis failed', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Побудувати промпт для аналізу
   */
  buildAnalysisPrompt(userData) {
    return `
Проаналізуй стан користувача для особистісного розвитку:

КОРИСТУВАЧ: ${userData.user.name}
РІВЕНЬ: ${userData.user.level}
АКТИВНИХ ДНІВ: ${userData.user.active_days}
ЗАГАЛЬНИХ СЕСІЙ: ${userData.user.total_sessions}
STREAK: ${userData.user.streak}

ОСТАННІ 7 DAILY SESSIONS:
${JSON.stringify(userData.sessions, null, 2)}

WHEEL OF BALANCE:
${JSON.stringify(userData.wheel_balance, null, 2)}

ПОТОЧНІ КУРСИ:
${JSON.stringify(userData.courses, null, 2)}

ЗАВДАННЯ:
1. Визнач емоційний стан (стабільний/нестабільний/змінний)
2. Оціни рівень мотивації (низький/середній/високий)
3. Визнач 2-3 головні виклики/проблеми
4. Оціни готовність до змін (true/false)
5. Порекомендуй найкращий курс:
   - "Сила свідомості" (глибока трансформація)
   - "5 точок опори" (швидка стабільність)
   - "AI-воронки" (монетизація)
6. Запропонуй 3 конкретні дії на найближчі дні

ВІДПОВІДЬ СТРОГО У JSON:
{
  "emotional_state": "стабільний/нестабільний/змінний",
  "motivation_level": "низький/середній/високий",
  "main_issues": ["проблема1", "проблема2", "проблема3"],
  "readiness_for_change": true/false,
  "recommended_course": "назва курсу",
  "reason": "детальне пояснення чому саме цей курс",
  "next_actions": ["дія1", "дія2", "дія3"],
  "should_offer": true/false,
  "confidence": 0.0-1.0
}
`;
  }

  /**
   * Зберегти результати аналізу
   */
  async saveAnalysisResults(userId, analysis) {
    try {
      await airtable('AI_Insights').create([{
        fields: {
          User: [userId],
          Date: new Date().toISOString().split('T')[0],
          Analysis_Type: 'User State Analysis',
          Emotional_State: analysis.emotional_state,
          Motivation_Level: analysis.motivation_level,
          Recommended_Course: analysis.recommended_course,
          Should_Offer: analysis.should_offer,
          Confidence: analysis.confidence,
          AI_Response: JSON.stringify(analysis)
        }
      }]);

      logger.info('[AI Analyzer] Results saved', { userId });

    } catch (error) {
      logger.error('[AI Analyzer] Save results failed', { 
        error: error.message 
      });
      // Не кидаємо помилку, просто логуємо
    }
  }

  /**
   * Перевірити чи треба показати пропозицію
   */
  async shouldShowOffer(userId) {
    try {
      const user = await airtable('Users').find(userId);
      
      const trialDay = this.calculateTrialDay(user.fields.Trial_Start_Date);
      const activeDays = user.fields.Active_Days || 0;
      const totalSessions = user.fields.Total_Sessions || 0;

      // Умови для показу пропозиції:
      // - День 5-7 trial
      // - Мінімум 3 сесії
      // - Мінімум 3 активні дні
      const shouldShow = (
        trialDay >= 5 && 
        trialDay <= 7 &&
        totalSessions >= 3 &&
        activeDays >= 3
      );

      return shouldShow;

    } catch (error) {
      logger.error('[AI Analyzer] Should show offer check failed', { 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Розрахувати день trial
   */
  calculateTrialDay(startDate) {
    if (!startDate) return 0;
    
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays + 1;
  }
}

export default new AIAnalyzer();