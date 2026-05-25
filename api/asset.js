import { bool, getQuery, sendJson, withError } from "../src/i10/api.js";
import { scrapeAsset } from "../src/i10/scraper.js";

export default withError(async (req, res) => {
  const q = getQuery(req);
  const data = await scrapeAsset({
    type: q.type || q.tipo || "fiis",
    ticker: q.ticker || q.codigo,
    fresh: bool(q.fresh)
  });

  sendJson(res, 200, { ok: true, data });
});
