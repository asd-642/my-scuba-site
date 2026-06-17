function render() {
  const app = document.getElementById("app");
  const r = route();
  const printRoute = r.parts[0] === "quotes" && r.parts[2] === "print";
  if (!isAuthed() && r.parts[0] !== "login") {
    go("/login");
    return;
  }
  if (r.parts[0] === "login") {
    app.innerHTML = renderAuth();
    return;
  }
  if (printRoute) {
    app.innerHTML = renderPrintPage(r.parts[1], r.query.get("type") || "traditional");
    return;
  }
  app.innerHTML = renderShell(renderPage(r), r.path) + renderToast();
}

function renderAuth() {
  const isLogin = ui.authMode === "login";
  return `
    <main class="auth-page">
      <section class="auth-card">
        <h1>建材報價單系統</h1>
        <p>${isLogin ? "請登入帳號" : "建立新帳號"}</p>
        <form onsubmit="${isLogin ? "login(event)" : "register(event)"}">
          <div class="field">
            <label>電子郵件</label>
            <input class="input" name="email" type="email" aria-label="電子郵件" value="${isLogin ? DEMO_EMAIL : ""}" required>
          </div>
          <div class="field" style="margin-top:14px">
            <label>密碼</label>
            <input class="input" name="password" type="password" aria-label="密碼" value="${isLogin ? DEMO_PASSWORD : ""}" required>
          </div>
          <button class="btn" style="width:100%; margin-top:20px" type="submit">${isLogin ? "登入" : "註冊"}</button>
        </form>
        <button class="btn secondary" style="width:100%; margin-top:12px" onclick="toggleAuthMode()">
          ${isLogin ? "還沒有帳號?註冊" : "已有帳號?登入"}
        </button>
      </section>
    </main>
    ${renderToast()}
  `;
}

function renderShell(content, path) {
  const nav = [
    ["/dashboard", "▦", "儀表板"],
    ["/materials", "□", "材料庫"],
    ["/customers", "◇", "客戶"],
    ["/quote-templates", "☰", "報價單版本"],
    ["/quotes", "≡", "報價單"],
  ];
  const collapsed = ui.sidebarCollapsed ? "collapsed" : "";
  return `
    <div class="app-shell">
      <aside class="sidebar ${collapsed}">
        <div class="brand">
          <span class="brand-mark">報</span>
          ${ui.sidebarCollapsed ? "" : "<span>報價單系統</span>"}
          <button class="collapse-btn" title="收折側欄" onclick="toggleSidebar()">‹</button>
        </div>
        <nav class="nav">
          ${nav
            .map(([href, icon, label]) => {
              const active = path.startsWith(href) ? "active" : "";
              return `<a class="${active}" href="${link(href)}"><span class="nav-icon">${icon}</span>${ui.sidebarCollapsed ? "" : `<span>${label}</span>`}</a>`;
            })
            .join("")}
        </nav>
        <div class="account">
          ${ui.accountOpen ? `<div class="account-menu"><a href="${link("/settings/company")}">設定</a><button onclick="resetDemo()">重置示範資料</button><button onclick="logout()">登出</button></div>` : ""}
          <button class="account-btn" onclick="toggleAccount()" aria-expanded="${ui.accountOpen}">
            <span class="avatar">來</span>
            ${ui.sidebarCollapsed ? "" : `<span><span class="account-name">來來建材</span><br><span class="account-role">管理員</span></span>`}
          </button>
        </div>
      </aside>
      <main class="main">${content}</main>
    </div>
  `;
}

function renderPage(r) {
  const [first, second, third] = r.parts;
  if (first === "dashboard") return renderDashboard();
  if (first === "materials") {
    if (second === "new") return renderMaterialForm(null);
    if (second) return renderMaterialForm(second);
    return renderMaterials();
  }
  if (first === "customers") {
    if (second === "new") return renderCustomerForm(null);
    if (second) return renderCustomerForm(second);
    return renderCustomers();
  }
  if (first === "quote-templates") {
    if (second === "new") return renderTemplateForm(null);
    if (second) return renderTemplateForm(second);
    return renderTemplates();
  }
  if (first === "quotes") {
    if (second === "new") return renderQuoteForm(null);
    if (third === "edit") return renderQuoteForm(second);
    if (second) return renderQuoteDetail(second);
    return renderQuotes(r.query);
  }
  if (first === "settings") return renderSettings();
  return renderDashboard();
}

