import { DEFAULT_HEADERS, DEFAULT_RETRIES, DEFAULT_TIMEOUT_MS } from "./config.js";
import { getCache, setCache } from "./cache.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchHtml(url, options = {}) {
  const {
    ttlMs = 0,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    headers = {},
    fresh = false
  } = options;

  const cacheKey = `html:${url}`;
  if (!fresh && ttlMs > 0) {
    const cached = getCache(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { ...DEFAULT_HEADERS, ...headers },
        redirect: "follow",
        signal: controller.signal
      });

      const text = await response.text();
      clearTimeout(timeout);

      if (!response.ok) {
        const retryable = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
        if (retryable && attempt < retries) {
          await sleep(350 * (attempt + 1) ** 2);
          continue;
        }
        throw new Error(`HTTP ${response.status} ao buscar ${url}`);
      }

      const result = {
        url: response.url || url,
        status: response.status,
        html: text,
        fetchedAt: new Date().toISOString(),
        cached: false
      };

      if (ttlMs > 0) setCache(cacheKey, result, ttlMs);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < retries) {
        await sleep(350 * (attempt + 1) ** 2);
        continue;
      }
    }
  }

  throw lastError;
}
