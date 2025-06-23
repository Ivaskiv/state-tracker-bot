//controllers/themeController.js
// In your themeController.js file:
import { Scenes } from 'telegraf';
import Theme from '../models/Theme.js';

// createThemeScene з універсальними кроками
export const createThemeScene = new Scenes.WizardScene(
  'createTheme',
  // Крок 1: Отримання назви теми
  async (ctx) => {
    await ctx.reply('Введіть назву нової теми:');
    ctx.wizard.state.theme = { steps: [] };
    return ctx.wizard.next();
  },
  // Крок 2: Налаштування кількості кроків
  async (ctx) => {
    ctx.wizard.state.theme.name = ctx.message.text;
    await ctx.reply('Скільки кроків буде в опитуванні? (1-10)');
    return ctx.wizard.next();
  },
  // Крок 3: Налаштування кроків
  async (ctx) => {
    const stepsCount = parseInt(ctx.message.text);
    
    if (isNaN(stepsCount) || stepsCount < 1 || stepsCount > 10) {
      await ctx.reply('Будь ласка, введіть число від 1 до 10.');
      return;
    }
    
    ctx.wizard.state.stepsCount = stepsCount;
    ctx.wizard.state.currentStepIndex = 0;
    ctx.wizard.state.theme.steps = [];
    
    await ctx.reply(`Налаштування кроку 1/${stepsCount}`);
    await ctx.reply('Введіть ключове слово для цього кроку (латиницею, наприклад: state, mood, energy):');
    
    return ctx.wizard.next();
  },
  // Крок 4: Отримання ключа кроку
  async (ctx) => {
    const stepIndex = ctx.wizard.state.currentStepIndex;
    const key = ctx.message.text.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (!/^[a-z0-9_]+$/.test(key)) {
      await ctx.reply('Ключ повинен містити лише латинські літери, цифри та знак підкреслення.');
      return;
    }
    
    // Перевіряємо унікальність ключа
    if (ctx.wizard.state.theme.steps.some(step => step.key === key)) {
      await ctx.reply('Цей ключ вже використовується. Введіть інший ключ.');
      return;
    }
    
    ctx.wizard.state.currentStepKey = key;
    await ctx.reply('Введіть назву кроку для адміністратора (наприклад: Стан, Настрій, Енергія):');
    
    return ctx.wizard.next();
  },
  // Крок 5: Отримання назви кроку
  async (ctx) => {
    const title = ctx.message.text.trim();
    ctx.wizard.state.currentStepTitle = title;
    
    await ctx.reply('Введіть питання для користувача (наприклад: Як ви почуваєтеся зараз?):');
    
    return ctx.wizard.next();
  },
  // Крок 6: Отримання питання
  async (ctx) => {
    const question = ctx.message.text.trim();
    
    ctx.wizard.state.theme.steps.push({
      key: ctx.wizard.state.currentStepKey,
      title: ctx.wizard.state.currentStepTitle,
      question: question,
      order: ctx.wizard.state.currentStepIndex,
      options: []
    });
    
    await ctx.reply('Тепер налаштуємо варіанти відповідей для цього кроку.');
    await ctx.reply('Скільки варіантів відповідей ви хочете додати? (2-10)');
    
    return ctx.wizard.next();
  },
  // Крок 7: Налаштування кількості варіантів відповідей
  async (ctx) => {
    const optionsCount = parseInt(ctx.message.text);
    
    if (isNaN(optionsCount) || optionsCount < 2 || optionsCount > 10) {
      await ctx.reply('Будь ласка, введіть число від 2 до 10.');
      return;
    }
    
    ctx.wizard.state.optionsCount = optionsCount;
    ctx.wizard.state.currentOptionIndex = 0;
    
    await ctx.reply(`Налаштування варіанту відповіді 1/${optionsCount}`);
    await ctx.reply('Введіть текст варіанту відповіді (те, що побачить користувач):');
    
    return ctx.wizard.next();
  },
  // Крок 8: Отримання тексту варіанту відповіді
  async (ctx) => {
    const text = ctx.message.text.trim();
    ctx.wizard.state.currentOptionText = text;
    
    await ctx.reply('Введіть значення для callback_data (латиницею, наприклад: good, normal, bad):');
    
    return ctx.wizard.next();
  },
  // Крок 9: Отримання callback_data
  async (ctx) => {
    const callbackData = ctx.message.text.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (!/^[a-z0-9_]+$/.test(callbackData)) {
      await ctx.reply('callback_data повинен містити лише латинські літери, цифри та знак підкреслення.');
      return;
    }
    
    const stepIndex = ctx.wizard.state.currentStepIndex;
    const step = ctx.wizard.state.theme.steps[stepIndex];
    
    // Додаємо варіант відповіді
    step.options.push({
      text: ctx.wizard.state.currentOptionText,
      callback_data: callbackData
    });
    
    ctx.wizard.state.currentOptionIndex++;
    
    // Якщо це був останній варіант відповіді
    if (ctx.wizard.state.currentOptionIndex >= ctx.wizard.state.optionsCount) {
      ctx.wizard.state.currentStepIndex++;
      
      // Якщо це був останній крок
      if (ctx.wizard.state.currentStepIndex >= ctx.wizard.state.stepsCount) {
        await ctx.reply('Всі кроки налаштовано. Зберігаю тему...');
        
        try {
          // Створюємо нову тему
          const newTheme = new Theme({
            name: ctx.wizard.state.theme.name,
            steps: ctx.wizard.state.theme.steps,
            active: (await Theme.countDocuments({})) === 0, // Перша тема активна за замовчуванням
            messages: {
              welcome: 'Ласкаво просимо!',
              mainMenu: 'Головне меню:',
              reportDaily: 'Ваш щоденний звіт:',
              reportWeekly: 'Ваш тижневий звіт:'
            },
            keyboard: {
              mainMenu: [
                [{ text: "Почати реєстрацію", callback_data: "start_registration" }],
                [{ text: "Переглянути налаштування", callback_data: "view_settings" }],
                [{ text: "Допомога", callback_data: "help" }],
                [{ text: "Очистити чат", callback_data: "clear_chat" }],
                [{ text: "📊 Переглянути звіт", callback_data: "view_report" }],
                [{ text: "📝 Почати опитування", callback_data: "poll" }]
              ]
            }
          });
          
          await newTheme.save();
          await ctx.reply(`✅ Тему "${ctx.wizard.state.theme.name}" успішно створено!`);
          
          return ctx.scene.leave();
        } catch (error) {
          console.error('Помилка при збереженні теми:', error);
          await ctx.reply('❌ Виникла помилка при збереженні теми.');
          return ctx.scene.leave();
        }
      } else {
        // Переходимо до налаштування наступного кроку
        await ctx.reply(`Налаштування кроку ${ctx.wizard.state.currentStepIndex + 1}/${ctx.wizard.state.stepsCount}`);
        await ctx.reply('Введіть ключове слово для цього кроку (латиницею, наприклад: state, mood, energy):');
        return ctx.wizard.selectStep(3); // Повертаємося до кроку отримання ключа
      }
    } else {
      // Налаштовуємо наступний варіант відповіді
      await ctx.reply(`Налаштування варіанту відповіді ${ctx.wizard.state.currentOptionIndex + 1}/${ctx.wizard.state.optionsCount}`);
      await ctx.reply('Введіть текст варіанту відповіді (те, що побачить користувач):');
      return ctx.wizard.selectStep(7); // Повертаємося до кроку отримання тексту варіанту
    }
  }
);

