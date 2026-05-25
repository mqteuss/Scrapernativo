const store = new Map();
const MAX_ITEMS = Number(process.env.CACHE_MAX_ITEMS || 250);

export function getCache(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  hit.lastAccess = Date.now();
  return hit.value;
}

export function setCache(key, value, ttlMs) {
  if (store.size >= MAX_ITEMS) pruneCache();
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    lastAccess: Date.now()
  });
}

export function clearCache() {
  store.clear();
}

function pruneCache() {
  const ordered = [...store.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
  const removeCount = Math.ceil(MAX_ITEMS * 0.2);
  for (const [key] of ordered.slice(0, removeCount)) store.delete(key);
}
