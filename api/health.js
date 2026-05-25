import { sendJson, withError } from "../src/i10/api.js";

export default withError(async (_req, res) => {
  sendJson(res, 200, {
    ok: true,
    service: "investidor10-native-scraper",
    node: process.version,
    time: new Date().toISOString()
  });
});
