// src/features/free5videos/config.js

export const FREE5_FUNNEL_KEY = 'free_video_5';

export const FREE5_STEPS = Object.freeze([
  {
    id: 1,
    code: 'video1',
    title: 'Алгоритм виходу з застою',
    videoUrl: 'https://your-tilda-or-youtube/video1', 
    question: 'Що зараз для тебе найболючіше в темі застою?',
    airtableQuestionField: 'Q1',
  },
  {
    id: 2,
    code: 'video2',
    title: 'Твоє справжнє “НАВІЩО”',
    videoUrl: 'https://your-tilda-or-youtube/video2',
    question: 'Чому саме зараз важливо вийти з цього стану?',
    airtableQuestionField: 'Q2',
  },
  {
    id: 3,
    code: 'video3',
    title: 'Внутрішній саботажник',
    videoUrl: 'https://your-tilda-or-youtube/video3',
    question: 'Які думки/страхи найбільше тебе зупиняють?',
    airtableQuestionField: 'Q3',
  },
  {
    id: 4,
    code: 'video4',
    title: 'Нова стратегія дій',
    videoUrl: 'https://your-tilda-or-youtube/video4',
    question: 'Що ти готова змінити в своїх діях найближчі 7 днів?',
    airtableQuestionField: 'Q4',
  },
  {
    id: 5,
    code: 'video5',
    title: 'Комітмент + AI-наставник',
    videoUrl: 'https://your-tilda-or-youtube/video5',
    question: 'Сформулюй одну фразу-комітмент: що ти береш із цих 5 відео?',
    airtableQuestionField: 'Q5',
  },
]);

export const FREE5_AT = Object.freeze({
  PROGRESS_TABLE: 'Free5_Progress',  
  RESPONSES_TABLE: 'Free5_Responses', 
});
