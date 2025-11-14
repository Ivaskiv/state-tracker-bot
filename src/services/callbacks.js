// // Універсальний роутер callback-ів

// const _routes = [];

// // exact: 'start_morning'
// export const on = (key, handler) => {
//   _routes.push({ type: 'exact', key, handler });
// };

// // prefix: 'ob_tz_'
// export const onPrefix = (prefix, handler) => {
//   _routes.push({ type: 'prefix', key: prefix, handler });
// };

// // regex: /^wheel_score_\d+$/
// export const onRegex = (regex, handler) => {
//   _routes.push({ type: 'regex', key: regex, handler });
// };

// export const clear = () => { _routes.length = 0; };

// export const handle = async (ctx) => {
//   const data = String(ctx.update?.callback_query?.data || '');
//   if (!data) return false;

//   for (const r of _routes) {
//     let matched = false;
//     if (r.type === 'exact' && data === r.key) matched = true;
//     if (r.type === 'prefix' && data.startsWith(r.key)) matched = true;
//     if (r.type === 'regex' && r.key.test(data)) matched = true;

//     if (matched) {
//       try {
//         await r.handler(ctx, data);
//         try { await ctx.answerCbQuery(); } catch {}
//         return true;
//       } catch (e) {
//         try { await ctx.answerCbQuery('Помилка'); } catch {}
//         return false;
//       }
//     }
//   }
//   return false;
// };

// export default { on, onPrefix, onRegex, clear, handle };
