// src/utils/callbackRouter.js
// Простий, гнучкий роутер для callback_query
// Підтримує string | [string] | RegExp | { prefix } | (payload, ctx)=>bool | handler-only
export default function createCallbackRouter(opts = {}) {
  const handlers = [];
  const options = {
    autoAnswer: !!opts.autoAnswer, // якщо true — автоматично answerCbQuery перед обробкою
  };

  // Нормалізуємо тест до функції (payload, ctx) => boolean
  const normalizeTest = (test) => {
    if (test == null) {
      return () => true;
    }
    if (typeof test === 'function') {
      return async (payload, ctx) => {
        try {
          const res = await test(payload, ctx);
          return !!res;
        } catch (e) {
          // якщо тест кинув — не матчуємо
          console.error('[callbackRouter] Test function threw:', e);
          return false;
        }
      };
    }
    if (typeof test === 'string') {
      return (payload) => payload === test;
    }
    if (Array.isArray(test)) {
      const set = new Set(test.map(String));
      return (payload) => set.has(String(payload));
    }
    if (test instanceof RegExp) {
      return (payload) => test.test(String(payload));
    }
    if (typeof test === 'object' && test !== null) {
      // Підтримка { prefix: '...' }
      if (test.prefix && typeof test.prefix === 'string') {
        return (payload) => String(payload).startsWith(test.prefix);
      }
      // Підтримка { equals: '...' }
      if (test.equals && typeof test.equals === 'string') {
        return (payload) => String(payload) === test.equals;
      }
      // Підтримка { predicate: fn }
      if (typeof test.predicate === 'function') {
        return async (payload, ctx) => {
          try {
            return !!(await test.predicate(payload, ctx));
          } catch (e) {
            console.error('[callbackRouter] predicate threw:', e);
            return false;
          }
        };
      }
    }

    throw new Error('Unsupported test type for callbackRouter');
  };

  // Реєстрація: register(test, handler) або register(handler) (тоді тест = always true)
  const register = (testOrHandler, maybeHandler) => {
    let test = testOrHandler;
    let handler = maybeHandler;

    // Якщо викликали register(handler)
    if (typeof testOrHandler === 'function' && maybeHandler == null) {
      handler = testOrHandler;
      test = null; // match all
    }

    if (typeof handler !== 'function') {
      throw new Error('callbackRouter.register: handler must be a function');
    }

    const testFn = normalizeTest(test);
    handlers.push({ testFn, handler });
  };

  // Обробити ctx: витягуємо payload і шукаємо перший handler, котрий поверне true
  const handle = async (ctx) => {
    const payload = ctx?.callbackQuery?.data ?? '';
    // Авто-answer якщо налаштовано (щоб прибрати спінер)
    if (options.autoAnswer) {
      try { if (ctx && ctx.answerCbQuery) await ctx.answerCbQuery().catch(() => {}); } catch {}
    }

    for (const entry of handlers) {
      const { testFn, handler } = entry;
      let matched = false;
      try {
        matched = await Promise.resolve(testFn(payload, ctx));
      } catch (e) {
        matched = false;
        console.error('[callbackRouter] testFn error:', e);
      }

      if (!matched) continue;

      try {
        // handler може повертати true/false або нічого
        const res = await Promise.resolve(handler(ctx, payload));
        // Якщо handler повернув true — вважаємо оброблено
        if (res === true) return true;
        // Якщо handler повернув false — продовжуємо пошук інших
        // Якщо handler нічого не повернув (undefined) — теж вважаємо, що оброблено
        if (typeof res === 'undefined') return true;
        // Якщо handler явно повернув щось інше — трактуємо як handled if truthy
        if (res) return true;
      } catch (err) {
        console.error('[callbackRouter] handler error:', err);
        // Якщо handler кине, ми вважаємо, що обробник спробував і не вдалось — повертаємо true, щоб не кидати далі.
        try { if (ctx && ctx.answerCbQuery) await ctx.answerCbQuery('Помилка').catch(() => {}); } catch {}
        return true;
      }
    }

    // Нічого не знайшли
    return false;
  };

  return {
    register,
    handle,
    _handlers: handlers, // для дебагу/тестів
  };
}
