const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  lastJson: null,
  lastUrl: null,
  currentView: "visual"
};

const output = $("#output");
const requestTitle = $("#requestTitle");
const meta = $("#meta");
const visualView = $("#visualView");
const jsonView = $("#jsonView");

function setLoading(isLoading) {
  $$('button').forEach((button) => {
    if (!button.classList.contains('tab') && !button.classList.contains('view-tab')) {
      button.disabled = isLoading;
    }
  });
}

function endpoint(path) {
  return path.startsWith('/api') ? path : `/api/${path.replace(/^\/+/, '')}`;
}

function paramsFromForm(form) {
  const data = new FormData(form);
  const params = new URLSearchParams();

  for (const [key, value] of data.entries()) {
    if (value === 'on') {
      params.set(key, '1');
    } else if (String(value).trim() !== '') {
      params.set(key, String(value).trim());
    }
  }

  return params;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeText(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function prettyKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()
    .replace(/^./, (chr) => chr.toUpperCase());
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isPrimitive(value) {
  return value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value);
}

function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return safeText(value);
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(value);
}

function renderMeta(url, ms, status) {
  meta.innerHTML = `
    <span>Endpoint: ${escapeHtml(url)}</span>
    <span>Tempo: ${ms}ms</span>
    <span>Status: ${escapeHtml(status)}</span>
  `;
}

