// src/utils/cache.js

const DEFAULT_TTL = 300000; // 5 хвилин
const cache = new Map();

const set = (key, value, ttl = DEFAULT_TTL) => {
  cache.set(key, {
    value,
    expires: Date.now() + ttl,
  });
};

const get = (key) => {
  const item = cache.get(key);
  
  if (!item) return null;
  
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
};

const has = (key) => {
  const item = cache.get(key);
  if (!item) return false;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return false;
  }
  return true;
};

const del = (key) => {
  return cache.delete(key);
};

const clear = () => {
  cache.clear();
};

const size = () => {
  return cache.size;
};

const getAll = () => {
  const result = {};
  for (const [key, item] of cache.entries()) {
    if (Date.now() > item.expires) {
      cache.delete(key);
    } else {
      result[key] = item.value;
    }
  }
  return result;
};

export { set, get, has, del, clear, size, getAll };