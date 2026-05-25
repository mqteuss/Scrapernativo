# Investidor10 Native Scraper

Scraper em Node.js para páginas públicas do Investidor10, sem Axios e sem Cheerio. Usa `fetch` nativo do Node 20+, parser textual próprio, extração de tabelas HTML, cache em memória, retry, timeout e endpoints serverless compatíveis com Vercel.

> Use com respeito: apenas páginas públicas, sem login, sem burlar paywall/PRO, com cache e limites de taxa.

## Endpoints

### Health
```txt
GET /api/health
```

### Listar ativos encontrados na listagem pública
```txt
GET /api/list?type=fiis
GET /api/list?type=acoes
```

### Raspar um ativo
```txt
GET /api/asset?type=fiis&ticker=MXRF11
GET /api/asset?type=acoes&ticker=PETR4
```

### Buscar ticker tentando ações e FIIs
```txt
GET /api/search?q=PETR4
GET /api/search?q=MXRF11
```

### Raspar vários ativos da listagem
```txt
GET /api/bulk?type=fiis&limit=10&concurrency=3
GET /api/bulk?type=acoes&limit=10&concurrency=3
```

Parâmetros úteis:

- `fresh=1`: ignora cache em memória.
- `limit`: limite do bulk. O código trava em até 80 por segurança.
- `concurrency`: concorrência do bulk. O código trava em até 5 por segurança.

## Rodar local

```bash
npm install
npx vercel dev
```

Teste também direto no Node:

```bash
node local-test.js fiis MXRF11
node local-test.js acoes PETR4
```

## Deploy na Vercel via GitHub

1. Suba esse projeto para um repositório no GitHub.
2. Na Vercel, clique em **Add New Project**.
3. Importe o repositório.
4. Framework Preset: **Other**.
5. Deploy.

## Variáveis de ambiente opcionais

```txt
SCRAPER_USER_AGENT=SeuApp/1.0 seu-email-ou-url
CACHE_TTL_MS=900000
CACHE_MAX_ITEMS=250
FETCH_TIMEOUT_MS=12000
FETCH_RETRIES=2
```

## Observações importantes

- A Vercel não oferece armazenamento persistente no filesystem serverless. O cache deste projeto é em memória e pode resetar a qualquer momento.
- Para histórico persistente, use um banco externo como Vercel KV, Upstash Redis, Supabase ou Neon.
- Se o HTML do Investidor10 mudar, ajuste `src/i10/extractors.js`.
- O scraper tenta extrair o máximo possível de forma genérica: título, descrição, métricas conhecidas, seções, tabelas, links de ativos relacionados, JSON-LD e amostra de texto bruto.