function setView(view) {
  state.currentView = view;

  $$('.view-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });

  visualView.classList.toggle('hidden', view !== 'visual');
  jsonView.classList.toggle('hidden', view !== 'json');
}

function card(title, subtitle, bodyHtml) {
  return `
    <section class="section-card">
      <div class="section-title">
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}
        </div>
      </div>
      <div class="section-body">${bodyHtml}</div>
    </section>
  `;
}

function kpiGrid(items) {
  const valid = items.filter((item) => item && item.value !== undefined && item.value !== null && item.value !== '');

  if (!valid.length) {
    return '<div class="empty-state">Nenhum dado nesta seção.</div>';
  }

  return `
    <div class="kpi-grid">
      ${valid.map(({ label, value }) => `
        <div class="kpi">
          <small>${escapeHtml(label)}</small>
          ${isUrl(value)
            ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`
            : `<strong>${escapeHtml(safeText(value))}</strong>`}
        </div>
      `).join('')}
    </div>
  `;
}

function renderTableFromObjects(objects) {
  if (!Array.isArray(objects) || !objects.length) return '';

  const headers = [...objects.reduce((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set())];

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(prettyKey(header))}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${objects.map((row) => `
            <tr>
              ${headers.map((header) => `<td>${renderCell(row?.[header])}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderRowsTable(rows, headers = []) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const normalizedRows = rows.map((row) => Array.isArray(row) ? row : [row]);
  const maxCols = Math.max(...normalizedRows.map((row) => row.length));
  const finalHeaders = headers.length ? headers : Array.from({ length: maxCols }, (_, index) => `Coluna ${index + 1}`);

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${finalHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${normalizedRows.map((row) => `
            <tr>
              ${finalHeaders.map((_, index) => `<td>${renderCell(row[index] ?? '')}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCell(value) {
  if (isUrl(value)) {
    return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`;
  }

  if (typeof value === 'number') return escapeHtml(formatNumber(value));
  if (isPrimitive(value)) return escapeHtml(safeText(value));

  return `<pre class="raw-object">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function renderList(items, limit = Infinity) {
  if (!Array.isArray(items) || !items.length) return '<div class="empty-state">Nenhum item encontrado.</div>';

  return `
    <div class="list-box">
      ${items.slice(0, limit).map((item) => `<div class="line-item">${renderCell(item)}</div>`).join('')}
    </div>
  `;
}

function renderLinks(links) {
  if (!Array.isArray(links) || !links.length) return '<div class="empty-state">Nenhum link coletado.</div>';

  return `
    <div class="link-list">
      ${links.map((link) => {
        const href = link?.href || link?.url || link;
        const text = link?.text || link?.ticker || href;
        return `
          <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
            <strong>${escapeHtml(text)}</strong>
            <span>${escapeHtml(href)}</span>
          </a>
        `;
      }).join('')}
    </div>
  `;
}

function renderMetrics(metrics) {
  if (!isPlainObject(metrics) || !Object.keys(metrics).length) {
    return '<div class="empty-state">Nenhuma métrica coletada.</div>';
  }

  return kpiGrid(Object.entries(metrics).map(([label, value]) => ({ label, value })));
}

function renderNormalized(normalized) {
  if (!isPlainObject(normalized) || !Object.keys(normalized).length) {
    return '<div class="empty-state">Nenhum indicador normalizado coletado.</div>';
  }

  const rows = Object.entries(normalized).map(([key, item]) => ({
    chave: key,
    indicador: item?.label ?? key,
    valorBruto: item?.raw ?? null,
    numero: item?.number ?? null
  }));

  return renderTableFromObjects(rows);
}

function renderSections(sections) {
  if (!isPlainObject(sections) || !Object.keys(sections).length) {
    return '<div class="empty-state">Nenhuma seção coletada.</div>';
  }

  return `<div class="details-grid">
    ${Object.entries(sections).map(([title, section]) => {
      const valuesHtml = isPlainObject(section?.values) && Object.keys(section.values).length
        ? renderTableFromObjects(Object.entries(section.values).map(([label, value]) => ({ campo: label, valor: value })))
        : '<div class="empty-state">Sem pares chave/valor detectados nesta seção.</div>';

      const textHtml = Array.isArray(section?.text) && section.text.length
        ? renderList(section.text)
        : '<div class="empty-state">Sem texto bruto nesta seção.</div>';

      return `
        <details open>
          <summary>${escapeHtml(title)}</summary>
          <div class="details-content">
            <h4>Valores detectados</h4>
            ${valuesHtml}
            <br />
            <h4>Texto da seção</h4>
            ${textHtml}
          </div>
        </details>
      `;
    }).join('')}
  </div>`;
}

function renderScrapedTables(tables) {
  if (!Array.isArray(tables) || !tables.length) {
    return '<div class="empty-state">Nenhuma tabela HTML coletada.</div>';
  }

  return `<div class="details-grid">
    ${tables.map((table, index) => {
      const hasObjects = Array.isArray(table?.objects) && table.objects.length;
      const tableHtml = hasObjects
        ? renderTableFromObjects(table.objects)
        : renderRowsTable(table?.rows || [], table?.headers || []);

      return `
        <details open>
          <summary>Tabela ${index + 1} · ${hasObjects ? table.objects.length : table?.rows?.length || 0} linhas</summary>
          <div class="details-content">${tableHtml || '<div class="empty-state">Tabela vazia.</div>'}</div>
        </details>
      `;
    }).join('')}
  </div>`;
}

function renderStructuredData(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<div class="empty-state">Nenhum JSON-LD coletado.</div>';
  }

  return `<div class="details-grid">
    ${items.map((item, index) => `
      <details>
        <summary>JSON-LD ${index + 1}</summary>
        <div class="details-content">
          ${renderRecursive(item, `structuredData.${index}`)}
        </div>
      </details>
    `).join('')}
  </div>`;
}

function renderAsset(data, options = {}) {
  if (!isPlainObject(data)) {
    return renderRecursive(data, options.path || 'data');
  }

  const overview = kpiGrid([
    { label: 'Ticker', value: data.ticker },
    { label: 'Tipo', value: data.type },
    { label: 'Título', value: data.title },
    { label: 'Descrição', value: data.description },
    { label: 'Fonte', value: data.sourceUrl || data.url },
    { label: 'Coletado em', value: data.scrapedAt }
  ]);

  const knownKeys = new Set([
    'ticker', 'type', 'sourceUrl', 'url', 'title', 'description', 'scrapedAt',
    'summary', 'metrics', 'normalized', 'sections', 'tables', 'links', 'structuredData', 'rawTextSample'
  ]);

  const extra = Object.fromEntries(Object.entries(data).filter(([key]) => !knownKeys.has(key)));

  return `
    ${card('Visão geral', 'Dados básicos do ativo', overview)}
    ${card('Métricas coletadas', 'Valores brutos extraídos por rótulo/texto', renderMetrics(data.metrics))}
    ${card('Indicadores normalizados', 'Versão parseada com número quando possível', renderNormalized(data.normalized))}
    ${card('Resumo da página', 'Linhas próximas ao ticker detectado', renderList(data.summary))}
    ${card('Seções da página', 'Blocos como indicadores, dividendos e informações do ativo', renderSections(data.sections))}
    ${card('Tabelas HTML', 'Todas as tabelas capturadas do HTML público', renderScrapedTables(data.tables))}
    ${card('Links relacionados', 'Links de ações/FIIs encontrados na página', renderLinks(data.links))}
    ${card('Dados estruturados JSON-LD', 'Scripts application/ld+json encontrados', renderStructuredData(data.structuredData))}
    ${card('Amostra de texto bruto', 'Primeiras linhas normalizadas do HTML', renderList(data.rawTextSample))}
    ${Object.keys(extra).length ? card('Campos extras', 'Fallback para campos não previstos no frontend', renderRecursive(extra, 'extras')) : ''}
  `;
}

function renderListResponse(data) {
  const items = Array.isArray(data?.data) ? data.data : [];

  if (!items.length) return renderRecursive(data, 'response');

  const assetsHtml = `
    <div class="asset-grid">
      ${items.map((item) => {
        const href = item.url || '#';
        const content = `
          <strong>${escapeHtml(item.ticker || item.name || 'Sem ticker')}</strong>
          ${item.name ? `<small>${escapeHtml(item.name)}</small>` : ''}
          ${item.type ? `<span>${escapeHtml(item.type)}</span>` : ''}
          ${item.url ? `<span>${escapeHtml(item.url)}</span>` : ''}
        `;

        return item.url
          ? `<a class="asset-card" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${content}</a>`
          : `<div class="asset-card">${content}</div>`;
      }).join('')}
    </div>
  `;

  return `
    ${card('Resumo da listagem', 'Quantidade e status retornados pela API', kpiGrid([
      { label: 'OK', value: data.ok },
      { label: 'Quantidade', value: data.count ?? items.length }
    ]))}
    ${card('Ativos encontrados', 'Tickers e URLs coletados da página de listagem', assetsHtml)}
    ${card('Tabela da listagem', 'Mesmos dados em formato de tabela', renderTableFromObjects(items))}
  `;
}

function renderBulkResponse(data) {
  const items = Array.isArray(data?.data) ? data.data : [];

  if (!items.length) return renderRecursive(data, 'response');

  return `
    ${card('Resumo do bulk', 'Resultado geral da raspagem em lote', kpiGrid([
      { label: 'OK', value: data.ok },
      { label: 'Total', value: data.count ?? items.length },
      { label: 'Sucesso', value: data.success },
      { label: 'Falhas', value: data.failed }
    ]))}
    ${card('Resultados por ativo', 'Cada item abaixo monta todas as informações coletadas individualmente', `
      <div class="details-grid">
        ${items.map((entry, index) => {
          const ticker = entry?.item?.ticker || entry?.data?.ticker || `Item ${index + 1}`;
          const statusClass = entry?.ok ? 'ok' : 'fail';
          return `
            <div class="bulk-item">
              <div class="bulk-head">
                <h3>${escapeHtml(ticker)}</h3>
                <span class="badge ${statusClass}">${entry?.ok ? 'Sucesso' : 'Falha'}</span>
              </div>

              ${entry?.error ? `<div class="line-item">Erro: ${escapeHtml(entry.error)}</div>` : ''}

              <details ${index === 0 ? 'open' : ''}>
                <summary>Dados do ativo</summary>
                <div class="details-content">
                  ${entry?.data ? renderAsset(entry.data, { path: `bulk.${index}.data` }) : renderRecursive(entry, `bulk.${index}`)}
                </div>
              </details>
            </div>
          `;
        }).join('')}
      </div>
    `)}
  `;
}

function renderSearchResponse(data) {
  const results = Array.isArray(data?.data) ? data.data : [];
  const attempts = Array.isArray(data?.attempts) ? data.attempts : [];

  return `
    ${card('Resumo da busca', 'Tentativas em ações e FIIs', kpiGrid([
      { label: 'OK', value: data?.ok },
      { label: 'Consulta', value: data?.query },
      { label: 'Resultados', value: results.length },
      { label: 'Tentativas', value: attempts.length }
    ]))}
    ${attempts.length ? card('Tentativas', 'Status de cada tipo testado', renderTableFromObjects(attempts.map((attempt) => ({
      tipo: attempt.type,
      ok: attempt.ok,
      erro: attempt.error || '',
      ticker: attempt.data?.ticker || ''
    })))) : ''}
    ${results.length ? card('Resultados encontrados', 'Todas as informações coletadas por resultado', `
      <div class="details-grid">
        ${results.map((result, index) => `
          <details open>
            <summary>${escapeHtml(result.type || `Resultado ${index + 1}`)} · ${escapeHtml(result.data?.ticker || '')}</summary>
            <div class="details-content">${renderAsset(result.data, { path: `search.${index}.data` })}</div>
          </details>
        `).join('')}
      </div>
    `) : card('Resultados encontrados', 'Nenhum ativo encontrado', '<div class="empty-state">Nenhum resultado válido retornado.</div>')}
  `;
}

function renderRecursive(value, path = 'root') {
  if (isPrimitive(value)) {
    return `<div class="line-item">${renderCell(value)}</div>`;
  }

  if (Array.isArray(value)) {
    if (!value.length) return '<div class="empty-state">Array vazio.</div>';

    if (value.every(isPrimitive)) return renderList(value);
    if (value.every(isPlainObject)) return renderTableFromObjects(value);

    return `<div class="details-grid">
      ${value.map((item, index) => `
        <details>
          <summary>${escapeHtml(`${path}[${index}]`)}</summary>
          <div class="details-content">${renderRecursive(item, `${path}.${index}`)}</div>
        </details>
      `).join('')}
    </div>`;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (!entries.length) return '<div class="empty-state">Objeto vazio.</div>';

    const primitiveEntries = entries.filter(([, item]) => isPrimitive(item));
    const complexEntries = entries.filter(([, item]) => !isPrimitive(item));

    return `
      ${primitiveEntries.length ? kpiGrid(primitiveEntries.map(([label, item]) => ({ label: prettyKey(label), value: item }))) : ''}
      ${complexEntries.length ? `<div class="details-grid">
        ${complexEntries.map(([key, item]) => `
          <details>
            <summary>${escapeHtml(prettyKey(key))}</summary>
            <div class="details-content">${renderRecursive(item, `${path}.${key}`)}</div>
          </details>
        `).join('')}
      </div>` : ''}
    `;
  }

  return `<pre class="raw-object">${escapeHtml(safeText(value))}</pre>`;
}

function detectResponseKind(response) {
  if (Array.isArray(response?.data)) {
    if (response.data.some((item) => isPlainObject(item) && 'item' in item)) return 'bulk';
    if (response.data.some((item) => isPlainObject(item) && 'type' in item && 'data' in item)) return 'search';
    return 'list';
  }

  if (isPlainObject(response?.data) && ('ticker' in response.data || 'metrics' in response.data || 'rawTextSample' in response.data)) {
    return 'asset';
  }

  if (Array.isArray(response?.attempts)) return 'search';
  return 'generic';
}

function renderResponse(data) {
  const kind = detectResponseKind(data);

  if (kind === 'asset') return renderAsset(data.data);
  if (kind === 'list') return renderListResponse(data);
  if (kind === 'bulk') return renderBulkResponse(data);
  if (kind === 'search') return renderSearchResponse(data);

  return card('Resposta completa', 'Fallback universal para qualquer formato retornado', renderRecursive(data, 'response'));
}

async function request(url, label = url) {
  const fullUrl = endpoint(url);
  const started = performance.now();

  setLoading(true);
  requestTitle.textContent = label;
  output.textContent = 'Carregando...';
  visualView.innerHTML = '<div class="empty-state">Carregando e montando dados...</div>';

  try {
    const response = await fetch(fullUrl);
    const text = await response.text();
    const ms = Math.round(performance.now() - started);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        ok: false,
        raw: text
      };
    }

    state.lastJson = data;
    state.lastUrl = fullUrl;

    renderMeta(fullUrl, ms, response.status);
    output.textContent = JSON.stringify(data, null, 2);
    visualView.innerHTML = renderResponse(data);
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    const data = {
      ok: false,
      error: error.message,
      hint: 'Verifique se a API está rodando localmente com `npx vercel dev` ou se o deploy está ativo.'
    };

    state.lastJson = data;
    renderMeta(fullUrl, ms, 'NETWORK_ERROR');
    output.textContent = JSON.stringify(data, null, 2);
    visualView.innerHTML = renderResponse(data);
  } finally {
    setLoading(false);
  }
}

async function checkHealth() {
  const dot = $('#statusDot');
  const text = $('#statusText');
  const detail = $('#statusDetail');

  try {
    const response = await fetch('/api/health');
    const data = await response.json();

    dot.className = 'status-dot ok';
    text.textContent = data?.ok ? 'API online' : 'API respondeu';
    detail.textContent = '/api/health';
  } catch {
    dot.className = 'status-dot fail';
    text.textContent = 'API offline';
    detail.textContent = 'Rode `npx vercel dev`';
  }
}

function downloadJson() {
  if (!state.lastJson) return;

  const blob = new Blob([JSON.stringify(state.lastJson, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  link.href = url;
  link.download = `scraper-investidor10-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((item) => item.classList.remove('active'));
    $$('.form').forEach((form) => form.classList.remove('active'));

    tab.classList.add('active');
    $(`[data-form="${tab.dataset.tab}"]`).classList.add('active');
  });
});

