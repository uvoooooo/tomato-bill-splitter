const STORAGE_KEY = "tomato_session_id";
const LANG_KEY = "tomato_lang";

const STRINGS = {
  zh: {
    pageTitle: "Tomato Bill Splitter",
    appName: "Tomato Bill Splitter",
    eyebrow: "分摊记账",
    tagline: "均分记账，最少笔数结算",
    sessionLabel: "会话",
    reset: "清空重来",
    exportExcel: "下载 Excel",
    addBill: "记一笔",
    amountLabel: "金额",
    payerLabel: "谁付的",
    consumersLabel: "谁一起分摊（逗号或空格分隔，留空 = 当前所有人）",
    payerPlaceholder: "姓名",
    consumersPlaceholder: "例如：甲, 乙, 丙",
    add: "添加",
    balancesTitle: "当前余额",
    settlementsTitle: "结算建议",
    historyTitle: "账单记录",
    footerCli: "命令行版：",
    emptyBalances: "暂无参与者",
    settlementsHint: "添加账单后自动计算",
    emptyHistory: "暂无记录",
    settledNoTransfer: "已结清，无需转账",
    thName: "姓名",
    thNet: "净额",
    thPayer: "付款人",
    thAmount: "金额",
    thSplit: "参与分摊",
    delete: "删除",
    loadStateFailed: "无法加载状态",
    requestFailed: "请求失败",
    confirmReset: "确定清空当前会话的所有账单？",
    switchToEn: "切换到英文",
    switchToZh: "切换到中文",
    langButtonEn: "English",
    langButtonZh: "中文",
  },
  en: {
    pageTitle: "Tomato Bill Splitter",
    appName: "Tomato Bill Splitter",
    eyebrow: "Shared expenses",
    tagline: "Split evenly, settle with the fewest transfers",
    sessionLabel: "Session",
    reset: "Clear all",
    exportExcel: "Download Excel",
    addBill: "Add a bill",
    amountLabel: "Amount",
    payerLabel: "Who paid",
    consumersLabel: "Split among (comma or space; leave blank = everyone in the group)",
    payerPlaceholder: "Name",
    consumersPlaceholder: "e.g. Alice, Bob",
    add: "Add",
    balancesTitle: "Balances",
    settlementsTitle: "Settlements",
    historyTitle: "Bill history",
    footerCli: "CLI ·",
    emptyBalances: "No participants yet",
    settlementsHint: "Calculated after you add bills",
    emptyHistory: "No bills yet",
    settledNoTransfer: "All settled — no transfers needed",
    thName: "Name",
    thNet: "Net",
    thPayer: "Paid by",
    thAmount: "Amount",
    thSplit: "Split among",
    delete: "Remove",
    loadStateFailed: "Could not load state",
    requestFailed: "Request failed",
    confirmReset: "Clear all bills in this session?",
    switchToEn: "Switch to English",
    switchToZh: "Switch to Chinese",
    langButtonEn: "English",
    langButtonZh: "中文",
  },
};

function getLang() {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "zh" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function t(key) {
  const lang = getLang();
  return STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
}

function applyStaticI18n() {
  const lang = getLang();
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = STRINGS[lang].pageTitle;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && STRINGS[lang][key]) el.textContent = STRINGS[lang][key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && STRINGS[lang][key]) el.setAttribute("placeholder", STRINGS[lang][key]);
  });
}

function updateLangButton() {
  const lang = getLang();
  const btn = document.getElementById("btn-lang");
  if (!btn) return;
  if (lang === "zh") {
    btn.textContent = STRINGS.zh.langButtonEn;
    btn.setAttribute("aria-label", STRINGS.zh.switchToEn);
  } else {
    btn.textContent = STRINGS.en.langButtonZh;
    btn.setAttribute("aria-label", STRINGS.en.switchToZh);
  }
}

function toggleLang() {
  const next = getLang() === "zh" ? "en" : "zh";
  localStorage.setItem(LANG_KEY, next);
  applyStaticI18n();
  updateLangButton();
  fetchState();
}

