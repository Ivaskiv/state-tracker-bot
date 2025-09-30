// src/controllers/flows/workSessionController.js
const askWorkFocus = async (ctx) => {
  const questions = [
    "Ким я стаю професійно через рік? (1-2 речення)",
    "Мої 2 цілі на цей місяць?",
    "Головна ціль сьогодні?",
    "3 конкретні дії для досягнення цієї цілі",
    "Мій робочий стан зараз?"
  ];
  
  // Після відповідей - SMART конвертація
  const smartActions = await smartifyUserActions(answers);
  
  // Встановлюємо нагадування
  scheduleWorkReminders(ctx.from.id, smartActions);
};