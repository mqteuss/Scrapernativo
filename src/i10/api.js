export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  res.end(JSON.stringify(payload, null, 2));
}

export function allowCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function getQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  return Object.fromEntries(url.searchParams.entries());
}

export function bool(value) {
  return ["1", "true", "sim", "yes"].includes(String(value).toLowerCase());
}

export function withError(handler) {
  return async function wrapped(req, res) {
    try {
      if (allowCors(req, res)) return;
      if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Método não permitido." });
      await handler(req, res);
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message,
        hint: "Confira type=acoes|fiis, ticker e se a página pública existe no Investidor10."
      });
    }
  };
}