function pageHead(title, subtitle, action = "") {
  return `<div class="page-head"><div><h1>${h(title)}</h1>${subtitle ? `<p>${h(subtitle)}</p>` : ""}</div>${action}</div>`;
}

function renderDashboard() {
  const nowMonth = "2026-06";
  const quotes = state.quotes;
  const computed = quotes.map((quote) => ({ quote, totals: computeQuote(quote) }));
  const monthQuotes = computed.filter(({ quote }) => quote.quote_date.startsWith(nowMonth));
  const wonMonth = monthQuotes.filter(({ quote }) => quote.status === "won");
  const inProgress = monthQuotes.filter(({ quote }) => quote.status === "draft" || quote.status === "sent");
  const yearQuotes = computed.filter(({ quote }) => quote.quote_date.startsWith("2026"));
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return computed.filter(({ quote }) => quote.quote_date.startsWith(`2026-${month}`) && quote.status === "won").reduce((sum, row) => sum + row.totals.total, 0);
  });
  const maxMonthly = Math.max(...monthly, 1);
  return `
    ${pageHead("儀表板", "歡迎回來,來來建材")}
    <h2 style="font-size:18px;margin:0 0 12px">本月概況</h2>
    <div class="grid cards-4">
      ${metric("本月新成立", monthQuotes.length, "件", "0% vs 上月")}
      ${metric("本月成交", wonMonth.length, "件", "")}
      ${metric("本月成交額", money(wonMonth.reduce((sum, row) => sum + row.totals.total, 0)), "", "")}
      ${metric("本月進行中", inProgress.length, `預估 ${money(inProgress.reduce((sum, row) => sum + row.totals.total, 0))}`, "0% vs 上月")}
    </div>
    <div class="grid cards-2" style="margin-top:16px">
      <section class="card">
        <div class="card-header"><h2>2026 年逐月成交額</h2><span class="muted">累計 ${money(yearQuotes.filter((row) => row.quote.status === "won").reduce((sum, row) => sum + row.totals.total, 0))} (${yearQuotes.filter((row) => row.quote.status === "won").length} 件)</span></div>
        <div class="card-body"><div class="chart">${monthly.map((value, index) => `<div class="bar" style="height:${Math.max(4, (value / maxMonthly) * 190)}px"><span>${index + 1} 月</span></div>`).join("")}</div></div>
      </section>
      <section class="card">
        <div class="card-header"><h2>本月狀態分布</h2></div>
        <div class="card-body">
          <div style="display:grid;place-items:center;height:230px">
            <div style="width:150px;height:150px;border-radius:50%;border:28px solid #3b82f6;display:grid;place-items:center">
              <div style="text-align:center"><div class="metric-value" style="font-size:30px">${monthQuotes.length}</div><div class="muted">本月件數</div></div>
            </div>
          </div>
          <div class="row-card"><span>進行中</span><strong>${inProgress.length}</strong></div>
        </div>
      </section>
    </div>
    <div class="grid cards-2" style="margin-top:16px">
      <section class="card">
        <div class="card-header"><h2>2026 年累計</h2></div>
        <div class="card-body">
          ${calcLine("新成立", `${yearQuotes.length} 件`)}
          ${calcLine("成交", `${yearQuotes.filter((row) => row.quote.status === "won").length} 件`)}
          ${calcLine("成交額", money(yearQuotes.filter((row) => row.quote.status === "won").reduce((sum, row) => sum + row.totals.total, 0)))}
          ${calcLine("進行中", `${yearQuotes.filter((row) => row.quote.status === "draft" || row.quote.status === "sent").length} 件`)}
          ${calcLine("進行中金額", money(yearQuotes.filter((row) => row.quote.status === "draft" || row.quote.status === "sent").reduce((sum, row) => sum + row.totals.total, 0)))}
          ${calcLine("平均成交額", "—")}
        </div>
      </section>
      <section class="card">
        <div class="card-header"><h2>最近的報價單</h2><a class="btn outline sm" href="${link("/quotes")}">查看全部</a></div>
        <div class="card-body list-card">
          ${computed
            .slice()
            .sort((a, b) => b.quote.quote_date.localeCompare(a.quote.quote_date))
            .slice(0, 3)
            .map(({ quote, totals }) => {
              const customer = customerById(quote.customer_id);
              return `<a class="row-card" href="${link(`/quotes/${quote.id}`)}"><span><strong>${quote.quote_no}</strong><br><span class="muted">${h(customer?.company_name || "")}${quote.project_name ? ` · ${h(quote.project_name)}` : ""}</span></span><span><span class="badge">${QUOTE_STATUS_LABEL[quote.status]}</span> <span class="amount">${money(totals.total)}</span></span></a>`;
            })
            .join("")}
        </div>
      </section>
    </div>
    <section class="card" style="margin-top:16px">
      <div class="card-header"><h2>即將到期</h2><a class="btn outline sm" href="${link("/quotes?status=sent")}">查看已寄出</a></div>
      <div class="card-body"><div class="empty">沒有即將到期的報價單 ✓</div></div>
    </section>
  `;
}