function getSessionId() {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

function apiUrl(path, params) {
  const u = new URL(path, window.location.origin);
  u.searchParams.set("session_id", getSessionId());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

const errEl = document.getElementById("err");
const sessionIdEl = document.getElementById("session-id");
const balancesWrap = document.getElementById("balances-wrap");
const historyWrap = document.getElementById("history-wrap");
const settlementsWrap = document.getElementById("settlements-wrap");
const formBill = document.getElementById("form-bill");
const btnReset = document.getElementById("btn-reset");
const linkExport = document.getElementById("link-export");
const btnLang = document.getElementById("btn-lang");

function showErr(msg) {
  if (!msg) {
    errEl.hidden = true;
    errEl.textContent = "";
    return;
  }
  errEl.hidden = false;
  errEl.textContent = msg;
}

function formatApiError(data) {
  const d = data && data.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((e) => (e.msg ? `${e.loc?.join?.(".") ?? ""}: ${e.msg}` : JSON.stringify(e)))
      .join(" ");
  }
  return t("requestFailed");
}

function parseConsumers(raw) {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[\s,，]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function renderBalances(balances) {
  const entries = Object.entries(balances || {});
  if (entries.length === 0) {
    balancesWrap.innerHTML = `<p class="dim">${escapeHtml(t("emptyBalances"))}</p>`;
    return;
  }
  const rows = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => {
      let cls = "";
      let display = v.toFixed(2);
      if (v > 0.01) {
        cls = "bal-pos";
        display = `+${display}`;
      } else if (v < -0.01) cls = "bal-neg";
      else display = "0.00";
      return `<tr><td>${escapeHtml(name)}</td><td class="num ${cls}">${escapeHtml(display)}</td></tr>`;
    })
    .join("");
  balancesWrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>${escapeHtml(t("thName"))}</th><th class="num">${escapeHtml(t("thNet"))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderHistory(history) {
  if (!history || history.length === 0) {
    historyWrap.innerHTML = `<p class="dim">${escapeHtml(t("emptyHistory"))}</p>`;
    return;
  }
  const del = escapeHtml(t("delete"));
  const rows = history
    .map(
      (h) => `
      <tr>
        <td>${h.id}</td>
        <td>${escapeHtml(h.payer)}</td>
        <td class="num">${Number(h.amount).toFixed(2)}</td>
        <td>${escapeHtml(h.consumers.join(", "))}</td>
        <td><button type="button" class="btn btn-danger" data-delete="${h.id}">${del}</button></td>
      </tr>`
    )
    .join("");
  historyWrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>${escapeHtml(t("thPayer"))}</th>
          <th class="num">${escapeHtml(t("thAmount"))}</th>
          <th>${escapeHtml(t("thSplit"))}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  historyWrap.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteBill(Number(btn.getAttribute("data-delete"))));
  });
}

function renderSettlements(items) {
  if (!items || items.length === 0) {
    settlementsWrap.innerHTML = `<p class="dim">${escapeHtml(t("settledNoTransfer"))}</p>`;
    return;
  }
  settlementsWrap.innerHTML = items
    .map(
      (r) => `
      <div class="settle-row">
        <span class="bal-neg">${escapeHtml(r.from)}</span>
        <span class="dim">→</span>
        <span class="bal-pos">${escapeHtml(r.to)}</span>
        <span class="settle-amt">${r.amount.toFixed(2)}</span>
      </div>`
    )
    .join("");
}

async function loadSettlements() {
  const res = await fetch(apiUrl("/api/settlements"));
  if (!res.ok) return;
  const data = await res.json();
  renderSettlements(data.items);
}

async function applyState(data) {
  renderBalances(data.balances);
  renderHistory(data.history);
  await loadSettlements();
}

async function fetchState() {
  showErr("");
  const res = await fetch(apiUrl("/api/state"));
  if (!res.ok) {
    showErr(t("loadStateFailed"));
    return;
  }
  const data = await res.json();
  await applyState(data);
}

async function submitBill(ev) {
  ev.preventDefault();
  showErr("");
  const fd = new FormData(formBill);
  const amount = parseFloat(String(fd.get("amount") || ""), 10);
  const payer = String(fd.get("payer") || "").trim();
  const consumers = parseConsumers(String(fd.get("consumers") || ""));

  const res = await fetch(apiUrl("/api/bill"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, payer, consumers }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showErr(formatApiError(data));
    return;
  }
  await applyState(data);
  formBill.reset();
  applyStaticI18n();
}

async function deleteBill(id) {
  showErr("");
  const res = await fetch(apiUrl(`/api/bill/${id}`), { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showErr(formatApiError(data));
    return;
  }
  await applyState(data);
}

async function resetSession() {
  if (!window.confirm(t("confirmReset"))) return;
  showErr("");
  const res = await fetch(apiUrl("/api/reset"), { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showErr(formatApiError(data));
    return;
  }
  await applyState(data);
}

function initExportLink() {
  linkExport.href = apiUrl("/api/export.xlsx");
  linkExport.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = apiUrl("/api/export.xlsx");
  });
}

applyStaticI18n();
updateLangButton();
sessionIdEl.textContent = getSessionId();
formBill.addEventListener("submit", submitBill);
btnReset.addEventListener("click", resetSession);
btnLang.addEventListener("click", toggleLang);
initExportLink();
fetchState();
