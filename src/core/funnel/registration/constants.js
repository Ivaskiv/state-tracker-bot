// src/features/registration/constants.js
export const REGISTRATION_STEPS = {
  START: 'registration_start',
  NAME_CHOICE: 'registration_name_choice',
  NAME_INPUT: 'registration_name_input',
  EMAIL: 'registration_email',
  PHONE: 'registration_phone',
  COMPLETED: 'registration_completed'
};

export const MESSAGES = {
  WELCOME: (firstName) => 
    `Привіт${firstName ? `, ${firstName}` : ''}! 👋\n\n` +
    `Вітаю в AI-наставнику для трансформації життя.\n\n` +
    `Перш ніж почати, давай познайомимось.\n` +
    `Як тебе звати?`,
  
  NAME_SAVED: (name) => 
    `Записала: "${name}" ✅\n\n` +
    `Тепер введи email (або натисни "Пропустити"):`,
  
  EMAIL_SAVED: 
    `Email збережено! ✅\n\n` +
    `Останній крок - телефон (або "Пропустити"):`,
  
  COMPLETED: 
    `🎉 Реєстрація завершена!\n\n` +
    `+10 балів за реєстрацію 💰\n\n` +
    `Тепер ти можеш почати свій шлях трансформації.`
};