$$('.view-tab').forEach((tab) => {
  tab.addEventListener('click', () => setView(tab.dataset.view));
});

$('#assetForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const params = paramsFromForm(event.currentTarget);
  request(`/api/asset?${params.toString()}`, `Ativo ${params.get('ticker') || ''}`.trim());
});

$('#searchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const params = paramsFromForm(event.currentTarget);
  request(`/api/search?${params.toString()}`, `Busca ${params.get('q') || ''}`.trim());
});

$('#listForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const params = paramsFromForm(event.currentTarget);
  request(`/api/list?${params.toString()}`, `Lista ${params.get('type') || ''}`.trim());
});

$('#bulkForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const params = paramsFromForm(event.currentTarget);
  request(`/api/bulk?${params.toString()}`, `Bulk ${params.get('type') || ''}`.trim());
});

$$('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    request(button.dataset.preset, button.textContent.trim());
  });
});

$('#copyBtn').addEventListener('click', async () => {
  if (!state.lastJson) return;

  await navigator.clipboard.writeText(JSON.stringify(state.lastJson, null, 2));

  $('#copyBtn').textContent = 'Copiado!';
  setTimeout(() => {
    $('#copyBtn').textContent = 'Copiar JSON';
  }, 1200);
});

$('#downloadBtn').addEventListener('click', downloadJson);

$('#clearBtn').addEventListener('click', () => {
  state.lastJson = null;
  state.lastUrl = null;

  requestTitle.textContent = 'Nenhuma requisição ainda';
  meta.innerHTML = '<span>Endpoint: aguardando...</span><span>Tempo: --</span><span>Status: --</span>';
  output.textContent = 'Clique em algum teste ou envie um formulário.';
  visualView.innerHTML = '<div class="empty-state">Clique em algum teste ou envie um formulário para montar todas as informações coletadas.</div>';
  setView('visual');
});

setView('visual');
checkHealth();
