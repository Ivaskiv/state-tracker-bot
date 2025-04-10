// Файл controllers/polling.js
import User from '../models/user.js';
import Record from '../models/record.js';

// Запуск опитування
async function startPoll(ctx) {
  const telegramId = ctx.from.id;
  
  try {
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('Спочатку потрібно зареєструватися. Використовуйте команду /start.');
    }
    
    await sendStateQuestion(ctx, user.name);
  } catch (err) {
    console.error('Error starting poll:', err);
    await ctx.reply('Вибачте, сталася помилка. Спробуйте знову пізніше.');
  }
}

// Відправка питання про стан
async function sendStateQuestion(ctx, userName) {
  await ctx.reply(
    `${userName}, як ти зараз себе почуваєш загалом?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Ресурсний', callback_data: 'state_resourceful' },
            { text: 'Нейтральний', callback_data: 'state_neutral' }
          ],
          [
            { text: 'Напружений', callback_data: 'state_tense' },
            { text: 'Виснажений', callback_data: 'state_exhausted' }
          ],
          [
            { text: 'Тривожний', callback_data: 'state_anxious' },
            { text: 'Панічний', callback_data: 'state_panic' }
          ],
          [{ text: '✍️ Напиши свій варіант', callback_data: 'state_custom' }]
        ]
      }
    }
  );
}

// Обробка відповіді про стан
async function handleStateResponse(ctx) {
  const state = ctx.match[1];
  
  if (state === 'custom') {
    await ctx.reply('Опиши свій стан своїми словами:');
    // Додаємо слухача для обробки текстової відповіді
    ctx.scene.register('customState', customStateScene);
    return ctx.scene.enter('customState');
  }
  
  // Зберігаємо стан в сесії
  ctx.session.currentPoll = ctx.session.currentPoll || {};
  ctx.session.currentPoll.state = state;
  
  // Продовжуємо опитування (емоції)
  await sendEmotionQuestion(ctx);
}

// Відправка питання про емоцію
async function sendEmotionQuestion(ctx) {
  await ctx.reply(
    'Яку емоцію ти зараз відчуваєш найсильніше?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Радість', callback_data: 'emotion_joy' },
            { text: 'Гнів', callback_data: 'emotion_anger' }
          ],
          [
            { text: 'Спокій', callback_data: 'emotion_calm' },
            { text: 'Сум', callback_data: 'emotion_sadness' }
          ],
          [
            { text: 'Страх', callback_data: 'emotion_fear' },
            { text: 'Вдячність', callback_data: 'emotion_gratitude' }
          ],
          [{ text: '✍️ Інше', callback_data: 'emotion_custom' }]
        ]
      }
    }
  );
}

// Обробка відповіді про емоцію
async function handleEmotionResponse(ctx) {
  const emotion = ctx.match[1];
  
  if (emotion === 'custom') {
    await ctx.reply('Опиши свою емоцію своїми словами:');
    ctx.scene.register('customEmotion', customEmotionScene);
    return ctx.scene.enter('customEmotion');
  }
  
  // Зберігаємо емоцію в сесії
  ctx.session.currentPoll = ctx.session.currentPoll || {};
  ctx.session.currentPoll.emotion = emotion;
  
  // Продовжуємо опитування (почуття)
  await sendFeelingQuestion(ctx);
}

// Відправка питання про почуття
async function sendFeelingQuestion(ctx) {
  await ctx.reply(
    'А яке глибше почуття переважає в тобі сьогодні/зараз?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Любов', callback_data: 'feeling_love' },
            { text: 'Провина', callback_data: 'feeling_guilt' }
          ],
          [
            { text: 'Самотність', callback_data: 'feeling_loneliness' },
            { text: 'Прийняття', callback_data: 'feeling_acceptance' }
          ],
          [
            { text: 'Сором', callback_data: 'feeling_shame' },
            { text: 'Надія', callback_data: 'feeling_hope' }
          ],
          [{ text: '✍️ Напиши варіант', callback_data: 'feeling_custom' }]
        ]
      }
    }
  );
}

// Обробка відповіді про почуття
async function handleFeelingResponse(ctx) {
  const feeling = ctx.match[1];
  
  if (feeling === 'custom') {
    await ctx.reply('Опиши своє почуття своїми словами:');
    ctx.scene.register('customFeeling', customFeelingScene);
    return ctx.scene.enter('customFeeling');
  }
  
  // Зберігаємо почуття в сесії
  ctx.session.currentPoll = ctx.session.currentPoll || {};
  ctx.session.currentPoll.feeling = feeling;
  
  // Продовжуємо опитування (дія)
  await sendActionQuestion(ctx);
}

// Відправка питання про дію
async function sendActionQuestion(ctx) {
  await ctx.reply(
    'Що ти робив(ла) прямо перед тим, як відповідав(ла)?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Працював(ла)', callback_data: 'action_work' },
            { text: 'Їв(ла)', callback_data: 'action_eating' }
          ],
          [
            { text: 'Був(ла) в соцмережах', callback_data: 'action_social_media' },
            { text: 'Спілкувався(лась)', callback_data: 'action_communication' }
          ],
          [
            { text: 'Рухався(лась) / спорт', callback_data: 'action_exercise' },
            { text: 'Відпочивав(ла)', callback_data: 'action_rest' }
          ],
          [{ text: '✍️ Щось інше', callback_data: 'action_custom' }]
        ]
      }
    }
  );
}

// Обробка відповіді про дію
async function handleActionResponse(ctx) {
  const action = ctx.match[1];
  
  if (action === 'custom') {
    await ctx.reply('Опиши свою дію своїми словами:');
    ctx.scene.register('customAction', customActionScene);
    return ctx.scene.enter('customAction');
  }
  
  // Зберігаємо дію в сесії
  ctx.session.currentPoll = ctx.session.currentPoll || {};
  ctx.session.currentPoll.action = action;
  
  // Завершуємо опитування і зберігаємо дані
  await saveRecord(ctx);
}

// Збереження запису в базу даних
async function saveRecord(ctx) {
  const telegramId = ctx.from.id;
  
  try {
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('Помилка: користувача не знайдено.');
    }
    
    const record = new Record({
      userId: user._id,
      telegramId,
      state: ctx.session.currentPoll.state,
      emotion: ctx.session.currentPoll.emotion,
      feeling: ctx.session.currentPoll.feeling,
      action: ctx.session.currentPoll.action,
      custom: ctx.session.currentPoll.custom || {}
    });
    
    await record.save();
    
    // Очищаємо дані поточного опитування
    delete ctx.session.currentPoll;
    
    await ctx.reply(
      'Дякую! Ти зробив(ла) ще один крок до свідомого стану 🧘‍♀️\n' +
      'Твої відповіді збережено. Побачимось наступного разу!'
    );
  } catch (err) {
    console.error('Error saving record:', err);
    await ctx.reply('Вибачте, сталася помилка при збереженні даних. Спробуйте знову.');
  }
}

export {
  startPoll,
  handleStateResponse,
  handleEmotionResponse,
  handleFeelingResponse,
  handleActionResponse
};
