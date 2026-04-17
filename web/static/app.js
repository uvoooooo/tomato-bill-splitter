const STORAGE_KEY = "tomato_session_id";

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
  return "请求失败";
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
    balancesWrap.innerHTML = '<p class="dim">暂无参与者</p>';
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
      <thead><tr><th>姓名</th><th class="num">净额</th></tr></thead>
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
    historyWrap.innerHTML = '<p class="dim">暂无记录</p>';
    return;
  }
  const rows = history
    .map(
      (h) => `
      <tr>
        <td>${h.id}</td>
        <td>${escapeHtml(h.payer)}</td>
        <td class="num">${Number(h.amount).toFixed(2)}</td>
        <td>${escapeHtml(h.consumers.join(", "))}</td>
        <td><button type="button" class="btn btn-danger" data-delete="${h.id}">删除</button></td>
      </tr>`
    )
    .join("");
  historyWrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>付款人</th>
          <th class="num">金额</th>
          <th>参与分摊</th>
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
    settlementsWrap.innerHTML = '<p class="dim">已结清，无需转账</p>';
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
    showErr("无法加载状态");
    return;
  }
  const data = await res.json();
  await applyState(data);
}

async function submitBill(ev) {
  ev.preventDefault();
  showErr("");
  const fd = new FormData(formBill);
  const amount = parseFloat(fd.get("amount"), 10);
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
  if (!window.confirm("确定清空当前会话的所有账单？")) return;
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

sessionIdEl.textContent = getSessionId();
formBill.addEventListener("submit", submitBill);
btnReset.addEventListener("click", resetSession);
initExportLink();
fetchState();
