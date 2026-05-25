const ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…"
};

export function decodeEntities(value = "") {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (_, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    }
    return ENTITY_MAP[entity] ?? _;
  });
}

export function stripTags(html = "") {
  return decodeEntities(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|li|ul|ol|tr|td|th|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " "));
}

export function compact(value = "") {
  return decodeEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s+([,.;:%)])/g, "$1")
    .replace(/([(])\s+/g, "$1")
    .trim();
}

export function htmlToLines(html = "") {
  return stripTags(html)
    .split(/\n+/)
    .map(compact)
    .map((line) => line.replace(/^[-•]\s*/, ""))
    .filter(Boolean)
    .filter((line) => !/^imagem?:?$/i.test(line))
    .filter((line) => !/^image:?$/i.test(line));
}

export function normalizeKey(key = "") {
  return compact(key)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9%/+. -]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeTicker(ticker = "") {
  return String(ticker).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}
