// src/services/cabinetService.js

import airtable from '../config/airtableClient.js';
import { logger } from '../utils/logger.js';

class CabinetService {
  
  /**
   * Отримати повний дашборд користувача
   */
  async getDashboard({ tg_id, email }) {
    try {
      logger.info('[Cabinet Service] Getting dashboard', { tg_id, email });

      // 1. Знайти користувача
      const user = await this.findUser({ tg_id, email });
      
      if (!user) {
        throw new Error('Користувача не знайдено');
      }

      // 2. Паралельно отримати всі дані
      const [courses, gamification, progress, tasks] = await Promise.all([
        this.getUserCourses(user.id),
        this.getGamification(user.id),
        this.getProgress(user.id),
        this.getTasks(user.id)
      ]);

      return {
        user: {
          name: user.Name,
          email: user.Email,
          avatar: user.Avatar || 'https://via.placeholder.com/80',
          level: user.Level || 1,
          xp: user.XP || 0,
          created_at: user.Created
        },
        courses,
        gamification,
        progress,
        tasks
      };

    } catch (error) {
      logger.error('[Cabinet Service] Dashboard error', { error: error.message });
      throw error;
    }
  }

  /**
   * Знайти користувача
   */
  async findUser({ tg_id, email }) {
    try {
      const filter = tg_id 
        ? `{TG_ID} = '${tg_id}'`
        : `{Email} = '${email}'`;

      const records = await airtable('Users')
        .select({
          filterByFormula: filter,
          maxRecords: 1
        })
        .firstPage();

      if (records.length === 0) {
        return null;
      }

      return {
        id: records[0].id,
        ...records[0].fields
      };

    } catch (error) {
      logger.error('[Cabinet Service] Find user error', { error: error.message });
      throw error;
    }
  }

  /**
   * Отримати курси користувача
   */
  async getUserCourses(userId) {
    try {
      const enrollments = await airtable('Enrollments')
        .select({
          filterByFormula: `{User} = '${userId}'`,
          sort: [{ field: 'Start_Date', direction: 'desc' }]
        })
        .all();

      const courses = [];

      for (const enrollment of enrollments) {
        const courseId = enrollment.fields.Course?.[0];
        
        if (!courseId) continue;

        try {
          const course = await airtable('Courses').find(courseId);

          courses.push({
            id: course.id,
            name: course.fields.Course_Name,
            description: course.fields.Description,
            status: enrollment.fields.Status,
            progress: enrollment.fields.Progress || 0,
            start_date: enrollment.fields.Start_Date,
            end_date: enrollment.fields.End_Date,
            tariff: enrollment.fields.Tariff,
            is_active: enrollment.fields.Status === 'Active',
            is_completed: enrollment.fields.Progress === 100
          });
        } catch (err) {
          logger.warn('[Cabinet Service] Course not found', { courseId });
          continue;
        }
      }

      return courses;

    } catch (error) {
      logger.error('[Cabinet Service] Get courses error', { error: error.message });
      throw error;
    }
  }

  /**
   * Отримати геймифікацію
   */
  async getGamification(userId) {
    try {
      const user = await airtable('Users').find(userId);
      
      const level = user.fields.Level || 1;
      const xp = user.fields.XP || 0;
      const xpToNext = this.calculateXPToNextLevel(level);

      return {
        level,
        xp,
        xp_to_next_level: xpToNext,
        progress_percent: Math.floor((xp / xpToNext) * 100),
        badges: user.fields.Badges || [],
        streak: user.fields.Streak || 0,
        total_points: user.fields.Total_Points || 0,
        achievements: user.fields.Achievements || []
      };

    } catch (error) {
      logger.error('[Cabinet Service] Get gamification error', { error: error.message });
      throw error;
    }
  }

  /**
   * Отримати прогрес
   */
  async getProgress(userId) {
    try {
      const user = await airtable('Users').find(userId);

      return {
        total_sessions: user.fields.Total_Sessions || 0,
        completed_lessons: user.fields.Completed_Lessons || 0,
        active_days: user.fields.Active_Days || 0,
        streak: user.fields.Streak || 0,
        last_activity: user.fields.Last_Activity,
        wheel_balance: user.fields.Wheel_Balance || {}
      };

    } catch (error) {
      logger.error('[Cabinet Service] Get progress error', { error: error.message });
      throw error;
    }
  }

  /**
   * Отримати завдання
   */
  async getTasks(userId) {
    try {
      const tasks = await airtable('Tasks')
        .select({
          filterByFormula: `{User} = '${userId}'`,
          sort: [{ field: 'Created', direction: 'desc' }],
          maxRecords: 10
        })
        .all();

      return tasks.map(task => ({
        id: task.id,
        title: task.fields.Title,
        description: task.fields.Description,
        status: task.fields.Status,
        due_date: task.fields.Due_Date,
        priority: task.fields.Priority || 'medium',
        completed: task.fields.Status === 'Completed',
        course: task.fields.Course
      }));

    } catch (error) {
      logger.error('[Cabinet Service] Get tasks error', { error: error.message });
      // Повертаємо пустий масив якщо немає таблиці Tasks
      return [];
    }
  }

  /**
   * Розрахувати XP до наступного рівня
   */
  calculateXPToNextLevel(level) {
    return level * 100; // Формула: рівень × 100
  }
}

export default new CabinetService();