function metric(label, value, unit, note) {
  return `<section class="card"><div class="card-body"><div class="metric-label">${h(label)}</div><div class="metric-value">${h(value)}${unit && /^\D/.test(unit) ? "" : ""}</div>${unit ? `<div class="metric-note">${h(unit)}</div>` : ""}${note ? `<div class="metric-note">${h(note)}</div>` : ""}</div></section>`;
}

function calcLine(label, value) {
  return `<div class="calc-line"><span class="muted">${h(label)}</span><strong>${h(value)}</strong></div>`;
}

function renderMaterials() {
  const q = route().query.get("q") || "";
  const includeInactive = route().query.get("inactive") === "1";
  const rows = state.materials.filter((item) => {
    const text = `${item.name} ${item.code} ${item.category}`.toLowerCase();
    return (includeInactive || item.is_active) && text.includes(q.toLowerCase());
  });
  return `
    ${pageHead("材料庫", `共 ${rows.length} 項材料`, `<a class="btn" href="${link("/materials/new")}">＋ 新增材料</a>`)}
    <form class="toolbar" onsubmit="searchList(event,'/materials')">
      <input class="input" style="max-width:320px" name="q" value="${h(q)}" placeholder="搜尋名稱、料號、分類…">
      <label class="checkbox-row"><input type="checkbox" name="inactive" ${includeInactive ? "checked" : ""}>含停用</label>
      <button class="btn secondary" type="submit">搜尋</button>
    </form>
    <div class="table-wrap">
      <table>
        <thead><tr><th>名稱</th><th>分類</th><th>規格 (厚×寬×長)</th><th>計價</th><th>材料單價</th><th>工錢單價</th><th>損料</th><th>狀態</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (item) => `<tr>
                <td><a class="link-strong" href="${link(`/materials/${item.id}`)}">${h(item.name)}</a><div class="sub">#${h(item.code)}</div></td>
                <td>${h(item.category || "—")}</td>
                <td>${materialSpec(item)}</td>
                <td>${h(pricingLabel(item.pricing_type, true))}<div class="sub">/ ${h(item.unit)}</div></td>
                <td>${money(item.unit_price)}</td>
                <td>${n(item.labor_unit_price) ? money(item.labor_unit_price) : "—"}</td>
                <td>${n(item.waste_pct) ? `${h(item.waste_pct)}%` : "—"}</td>
                <td>${statusBadge(item.is_active ? "啟用" : "停用", item.is_active ? "green" : "")}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function materialSpec(item) {
  const values = [item.default_thickness, item.default_width, item.default_length].map((v) => (v === "" || v == null ? "—" : h(v)));
  if (values.every((v) => v === "—")) return "—";
  return `${values.join(" × ")} cm`;
}

function statusBadge(text, color = "") {
  return `<span class="badge ${color}">${h(text)}</span>`;
}
