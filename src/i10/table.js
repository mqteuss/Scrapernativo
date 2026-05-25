import { compact, stripTags } from "./text.js";

export function extractTables(html = "") {
  const tables = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html))) {
    const tableHtml = tableMatch[1];
    const rows = [];
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHtml))) {
      const cells = [];
      const cellRegex = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
        const cell = compact(stripTags(cellMatch[1]));
        if (cell) cells.push(cell);
      }

      if (cells.length) rows.push(cells);
    }

    if (rows.length) tables.push(toObjects(rows));
  }

  return tables;
}

function toObjects(rows) {
  const [first, ...rest] = rows;
  const looksLikeHeader = first.every((cell) => !/^[-+]?\d/.test(cell)) && rest.length > 0;

  if (!looksLikeHeader) return { headers: [], rows, objects: [] };

  const headers = first.map((header, index) => header || `col_${index + 1}`);
  const objects = rest.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] ?? null;
    });
    return item;
  });

  return { headers, rows: rest, objects };
}
