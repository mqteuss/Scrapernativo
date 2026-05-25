import { bool, getQuery, sendJson, withError } from "../src/i10/api.js";
import { listAssets } from "../src/i10/scraper.js";

export default withError(async (req, res) => {
  const q = getQuery(req);
  const data = await listAssets({ type: q.type || q.tipo || "fiis", fresh: bool(q.fresh) });
  sendJson(res, 200, { ok: true, count: data.length, data });
});
