// aiMentor/handlers.js
export const handleMorningSupport = async (ctx, tgId) => {
  try {
    // Отримуємо контекст
    const context = await buildMorningContext(tgId);
    if (!context) return;
    
    // Генеруємо персоналізовану підтримку
    const prompt = `
      Користувач активував AI Mentor ранком.
      
      📍 Його фокус сьогодні: "${context.daily_focus}"
      💪 Сильні якості: ${context.morning_answers.strengths}
      📈 Стан: ${context.morning_answers.state}
      🎯 Дії: ${context.planned_actions.map(a => a.Daily_Action_Text).join(', ')}
      
      Останнє колесо: ${context.last_wheel_analysis}
      
      Дай ОДНУ конкретну мікро-рекомендацію для його фокусу.
      Формат: 1 рядок дії, час, результат.
    `;
    
    const suggestion = await chat([
      { role: 'system', content: AI_MENTOR_PROMPTS.SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 200);
    
    // Логуємо пропозицію
    await base(tables.AI_CONVERSATIONS).create([{
      fields: {
        TG_id: String(tgId),
        Date: todayISO(),
        Session_Type: 'ai_mentor_morning',
        User_Input: context.daily_focus,
        AI_Analysis: suggestion,
        Context_Data: JSON.stringify(context),
        Feedback_Status: 'pending'
      }
    }]);
    
    await ctx.reply(`🤖 ${suggestion}`, keyboards.mainMenuKeyboard());
    
  } catch (error) {
    logger.error('[handleMorningSupport] ❌', error);
  }
};
