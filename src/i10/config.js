export const BASE_URL = "https://investidor10.com.br";

export const ASSET_TYPES = {
  acoes: {
    name: "Ações",
    path: "acoes",
    listPath: "/acoes/",
    tickerPattern: /^[A-Z]{4}\d{1,2}F?$/
  },
  fiis: {
    name: "FIIs",
    path: "fiis",
    listPath: "/fiis/",
    tickerPattern: /^[A-Z]{4}11B?$/
  }
};

export const DEFAULT_TTL_MS = Number(process.env.CACHE_TTL_MS || 1000 * 60 * 15);
export const DEFAULT_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 12000);
export const DEFAULT_RETRIES = Number(process.env.FETCH_RETRIES || 2);

export const DEFAULT_HEADERS = {
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "cache-control": "no-cache",
  "user-agent": process.env.SCRAPER_USER_AGENT ||
    "Investidor10NativeScraper/1.0 (+https://vercel.com; contato: configure-SCRAPER_USER_AGENT)"
};
