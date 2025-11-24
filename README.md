# state-tracker-bot

# Telegram AI Mentor Bot

AI-коуч для щоденної рефлексії та особистого зростання в Telegram.

## 🚀 Швидкий старт

### 1. Налаштування середовища

```bash
# Клонування та встановлення залежностей
git clone <your-repo>
cd state-tracker-bot
npm install
```

### 2. Налаштування змінних оточення

Створіть файл `.env` з наступним вмістом:

```env
TELEGRAM_TELEGRAM_BOT_TOKEN=your_TELEGRAM_BOT_TOKEN_from_botfather
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id
PORT=3000
NODE_ENV=production
OPENAI_API_KEY=your_openai_key_optional
```

### 3. Отримання токенів

**Telegram Bot Token:**

1. Напишіть @BotFather в Telegram
2. Створіть новий бот командою `/newbot`
3. Скопіюйте отриманий токен

**Airtable API Key:**

1. Перейдіть на https://airtable.com/create/tokens
2. Створіть новий токен з правами на читання та запис
3. Скопіюйте Base ID з URL вашої бази

### 4. Запуск

```bash
# Розробка
npm run dev

# Продакшн
npm start
```

## 📊 Структура проекту

```
src/
├── config/
│   ├── database.js
│   └── constants.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
├── services/
│   ├── airtableService.js
│   ├── userService.js
│   ├── subscriptionService.js
│   ├── reflectionService.js
│   ├── aiAnalyticsService.js
│   ├── affirmationService.js
│   └── schedulerService.js
├── controllers/
│   ├── botController.js
│   ├── userController.js
│   ├── reflectionController.js
│   └── analyticsController.js
├── utils/
│   ├── keyboards.js
│   ├── messages.js
│   ├── dateHelpers.js
│   └── validators.js
├── handlers/
│   ├── registrationHandler.js
│   ├── subscriptionHandler.js
│   ├── reflectionHandler.js
│   └── commandHandler.js
└── cron/
    ├── morningReminders.js
    ├── eveningReminders.js
    ├── weeklyReports.js
    └── monthlyReports.js
├── package.json
├── .env
├── server.js
```

## 🎯 Функціональність

- ✅ Реєстрація користувачів з вибором плану підписки
- ✅ Щоденні ранкові питання (08:00)
- ✅ Щоденні вечірні питання (20:30)
- ✅ AI-аналіз відповідей користувача
- ✅ Щотижневі звіти (неділя 19:00)
- ✅ Щомісячні звіти (1-го числа 12:00)
- ✅ Швидкі афірмації (команда "+")
- ✅ Система меню та навігації
- ✅ Перевірка активності підписки

## 🗄️ Структура Airtable

Бот працює з готовими таблицями:

- **Users** - користувачі та їх підписки
- **Subscriptions** - деталі підписок
- **User Reflections** - рефлексії з AI аналізом
- **Morning_Responses** - ранкові відповіді
- **Evening_Responses** - вечірні відповіді
- **Affirmations** - база афірмацій

## 🤖 Приклад діалогу

### Реєстрація

```
User: /start
Bot: 🌟 Привіт, Анна! Вітаю в AI-Коучі особистого зростання!

💰 Що це таке?
Твій персональний помічник для щоденної рефлексії, досягнення цілей та внутрішньої трансформації.

🔥 Що ти отримаєш:
• Щоденні ранкові питання для фокусу (08:00)
• Вечірні питання для аналізу дня (20:30)
• AI-звіти щотижня та щомісяця
• Персональні афірмації та підтримку 24/7

Готова почати трансформацію?

Bot: 👋 Як тебе звати? (Введи своє ім'я)

User: Анна Коваленко

Bot: Приємно познайомитись, Анна Коваленко! 📱
Тепер введи свій номер телефону (наприклад: +380501234567):

User: +380671234567

Bot: 📧 Введи свій email адрес:

User: anna@example.com

Bot: 💰 ОБЕРІТЬ ПЛАН ПІДПИСКИ:
🔹 Тиждень фокусу — 7€
🔹 Місяць дії — 30€
🔹 Рік трансформації — 300€

[Кнопки вибору плану]

User: [Обирає "Місяць дії"]

Bot: ✅ ПІДТВЕРДЖЕННЯ РЕЄСТРАЦІЇ
👤 Ім'я: Анна Коваленко
📱 Телефон: +380671234567
📧 Email: anna@example.com
💳 План: Місяць дії (30€)

Все правильно?

User: [Підтвердити]

Bot: 🎉 ВІТАЄМО! РЕЄСТРАЦІЯ ЗАВЕРШЕНА!
✅ Твій план "Місяць дії" активовано!

🌅 Що далі:
• Завтра о 08:00 — отримаєш перші ранкові питання
• Завтра о 20:30 — вечірні питання для рефлексії

🚀 Твоя трансформація починається зараз!
```

