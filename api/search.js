import { bool, getQuery, sendJson, withError } from "../src/i10/api.js";
import { listAssets, scrapeAsset } from "../src/i10/scraper.js";
import { normalizeTicker } from "../src/i10/text.js";

export default withError(async (req, res) => {
  const q = getQuery(req);
  const ticker = normalizeTicker(q.q || q.ticker || "");
  const fresh = bool(q.fresh);

  if (ticker) {
    const attempts = [];
    for (const type of ["acoes", "fiis"]) {
      try {
        const data = await scrapeAsset({ type, ticker, fresh });
        attempts.push({ ok: true, type, data });
      } catch (error) {
        attempts.push({ ok: false, type, error: error.message });
      }
    }
    return sendJson(res, 200, { ok: true, query: ticker, data: attempts.filter((x) => x.ok), attempts });
  }

  const [acoes, fiis] = await Promise.all([
    listAssets({ type: "acoes", fresh }),
    listAssets({ type: "fiis", fresh })
  ]);

  sendJson(res, 200, { ok: true, data: { acoes, fiis } });
});
