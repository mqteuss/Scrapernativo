import { absoluteUrl, compact, decodeEntities, htmlToLines, normalizeKey, normalizeTicker, stripTags } from "./text.js";
import { BASE_URL, ASSET_TYPES } from "./config.js";
import { extractTables } from "./table.js";

const COMMON_LABELS = [
  "Cotação", "DY (12M)", "Dividend Yield", "Dividend Yield médio", "DY médio em 5 anos", "P/VP", "P/L",
  "Liquidez Diária", "Variação (12M)", "Valor Patrimonial", "Val. Patrimonial p/ Cota",
  "Patrimônio Líquido", "Valor de mercado", "Valor de firma", "Nº total de papeis", "Ativos", "Ativo Circulante",
  "Dívida Bruta", "Dívida Líquida", "Receita Líquida", "Lucro Líquido", "EBIT", "EBITDA", "ROE", "ROIC", "ROA",
  "Payout", "Margem Líquida", "Margem Bruta", "Margem Ebit", "Margem Ebtida", "EV/Ebitda", "EV/Ebit",
  "P/Ebitda", "P/Ebit", "P/Ativo", "P/Cap.Giro", "P/Ativo Circ. Liq.", "VPA", "LPA", "Giro Ativos",
  "Dívida Líquida / Patrimônio", "Dívida Líquida / Ebitda", "Dívida Líquida / Ebit", "Dívida Bruta / Patrimônio",
  "Patrimônio / Ativos", "Passivos / Ativos", "Liquidez Corrente", "CAGR Receitas 5 anos", "CAGR Lucros 5 anos",
  "Razão Social", "CNPJ", "Público-alvo", "Mandato", "Segmento", "Tipo de Fundo", "Prazo de duração", "Tipo de gestão",
  "Taxa de administração", "Vacância", "Número de cotistas", "Numero de cotistas", "Cotas emitidas", "Último rendimento",
  "Nome da Empresa", "Ano de estreia na bolsa", "Número de funcionários", "Ano de fundação"
];

const SECTION_MARKERS = [
  "INDICADORES FUNDAMENTALISTAS",
  "HISTÓRICO DE INDICADORES FUNDAMENTALISTAS",
  "INFORMAÇÕES SOBRE",
  "DADOS SOBRE A EMPRESA",
  "INFORMAÇÕES SOBRE A EMPRESA",
  "DIVIDENDOS",
  "Distribuições nos últimos 12 meses",
  "Rentabilidade",
  "Checklist"
];

export function parseAssetPage({ html, url, type, ticker }) {
  const lines = htmlToLines(html);
  const upperTicker = normalizeTicker(ticker);
  const title = extractTitle(html);
  const description = extractMeta(html, "description");

  const asset = {
    ticker: upperTicker,
    type,
    sourceUrl: url,
    title,
    description,
    scrapedAt: new Date().toISOString(),
    summary: extractSummary(lines, upperTicker),
    metrics: extractKnownMetrics(lines, upperTicker),
    sections: extractSections(lines),
    tables: extractTables(html),
    links: extractAssetLinks(html),
    structuredData: extractJsonLd(html),
    rawTextSample: lines.slice(0, 250)
  };

  asset.normalized = normalizeMetrics(asset.metrics);
  return asset;
}

export function parseListPage({ html, type }) {
  const cfg = ASSET_TYPES[type];
  if (!cfg) throw new Error(`Tipo inválido: ${type}`);

  const linkRegex = new RegExp(`<a\\b[^>]*href=["']([^"']*/${cfg.path}/([a-zA-Z0-9-]+)/?[^"']*)["'][^>]*>([\\s\\S]*?)<\\/a>`, "gi");
  const found = new Map();
  let match;

  while ((match = linkRegex.exec(html))) {
    const href = match[1];
    const slug = normalizeTicker(match[2]);
    const anchorText = compact(stripTags(match[3]));
    if (!cfg.tickerPattern.test(slug)) continue;

    found.set(slug, {
      ticker: slug,
      type,
      name: cleanAssetName(anchorText, slug),
      url: absoluteUrl(href, BASE_URL)
    });
  }

  return [...found.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? compact(stripTags(match[1])) : null;
}

function extractMeta(html, name) {
  const byName = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
  const byProp = new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
  const match = html.match(byName) || html.match(byProp);
  return match ? decodeEntities(match[1]) : null;
}

function extractJsonLd(html) {
  const out = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    try {
      out.push(JSON.parse(decodeEntities(match[1]).trim()));
    } catch {
      out.push({ parseError: true, raw: compact(match[1]).slice(0, 1000) });
    }
  }
  return out;
}

function extractAssetLinks(html) {
  const links = [];
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const href = absoluteUrl(match[1], BASE_URL);
    const text = compact(stripTags(match[2]));
    if (!href || !text) continue;
    if (/investidor10\.com\.br\/(acoes|fiis)\//i.test(href)) links.push({ text, href });
  }
  return links.slice(0, 200);
}

function extractSummary(lines, ticker) {
  const idx = lines.findIndex((line) => line.toUpperCase().includes(ticker));
  if (idx === -1) return [];
  return lines.slice(idx, idx + 30);
}