### Ранкові питання

```
Bot: 🌅 ДОБРОГО РАНКУ!
Час для ранкової рефлексії. Готова почати? (6 питань, ~3 хвилини)

[🚀 Почати ранкові питання] [⏰ Нагадати через 15 хвилин]

User: [Почати ранкові питання]

Bot: 📝 Питання 1/6
**1. Хто я сьогодні?**
Опиши себе як нову версію — з позиції сили.
💡 Наприклад: я топ експерт, я власниця відомого бренду...

User: Я успішна бізнес-леді, яка впевнено досягає своїх цілей

Bot: ✅ Відповідь збережено!

📝 Питання 2/6
**2. Яка я?**
Дай відповідь про свої якості.

User: Сильна, рішуча, творча, відповідальна

Bot: ✅ Відповідь збережено!

[...продовжується до 6-го питання...]

Bot: ✅ РАНКОВІ ПИТАННЯ ЗАВЕРШЕНО!
🎯 Твій фокус на день встановлено!

🌀 Афірмація на день:
"Твоя енергія магнітом притягує те, що тобі потрібно."

🌟 Нехай цей день стане кроком до твоєї мети!
Увечері о 20:30 я нагадаю про вечірні питання.
```

### Вечірні питання

```
Bot: 🌙 ДОБРИЙ ВЕЧІР!
Час для вечірньої рефлексії. Готова до аналізу дня? (5 питань, ~3 хвилини)

[🌟 Почати вечірні питання] [⏰ Нагадати через 15 хвилин]

User: [Почати вечірні питання]

Bot: 📝 Питання 1/5
**1. Що мене сьогодні наповнило енергією?**
Люди, дії, ситуації, стани.

User: Успішна презентація, підтримка команди, вечірня прогулянка

[...питання 2-5...]

Bot: ✅ ВЕЧІРНІ ПИТАННЯ ЗАВЕРШЕНО!

🔍 AI-АНАЛІЗ ТВОГО ДНЯ:

🌟 Внутрішня сила: Ти продемонструвала справжню лідерську якість, виступаючи з презентацією. Твоя здатність цінувати підтримку команди показує зрілість та усвідомленість.

🔍 Важливі закономірності: Помітно, що тебе наповнюють професійні досягнення та підтримка оточення. Фізична активність також є важливим ресурсом.

💡 Точки росту: Звертай увагу на ситуації, де виникає сумнів — це сигнали для зміцнення впевненості.

⚡️ Практичні кроки:
• Завтра почни день з афірмації про свою експертність
• При стресі згадуй сьогоднішню успішну презентацію
• Збережи час для вечірньої прогулянки

🌀 Афірмація на вечір:
"Я стаю сильнішою з кожним усвідомленим вибором."

💤 Гарного відпочинку!
```

### Швидка афірмація

```
User: +

Bot: ✨ АФІРМАЦІЯ ДЛЯ ТЕБЕ
💫 "Довіра до себе — твоя найбільша суперсила."
🌟 Повтори це і відчуй внутрішню впевненість.

[🔄 Ще афірмація] [⬅️ Головне меню]
```

### Щотижневий звіт

```
Bot: 🌱 ТВІЙ ТИЖНЕВИЙ ЗВІТ

🔻 Витоки енергії:
Часто зливала енергію в: негативні новини, прокрастинація

🚧 Блокуючі програми:
"Я не встигну" з'являлось найчастіше

🌊 Наповнення:
Тебе надихало: спорт, творчість, спілкування з командою

🏆 Внутрішні перемоги:
Презентація проекту, вирішення конфлікту

🕳 Що варто відпустити:
Перфекціонізм, тривожність про майбутнє

💡 Що посилити:
Ранкові афірмації, фізичну активність

☀️ Наступний крок:
Обери планування дня з вечора
Дій із стану впевненості
```

### Меню

