import { bool, getQuery, sendJson, withError } from "../src/i10/api.js";
import { scrapeBulk } from "../src/i10/scraper.js";

export default withError(async (req, res) => {
  const q = getQuery(req);
  const data = await scrapeBulk({
    type: q.type || q.tipo || "fiis",
    limit: q.limit || 10,
    concurrency: q.concurrency || 3,
    fresh: bool(q.fresh)
  });

  sendJson(res, 200, {
    ok: true,
    count: data.length,
    success: data.filter((x) => x.ok).length,
    failed: data.filter((x) => !x.ok).length,
    data
  });
});
