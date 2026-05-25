const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  lastJson: null,
  lastUrl: null
};

const output = $("#output");
const requestTitle = $("#requestTitle");
const meta = $("#meta");
const summary = $("#summary");

function setLoading(isLoading) {
  $$("button").forEach((button) => {
    if (!button.classList.contains("tab")) {
      button.disabled = isLoading;
    }
  });
}

function endpoint(path) {
  return path.startsWith("/api") ? path : `/api/${path.replace(/^\/+/, "")}`;
}

function paramsFromForm(form) {
  const data = new FormData(form);
  const params = new URLSearchParams();

  for (const [key, value] of data.entries()) {
    if (value === "on") {
      params.set(key, "1");
    } else if (String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  }

  return params;
}

function renderMeta(url, ms, status) {
  meta.innerHTML = `
    <span>Endpoint: ${escapeHtml(url)}</span>
    <span>Tempo: ${ms}ms</span>
    <span>Status: ${status}</span>
  `;
}

function renderSummary(data) {
  const cards = [];

  const root = data?.data || data?.asset || data?.result || data;
  const title = root?.title || root?.name || root?.ticker || data?.ticker;
  const type = root?.type || data?.type;
  const sourceUrl = root?.url || data?.url || root?.sourceUrl;

  if (title) cards.push(["Título", title]);
  if (type) cards.push(["Tipo", type]);
  if (sourceUrl) cards.push(["Fonte", sourceUrl]);

  const metrics = root?.metrics || root?.normalizedMetrics || data?.metrics;

  if (metrics && typeof metrics === "object") {
    Object.entries(metrics).slice(0, 8).forEach(([key, value]) => {
      if (value !== null && value !== undefined && String(value).length < 80) {
        cards.push([key, value]);
      }
    });
  }

  if (!cards.length) {
    summary.classList.remove("active");
    summary.innerHTML = "";
    return;
  }

  summary.innerHTML = cards.map(([label, value]) => `
    <div class="summary-card">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `).join("");

  summary.classList.add("active");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function request(url, label = url) {
  const fullUrl = endpoint(url);
  const started = performance.now();

  setLoading(true);
  requestTitle.textContent = label;
  output.textContent = "Carregando...";
  summary.classList.remove("active");
  summary.innerHTML = "";

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
    renderSummary(data);
    output.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    const ms = Math.round(performance.now() - started);

    const data = {
      ok: false,
      error: error.message,
      hint: "Verifique se a API está rodando localmente com `npx vercel dev` ou se o deploy está ativo."
    };

    state.lastJson = data;

    renderMeta(fullUrl, ms, "NETWORK_ERROR");
    output.textContent = JSON.stringify(data, null, 2);
  } finally {
    setLoading(false);
  }
}

async function checkHealth() {
  const dot = $("#statusDot");
  const text = $("#statusText");
  const detail = $("#statusDetail");

  try {
    const response = await fetch("/api/health");
    const data = await response.json();

    dot.className = "status-dot ok";
    text.textContent = data?.ok ? "API online" : "API respondeu";
    detail.textContent = "/api/health";
  } catch {
    dot.className = "status-dot fail";
    text.textContent = "API offline";
    detail.textContent = "Rode `npx vercel dev`";
  }
}

$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((item) => item.classList.remove("active"));
    $$(".form").forEach((form) => form.classList.remove("active"));

    tab.classList.add("active");
    $(`[data-form="${tab.dataset.tab}"]`).classList.add("active");
  });
});

$("#assetForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const params = paramsFromForm(event.currentTarget);

  request(
    `/api/asset?${params.toString()}`,
    `Ativo ${params.get("ticker") || ""}`.trim()
  );
});

$("#searchForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const params = paramsFromForm(event.currentTarget);

  request(
    `/api/search?${params.toString()}`,
    `Busca ${params.get("q") || ""}`.trim()
  );
});

$("#listForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const params = paramsFromForm(event.currentTarget);

  request(
    `/api/list?${params.toString()}`,
    `Lista ${params.get("type") || ""}`.trim()
  );
});

$("#bulkForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const params = paramsFromForm(event.currentTarget);

  request(
    `/api/bulk?${params.toString()}`,
    `Bulk ${params.get("type") || ""}`.trim()
  );
});

$$("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    request(button.dataset.preset, button.textContent.trim());
  });
});

$("#copyBtn").addEventListener("click", async () => {
  if (!state.lastJson) return;

  await navigator.clipboard.writeText(JSON.stringify(state.lastJson, null, 2));

  $("#copyBtn").textContent = "Copiado!";

  setTimeout(() => {
    $("#copyBtn").textContent = "Copiar JSON";
  }, 1200);
});

$("#clearBtn").addEventListener("click", () => {
  state.lastJson = null;
  state.lastUrl = null;

  requestTitle.textContent = "Nenhuma requisição ainda";

  meta.innerHTML = `
    <span>Endpoint: aguardando...</span>
    <span>Tempo: --</span>
    <span>Status: --</span>
  `;

  summary.classList.remove("active");
  summary.innerHTML = "";

  output.textContent = "Clique em algum teste ou envie um formulário.";
});

checkHealth();