```
User: /menu

Bot: 🏠 ГОЛОВНЕ МЕНЮ
Оберіть дію:

[🌅 Ранкові питання] [🌙 Вечірні питання]
[📊 Мій статус] [📈 Звіти]
[✨ Афірмація] [💬 Підтримка]

User: [📊 Мій статус]

Bot: 👤 МІЙ ПРОФІЛЬ
🏷️ Ім'я: Анна Коваленко
📅 Дата реєстрації: 15.08.2025
💳 Поточний план: Місяць дії
📊 Статус підписки: ✅ Активна до 15.09.2025 (30 днів)

🔄 Останні дії:
• Ранкові питання: Сьогодні
• Вечірні питання: Сьогодні

📈 Статистика:
• Днів активності: 12
• Завершених опитувань: 24
```

## 🔧 Налаштування на Render.com

1. Створіть новий Web Service на Render
2. Підключіть GitHub репозиторій
3. Встановіть змінні оточення в розділі Environment
4. Build Command: `npm install`
5. Start Command: `npm start`

## 📞 Підтримка

Email: nadyastarway@gmail.com

## 🔄 Оновлення

Бот автоматично оновлюється при push в main гілку репозиторію.

==========================================

# State Tracker Bot 🤖

AI-powered Telegram bot for daily reflection, personal transformation, and goal tracking. The bot
helps users build consistent habits through morning and evening reflections, provides AI-powered
insights, and supports subscription-based access.

## Features ✨

- **Daily Reflections**: Morning (6 questions) and evening (5 questions) guided reflections
- **AI Analytics**: Weekly and monthly AI-powered reports using OpenAI
- **Subscription Management**: Multiple subscription plans with WayForPay integration
- **Automated Scheduling**: Cron-based reminders and report generation
- **Progress Tracking**: Detailed statistics and streak tracking
- **Affirmations**: Daily motivational affirmations
- **Multi-language Support**: Ukrainian language interface

## Quick Start 🚀

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd state-tracker-bot
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```bash
# Required
BOT_TOKEN=your_telegram_bot_token
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id

# Optional but recommended
OPENAI_API_KEY=your_openai_api_key
ADMIN_CHAT_ID=your_telegram_user_id
```

### 3. Airtable Setup

Create an Airtable base with these tables:

#### Users Table

- `User_Name` (Single line text)
- `TG_id` (Single line text)
- `Email` (Email)
- `Phone` (Phone number)
- `User_Registered` (Checkbox)
- `DateUser_Registered` (Date)
- `Status` (Single select: New User, Active User, Inactive User)
- `Active_Subscription_Status` (Single select: Empty, Active, Expired, Cancelled)
- `Active_Subscription_Plan` (Single line text)
- `Start_Date` (Date)
- `End_Date` (Date)
- `Active_Subscription_Status` (Single line text)
- `Question_Type` (Single select: Morning, Evening)
- `Current_Activity` (Single line text)
- `Time_Zone` (Single line text)

#### Morning_Responses Table

- `Reminder_Key Morning` (Single line text)
- `user_id` (Single line text)
- `user_name` (Single line text)
- `date` (Date)
- `question_1` (Long text)
- `question_2` (Long text)
- `question_3` (Long text)
- `question_4` (Long text)
- `question_5` (Long text)
- `question_6` (Long text)

#### Evening_Responses Table

- `Reminder_Key Evening` (Single line text)
- `user_id` (Single line text)
- `user_name` (Single line text)
- `date` (Date)
- `question_1` (Long text)
- `question_2` (Long text)
- `question_3` (Long text)
- `question_4` (Long text)
- `question_5` (Long text)

#### Subscriptions Table

- `TG_id` (Single line text)
- `UserName` (Single line text)
- `User_Email` (Email)
- `UserPhone` (Phone number)
- `Plan_Name` (Single line text)
- `Order_Reference` (Single line text)
- `Payment_Status` (Single select: Pending, Approved, Declined)
- `Status` (Single select: Pending, Active, Expired, Cancelled)
- `Plan_Type` (Single select: week, month, year)
- `Start_Date` (Date)
- `End_Date` (Date)
- `Amount` (Currency)
- `Currency` (Single line text)
- `Created_Date` (Date)
- `Is_Active` (Single select: ✅ Активна, ❌ Неактивна)

#### Affirmations Table

- `Affirmation` (Long text)
- `Category` (Single select: Особистий розвиток, Бізнес-зріст, Ясність цілей, Впевненість, Інше)
- `Used` (Checkbox)

### 4. Run the Bot

```bash
# Development
npm run dev

# Production
npm start
```

## Project Structure 📁