function extractKnownMetrics(lines, ticker) {
  const metrics = {};
  const labels = [...COMMON_LABELS, `${ticker} Cotação`, `${ticker} DY (12M)`, `${ticker} pagou o total de`];

  for (const label of labels) {
    const value = valueAfterLabel(lines, label);
    if (value !== null) metrics[label] = value;
  }

  const fromSentences = extractInlineMetrics(lines);
  return { ...metrics, ...fromSentences };
}

function valueAfterLabel(lines, label) {
  const wanted = normalizeKey(label);
  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const current = normalizeKey(original);
    const isMatch = current === wanted || current.endsWith(` ${wanted}`) || current.includes(wanted);
    if (!isMatch) continue;

    const inline = valueInline(original, label);
    if (inline) return inline;

    for (let j = i + 1; j < Math.min(lines.length, i + 7); j++) {
      const candidate = lines[j];
      const n = normalizeKey(candidate);
      if (!candidate || SECTION_MARKERS.some((marker) => n.includes(normalizeKey(marker)))) continue;
      if (COMMON_LABELS.some((known) => n === normalizeKey(known))) continue;
      return candidate;
    }
  }
  return null;
}

function valueInline(line, label) {
  const normalizedLine = normalizeKey(line);
  const normalizedLabel = normalizeKey(label);
  const idx = normalizedLine.indexOf(normalizedLabel);
  if (idx === -1) return null;

  const rawAfter = line.slice(Math.min(line.length, label.length + Math.max(0, idx))).replace(/^\s*[:：-]\s*/, "");
  const directNumber = rawAfter.match(/(R\$\s*)?[-+]?\d[\d.]*,?\d*\s*(%|Bilhões|Milhões|Mil|Trilhão|Trilhões)?/i);
  if (directNumber) return compact(directNumber[0]);

  const colon = line.match(/[:：]\s*(.+)$/);
  if (colon && colon[1] && !normalizeKey(colon[1]).includes(normalizedLabel)) return compact(colon[1]);
  return null;
}

function extractInlineMetrics(lines) {
  const metrics = {};
  for (const line of lines) {
    const pl = line.match(/P\/L de\s*([^,.;]+)/i);
    const pvp = line.match(/P\/VP de\s*([^,.;]+)/i);
    const dy = line.match(/dividend\s*y(?:ield|eld)[^\d]*(\d+[,.]\d+%)/i);
    if (pl) metrics["P/L mencionado no texto"] = compact(pl[1]);
    if (pvp) metrics["P/VP mencionado no texto"] = compact(pvp[1]);
    if (dy) metrics["Dividend Yield mencionado no texto"] = compact(dy[1]);
  }
  return metrics;
}

function extractSections(lines) {
  const sections = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = SECTION_MARKERS.some((marker) => normalizeKey(line).includes(normalizeKey(marker)));
    if (!isHeading) continue;

    const title = line;
    const end = findNextSection(lines, i + 1);
    const slice = lines.slice(i + 1, end).filter(Boolean);
    sections[title] = sectionToKeyValues(slice);
  }

  return sections;
}

function findNextSection(lines, start) {
  for (let i = start; i < lines.length; i++) {
    const line = normalizeKey(lines[i]);
    if (SECTION_MARKERS.some((marker) => line.includes(normalizeKey(marker)))) return i;
  }
  return Math.min(lines.length, start + 180);
}

function sectionToKeyValues(lines) {
  const obj = { text: lines.slice(0, 160), values: {} };

  for (let i = 0; i < lines.length - 1; i++) {
    const key = lines[i];
    const value = lines[i + 1];
    const keyNorm = normalizeKey(key);

    if (key.length > 60) continue;
    if (/^[-+]?R?\$?\s*\d/.test(key)) continue;
    if (!value || value.length > 90) continue;
    if (SECTION_MARKERS.some((marker) => keyNorm.includes(normalizeKey(marker)))) continue;

    const isLikelyLabel = COMMON_LABELS.some((label) => keyNorm === normalizeKey(label) || keyNorm.includes(normalizeKey(label)));
    const nextLooksLikeValue = /^[-+]?R?\$?\s*\d|^\d|%$|Bilhões|Milhões|Geral|Ativa|Híbrido|Fundo|Indeterminado|S\.A\.|LTDA/i.test(value);

    if (isLikelyLabel || nextLooksLikeValue) obj.values[key] = value;
  }

  return obj;
}

function normalizeMetrics(metrics) {
  const out = {};
  for (const [key, value] of Object.entries(metrics)) {
    out[toCamelKey(key)] = {
      label: key,
      raw: value,
      number: parseBrazilianNumber(value)
    };
  }
  return out;
}

function toCamelKey(value) {
  return normalizeKey(value)
    .replace(/[%/+.]/g, " ")
    .replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "") || "metric";
}

function parseBrazilianNumber(value = "") {
  const raw = String(value);
  const match = raw.match(/[-+]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[-+]?\d+(?:,\d+)?/);
  if (!match) return null;

  let number = Number(match[0].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(number)) return null;

  if (/trilh/i.test(raw)) number *= 1_000_000_000_000;
  else if (/bilh/i.test(raw)) number *= 1_000_000_000;
  else if (/milh/i.test(raw)) number *= 1_000_000;
  else if (/\bmil\b/i.test(raw)) number *= 1_000;

  return number;
}

function cleanAssetName(text, ticker) {
  const cleaned = compact(text.replace(new RegExp(`^${ticker}\\s*`, "i"), ""));
  return cleaned && cleaned !== ticker ? cleaned : null;
}
