//src/utils/payload.js
export function parseStartPayload(raw = '') {
  const p = String(raw || '').trim();
  if (!p) return { source: null, segment: null, utm: null, raw: '' };

  // формат очікуємо: src_<source>__seg_<segment>[__utm:key1|key2|...]
  const parts = p.split('__');
  let source = null, segment = null, utm = null;

  for (const part of parts) {
    if (part.startsWith('src_')) source = part.slice(4);
    else if (part.startsWith('seg_')) segment = part.slice(4);
    else if (part.startsWith('utm:')) utm = part.slice(4);
  }
  return { source, segment, utm, raw: p };
}