```
state-tracker-bot/
├── src/
│   ├── config/
│   │   ├── constants.js      # App constants and configurations
│   │   ├── database.js       # Airtable configuration
│   │   └── airtable.js       # Airtable base instance
│   ├── cron/
│   │   ├── morningReminders.js
│   │   ├── eveningReminders.js
│   │   ├── weeklyReports.js
│   │   └── monthlyReports.js
│   ├── handlers/
│   │   ├── commandHandler.js     # Command handlers
│   │   ├── registrationHandler.js # User registration
│   │   ├── subscriptionHandler.js # Subscription management
│   │   └── reflectionHandler.js   # Reflection flow
│   ├── services/
│   │   ├── userService.js        # User CRUD operations
│   │   ├── reflectionService.js  # Reflection management
│   │   ├── affirmationService.js # Affirmations
│   │   ├── aiAnalyticsService.js # AI-powered analytics
│   │   ├── subscriptionService.js# Subscription logic
│   │   └── paymentService.js     # Payment webhooks
│   └── utils/
│       ├── keyboards.js          # Telegram keyboards
│       ├── messages.js           # Message templates
│       ├── scheduler.js          # Cron job initialization
│       └── dateHelpers.js        # Date utilities
├── server.js                     # Main application file
├── package.json
├── .env.example
└── README.md
```

## Key Features Explained 🔍

### Daily Reflections

- **Morning Questions (08:00)**: Focus on identity, goals, and daily intentions
- **Evening Questions (22:15)**: Analyze energy, programs, and victories
- Responses are saved to Airtable with full tracking

### Subscription System

- **Week Focus (7€)**: 7-day access for testing
- **Month Action (30€)**: Full month access
- **Year Transformation (300€)**: Annual plan with savings
- Integration with WayForPay for secure payments

### AI Analytics

- Weekly reports analyzing patterns in responses
- Monthly deep-dive reports with personalized recommendations
- Uses OpenAI GPT-4 for intelligent insights

### Automated Scheduling

- Morning reminders at 08:00 (Europe/Kiev timezone)
- Evening reminders at 22:15
- Weekly reports on Sundays at 19:00
- Monthly reports on 1st day of month at 12:00

## Configuration Options ⚙️

### Time_Zones

Default timezone is `Europe/Kiev`. You can modify this in:

- Environment variable: `DEFAULT_TIMEZONE`
- Individual user timezone in Airtable

### Message Customization

Edit messages in `src/utils/messages.js`:

- Welcome messages
- Question prompts
- Error messages
- Success confirmations

### Question Customization

Modify questions in `src/services/reflectionService.js`:

- `MORNING_QUESTIONS` array
- `EVENING_QUESTIONS` array

## Deployment 🌐

### Development

```bash
npm run dev
```

Uses polling for Telegram updates.

### Production

1. Set up webhooks:

```bash
NODE_ENV=production
WEBHOOK_URL=https://yourdomain.com
```

2. Deploy to your server:

```bash
npm start
```

### Heroku Deployment

```bash
# Set environment variables
heroku config:set BOT_TOKEN=your_token
heroku config:set AIRTABLE_API_KEY=your_key
# ... other variables

# Deploy
git push heroku main
```

## API Endpoints 🌐

### Webhook Endpoints

- `POST /webhook/payment` - WayForPay payment notifications
- `POST /bot{BOT_TOKEN}` - Telegram webhook (production only)

### Health Check

- `GET /health` - Service health status

## Troubleshooting 🔧

### Common Issues

**Bot doesn't respond**

- Check `BOT_TOKEN` in `.env`
- Verify bot is not already running elsewhere
- Check network connectivity

**Database errors**

- Verify `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID`
- Ensure table structure matches requirements
- Check field names (case-sensitive)

**Scheduler not working**

- Verify timezone settings
- Check cron expressions
- Ensure server runs continuously

**Payment issues**

- Configure WayForPay credentials
- Set up webhook endpoint
- Test with WayForPay sandbox

### Logs

Monitor logs for errors:

```bash
# Show recent logs
npm start 2>&1 | tee app.log

# Monitor in real-time
tail -f app.log
```

## Contributing 🤝

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support 📞

For technical support:

- Create GitHub issues for bugs
- Check documentation first
- Provide error logs when reporting issues

## License 📜

MIT License - see LICENSE file for details.

---

**Note**: This bot handles personal data and payments. Ensure compliance with GDPR, local data
protection laws, and payment regulations in your jurisdiction.
