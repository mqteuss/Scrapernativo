import { ASSET_TYPES, BASE_URL, DEFAULT_TTL_MS } from "./config.js";
import { fetchHtml } from "./http.js";
import { normalizeTicker } from "./text.js";
import { parseAssetPage, parseListPage } from "./extractors.js";

export function normalizeType(type = "") {
  const value = String(type).toLowerCase().trim();
  if (["acao", "acoes", "ações", "stock", "stocks"].includes(value)) return "acoes";
  if (["fii", "fiis", "fundo", "fundos"].includes(value)) return "fiis";
  throw new Error("Tipo inválido. Use type=acoes ou type=fiis.");
}

export function assetUrl(type, ticker) {
  const normalizedType = normalizeType(type);
  const cfg = ASSET_TYPES[normalizedType];
  const normalizedTicker = normalizeTicker(ticker).toLowerCase();
  if (!normalizedTicker) throw new Error("Ticker vazio.");
  return `${BASE_URL}/${cfg.path}/${normalizedTicker}/`;
}

export async function scrapeAsset({ type, ticker, fresh = false, ttlMs = DEFAULT_TTL_MS } = {}) {
  const normalizedType = normalizeType(type);
  const normalizedTicker = normalizeTicker(ticker);
  const url = assetUrl(normalizedType, normalizedTicker);

  const response = await fetchHtml(url, { ttlMs, fresh });
  return parseAssetPage({
    html: response.html,
    url: response.url,
    type: normalizedType,
    ticker: normalizedTicker
  });
}

export async function listAssets({ type, fresh = false, ttlMs = DEFAULT_TTL_MS } = {}) {
  const normalizedType = normalizeType(type);
  const cfg = ASSET_TYPES[normalizedType];
  const url = `${BASE_URL}${cfg.listPath}`;
  const response = await fetchHtml(url, { ttlMs, fresh });
  return parseListPage({ html: response.html, type: normalizedType });
}

export async function scrapeBulk({ type, limit = 10, concurrency = 3, fresh = false } = {}) {
  const assets = await listAssets({ type, fresh });
  const chosen = assets.slice(0, Math.max(1, Math.min(Number(limit) || 10, 80)));
  const poolSize = Math.max(1, Math.min(Number(concurrency) || 3, 5));
  const results = [];
  let index = 0;

  async function worker() {
    while (index < chosen.length) {
      const current = chosen[index++];
      try {
        const data = await scrapeAsset({ type: current.type, ticker: current.ticker, fresh });
        results.push({ ok: true, item: current, data });
      } catch (error) {
        results.push({ ok: false, item: current, error: error.message });
      }
    }
  }

  await Promise.all(Array.from({ length: poolSize }, worker));
  return results.sort((a, b) => chosen.findIndex((x) => x.ticker === a.item.ticker) - chosen.findIndex((x) => x.ticker === b.item.ticker));
}