export const editThemeScene = new Scenes.WizardScene(
  'editTheme',
  // Step 1: Select theme to edit
  async (ctx) => {
    const themes = await Theme.find({});
    
    if (!themes.length) {
      await ctx.reply('❌ Немає створених тем. Спочатку створіть нову тему.');
      return ctx.scene.leave();
    }
    
    const buttons = themes.map(theme => {
      return [{ text: `${theme.name} ${theme.active ? '(активна)' : ''}`, callback_data: `edit_theme_${theme._id}` }];
    });
    
    buttons.push([{ text: '➕ Створити нову тему', callback_data: 'create_new_theme' }]);
    buttons.push([{ text: '⬅️ Назад', callback_data: 'back_to_admin' }]);
    
    await ctx.reply('Оберіть тему для редагування:', {
      reply_markup: {
        inline_keyboard: buttons
      }
    });
    
    return ctx.wizard.next();
  },
  // Step 2: Select what to edit
  async (ctx) => {
    if (!ctx.callbackQuery) {
      await ctx.reply('Оберіть варіант з меню, будь ласка.');
      return;
    }
    
    await ctx.answerCbQuery();
    
    if (ctx.callbackQuery.data === 'create_new_theme') {
      return ctx.scene.enter('createTheme');
    }
    
    if (ctx.callbackQuery.data === 'back_to_admin') {
      await ctx.reply('Повернення до адмін-панелі...');
      ctx.scene.leave();
      return ctx.command('admin');
    }
    
    const themeId = ctx.callbackQuery.data.replace('edit_theme_', '');
    ctx.wizard.state.themeId = themeId;
    
    const theme = await Theme.findById(themeId);
    if (!theme) {
      await ctx.reply('❌ Тему не знайдено. Спробуйте ще раз.');
      return ctx.scene.leave();
    }
    
    await ctx.reply(`Редагування теми "${theme.name}":`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Змінити назву', callback_data: 'edit_name' }],
          [{ text: '❓ Змінити питання', callback_data: 'edit_questions' }],
          [{ text: '🔘 Змінити варіанти відповідей', callback_data: 'edit_options' }],
          [{ text: '✅ Зробити активною', callback_data: 'set_active' }],
          [{ text: '🗑️ Видалити тему', callback_data: 'delete_theme' }],
          [{ text: '⬅️ Назад', callback_data: 'back_to_themes' }]
        ]
      }
    });
    
    return ctx.wizard.next();
  },
  // Step 3: Handle edit choice
  async (ctx) => {
    if (!ctx.callbackQuery) {
      await ctx.reply('Оберіть варіант з меню, будь ласка.');
      return;
    }
    
    await ctx.answerCbQuery();
    const action = ctx.callbackQuery.data;
    
    if (action === 'back_to_themes') {
      // Return to theme selection
      ctx.wizard.selectStep(0);
      return ctx.wizard.steps[0](ctx);
    }
    
    if (action === 'set_active') {
      try {
        // Deactivate all themes
        await Theme.updateMany({}, { active: false });
        // Activate selected theme
        await Theme.findByIdAndUpdate(ctx.wizard.state.themeId, { active: true });
        await ctx.reply('✅ Тему успішно активовано!');
        
        // Return to theme edit menu
        ctx.wizard.selectStep(1);
        return ctx.wizard.steps[1](ctx);
      } catch (error) {
        console.error('Error activating theme:', error);
        await ctx.reply('❌ Виникла помилка при активації теми.');
        return ctx.scene.leave();
      }
    }
    
    if (action === 'delete_theme') {
      await ctx.reply('⚠️ Ви впевнені, що хочете видалити цю тему? Цю дію неможливо скасувати.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Так, видалити', callback_data: 'confirm_delete' }],
            [{ text: '❌ Ні, скасувати', callback_data: 'cancel_delete' }]
          ]
        }
      });
      return ctx.wizard.next();
    }
    
    // Handle other edit options
    if (action === 'edit_name') {
      ctx.wizard.state.editType = 'name';
      await ctx.reply('Введіть нову назву теми:');
      return ctx.wizard.next();
    }
    
    if (action === 'edit_questions') {
      await ctx.reply('Оберіть питання для редагування:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '1️⃣ Питання про стан', callback_data: 'edit_q_state' }],
            [{ text: '2️⃣ Питання про емоцію', callback_data: 'edit_q_emotion' }],
            [{ text: '3️⃣ Питання про почуття', callback_data: 'edit_q_feeling' }],
            [{ text: '4️⃣ Питання про дію', callback_data: 'edit_q_action' }],
            [{ text: '⬅️ Назад', callback_data: 'back_to_edit' }]
          ]
        }
      });
      return ctx.wizard.next();
    }
    
    if (action === 'edit_options') {
      return ctx.scene.enter('configureOptions', { themeId: ctx.wizard.state.themeId });
    }
  },
  // Step 4: Handle theme deletion confirmation or get new name
  async (ctx) => {
    // Handle deletion confirmation
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      
      if (ctx.callbackQuery.data === 'confirm_delete') {
        try {
          const theme = await Theme.findById(ctx.wizard.state.themeId);
          const isActive = theme.active;
          
          await Theme.findByIdAndDelete(ctx.wizard.state.themeId);
          await ctx.reply('✅ Тему успішно видалено!');
          
          // If deleted theme was active, set another theme as active
          if (isActive) {
            const anotherTheme = await Theme.findOne({});
            if (anotherTheme) {
              await Theme.findByIdAndUpdate(anotherTheme._id, { active: true });
              await ctx.reply(`Тему "${anotherTheme.name}" встановлено як активну.`);
            }
          }
          
          // Return to theme selection
          ctx.wizard.selectStep(0);
          return ctx.wizard.steps[0](ctx);
        } catch (error) {
          console.error('Error deleting theme:', error);
          await ctx.reply('❌ Виникла помилка при видаленні теми.');
          return ctx.scene.leave();
        }
      } else if (ctx.callbackQuery.data === 'cancel_delete') {
        await ctx.reply('Видалення скасовано.');
        
        // Return to theme edit menu
        ctx.wizard.selectStep(1);
        return ctx.wizard.steps[1](ctx);
      } else if (ctx.callbackQuery.data === 'back_to_edit') {
        // Return to edit options
        ctx.wizard.selectStep(1);
        return ctx.wizard.steps[1](ctx);
      } else if (ctx.callbackQuery.data.startsWith('edit_q_')) {
        const questionType = ctx.callbackQuery.data.replace('edit_q_', '');
        ctx.wizard.state.questionType = questionType;
        
        const theme = await Theme.findById(ctx.wizard.state.themeId);
        const currentQuestion = theme.messages[`${questionType}Question`] || 'Не встановлено';
        
        await ctx.reply(`Поточне питання: "${currentQuestion}"\n\nВведіть нове питання:`);
        return ctx.wizard.next();
      }
    }
    
    // Handle name edit
    if (ctx.wizard.state.editType === 'name') {
      const newName = ctx.message.text;
      
      try {
        await Theme.findByIdAndUpdate(ctx.wizard.state.themeId, { name: newName });
        await ctx.reply(`✅ Назву теми змінено на "${newName}"!`);
        
        // Return to theme edit menu
        ctx.wizard.selectStep(1);
        return ctx.wizard.steps[1](ctx);
      } catch (error) {
        console.error('Error updating theme name:', error);
        await ctx.reply('❌ Виникла помилка при оновленні назви теми.');
        return ctx.scene.leave();
      }
    }
  },
  // Step 5: Handle question editing
  async (ctx) => {
    const newQuestion = ctx.message.text;
    const questionKey = `messages.${ctx.wizard.state.questionType}Question`;
    
    try {
      const updateObj = {};
      updateObj[questionKey] = newQuestion;
      
      await Theme.findByIdAndUpdate(ctx.wizard.state.themeId, updateObj);
      await ctx.reply(`✅ Питання успішно оновлено!`);
      
      // Return to questions edit menu
      await ctx.reply('Оберіть питання для редагування:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '1️⃣ Питання про стан', callback_data: 'edit_q_state' }],
            [{ text: '2️⃣ Питання про емоцію', callback_data: 'edit_q_emotion' }],
            [{ text: '3️⃣ Питання про почуття', callback_data: 'edit_q_feeling' }],
            [{ text: '4️⃣ Питання про дію', callback_data: 'edit_q_action' }],
            [{ text: '⬅️ Назад', callback_data: 'back_to_edit' }]
          ]
        }
      });
      
      return ctx.wizard.selectStep(3);
    } catch (error) {
      console.error('Error updating question:', error);
      await ctx.reply('❌ Виникла помилка при оновленні питання.');
      return ctx.scene.leave();
    }
  }
);