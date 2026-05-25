import { scrapeAsset, listAssets } from "./src/i10/scraper.js";

const type = process.argv[2] || "fiis";
const ticker = process.argv[3] || "MXRF11";

console.log(`Listando ${type}...`);
const list = await listAssets({ type, fresh: true });
console.log(`Encontrados: ${list.length}`);
console.log(list.slice(0, 5));

console.log(`\nRaspando ${ticker}...`);
const asset = await scrapeAsset({ type, ticker, fresh: true });
console.log(JSON.stringify({
  ticker: asset.ticker,
  title: asset.title,
  metrics: asset.metrics,
  sections: Object.keys(asset.sections),
  tables: asset.tables.length
}, null, 2));
