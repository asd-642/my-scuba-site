function render() {
  const app = document.getElementById("app");
  const r = route();
  const printRoute = r.parts[0] === "quotes" && r.parts[2] === "print";
  if (!isAuthed() && r.parts[0] !== "login") {
    go("/login");
    return;
  }
  if (isAuthed() && !currentUser()) {
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
  return `
    <main class="auth-page">
      <section class="auth-card">
        <h1>建材報價單系統-941025的001版</h1>
        <p>請登入帳號</p>
        <form onsubmit="login(event)">
          <div class="field">
            <label>帳號</label>
            <input class="input" name="email" type="text" aria-label="帳號" value="${DEMO_EMAIL}" required>
          </div>
          <div class="field" style="margin-top:14px">
            <label>密碼</label>
            <input class="input" name="password" type="password" aria-label="密碼" value="${DEMO_PASSWORD}" required>
          </div>
          <button class="btn" style="width:100%; margin-top:20px" type="submit">登入</button>
        </form>
      </section>
    </main>
    ${renderToast()}
  `;
}

function renderShell(content, path) {
  const account = currentUser() || defaultAccounts()[0];
  const nav = [
    ["/dashboard", "▦", "儀表板"],
    ["/materials", "□", "材料庫"],
    ["/customers", "◇", "客戶"],
    ["/quote-templates", "☰", "報價單版本"],
    ["/quotes", "≡", "報價單"],
  ];
  if (isAdmin()) {
    nav.push(["/accounts", "◎", "帳號管理"]);
    nav.push(["/settings/company", "⚙", "公司設定"]);
  }
  const collapsed = ui.sidebarCollapsed ? "collapsed" : "";
  return `
    <div class="app-shell">
      <aside class="sidebar ${collapsed}">
        <div class="brand">
          <span class="brand-mark">報</span>
          ${ui.sidebarCollapsed ? "" : "<span>報價單系統-941025的001版</span>"}
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
          ${
            ui.accountOpen
              ? `<div class="account-menu">
                  <a href="${link("/settings/profile")}">個人設定</a>
                  <button onclick="resetDemo()">重置示範資料</button>
                  <button onclick="logout()">登出</button>
                </div>`
              : ""
          }
          <button class="account-btn" onclick="toggleAccount()" aria-expanded="${ui.accountOpen}">
            ${renderAvatar(account)}
            ${ui.sidebarCollapsed ? "" : `<span><span class="account-name">${h(account.name)}</span><br><span class="account-role">${h(accountRoleLabel(account.role))}</span></span>`}
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
  if (first === "accounts") return isAdmin() ? renderAccounts() : renderAccessDenied();
  if (first === "settings") {
    if (second === "company") return isAdmin() ? renderSettings() : renderAccessDenied();
    return renderPersonalSettings();
  }
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
  const params = route().query;
  const q = params.get("q") || "";
  const includeInactive = params.get("inactive") === "1";
  const selectedCategories = Array.from(new Set(params.getAll("category").filter(Boolean)));
  const priceBasisOptions = ["unit_price", "labor_unit_price"];
  const selectedPriceBases = Array.from(new Set(params.getAll("price_basis").filter((value) => priceBasisOptions.includes(value))));
  const minPrice = params.get("min_price") || "";
  const maxPrice = params.get("max_price") || "";
  const sort = ["asc", "desc"].includes(params.get("sort")) ? params.get("sort") : "";
  const min = minPrice === "" ? null : n(minPrice);
  const max = maxPrice === "" ? null : n(maxPrice);
  const activePriceBases = selectedPriceBases.length ? selectedPriceBases : priceBasisOptions;
  const rows = state.materials
    .filter((item) => {
    const text = `${item.name} ${item.code} ${item.category}`.toLowerCase();
    const prices = materialComparablePrices(item, activePriceBases);
    const priceInRange = min == null && max == null ? true : prices.some((price) => (min == null || price >= min) && (max == null || price <= max));
    return (
      (includeInactive || item.is_active) &&
      text.includes(q.toLowerCase()) &&
      (!selectedCategories.length || selectedCategories.includes(item.category)) &&
      priceInRange
    );
  })
    .sort((a, b) => {
      if (!sort) return 0;
      const aPrice = materialSortPrice(a, selectedPriceBases, sort);
      const bPrice = materialSortPrice(b, selectedPriceBases, sort);
      if (aPrice == null && bPrice == null) return String(a.name).localeCompare(String(b.name), "zh-Hant");
      if (aPrice == null) return 1;
      if (bPrice == null) return -1;
      const diff = aPrice - bPrice;
      if (diff === 0) return String(a.name).localeCompare(String(b.name), "zh-Hant");
      return sort === "asc" ? diff : -diff;
    });
  const categories = Array.from(new Set(state.materials.map((item) => item.category).filter(Boolean)));
  return `
    ${pageHead("材料庫", `共 ${rows.length} 項材料`, `<a class="btn" href="${link("/materials/new")}">＋ 新增材料</a>`)}
    <form class="toolbar material-toolbar" onsubmit="searchMaterials(event)">
      <input class="input" style="max-width:320px" name="q" value="${h(q)}" placeholder="搜尋名稱、料號、分類…">
      ${renderMaterialFilterPopover({ categories, selectedCategories, selectedPriceBases, minPrice, maxPrice, sort, q, includeInactive })}
      <button class="btn secondary" type="submit">搜尋</button>
      <label class="checkbox-row toolbar-inactive-toggle"><input type="checkbox" name="inactive" ${includeInactive ? "checked" : ""}>含停用</label>
    </form>
    ${renderMaterialFilterChips({ selectedCategories, selectedPriceBases, minPrice, maxPrice, sort, q, includeInactive })}
    <div class="table-wrap">
      <table>
        <thead><tr><th>名稱</th><th>分類</th><th>規格 (厚×寬×長)</th><th>計價</th><th>材料單價</th><th>工錢單價</th><th>損料</th><th>狀態</th></tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
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
                  .join("")
              : `<tr><td colspan="8"><div class="empty">沒有符合條件的材料</div></td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderMaterialFilterPopover(filters) {
  const { categories, selectedCategories, selectedPriceBases, minPrice, maxPrice, sort } = filters;
  const activeCount = materialFilterCount(filters);
  const selected = new Set(selectedCategories);
  const selectedBases = new Set(selectedPriceBases);
  return `
    <details class="filter-popover">
      <summary class="filter-trigger">
        <span>範圍搜尋</span>
        ${activeCount ? `<span class="filter-count">${activeCount}</span>` : ""}
      </summary>
      <div class="filter-panel">
        <div class="filter-section">
          <div class="filter-title">分類</div>
          <div class="filter-tags">
            ${
              categories.length
                ? categories
                    .map(
                      (category) => `<label class="filter-tag"><input class="visually-hidden" type="checkbox" name="category" value="${h(category)}" ${selected.has(category) ? "checked" : ""}><span>${h(category)}</span></label>`
                    )
                    .join("")
                : `<span class="muted">尚無分類</span>`
            }
          </div>
        </div>
        <div class="filter-section">
          <div class="filter-title">單價依據</div>
          <div class="filter-toggles">
            <label class="filter-toggle"><input class="visually-hidden" type="checkbox" name="price_basis" value="unit_price" ${selectedBases.has("unit_price") ? "checked" : ""}><span>材料單價</span></label>
            <label class="filter-toggle"><input class="visually-hidden" type="checkbox" name="price_basis" value="labor_unit_price" ${selectedBases.has("labor_unit_price") ? "checked" : ""}><span>工錢單價</span></label>
          </div>
        </div>
        <div class="filter-section">
          <div class="filter-title">單價範圍</div>
          <div class="filter-price-grid">
            <input class="input" type="number" min="0" step="1" name="min_price" value="${h(minPrice)}" placeholder="最低">
            <input class="input" type="number" min="0" step="1" name="max_price" value="${h(maxPrice)}" placeholder="最高">
          </div>
        </div>
        <div class="filter-section">
          <div class="filter-title">排序</div>
          <select class="select" name="sort">
            <option value="" ${sort === "" ? "selected" : ""}>不排序</option>
            <option value="asc" ${sort === "asc" ? "selected" : ""}>單價從低到高</option>
            <option value="desc" ${sort === "desc" ? "selected" : ""}>單價從高到低</option>
          </select>
        </div>
        <div class="filter-actions">
          <a class="btn outline sm" href="${materialFilterClearHref(filters)}">清除</a>
          <button class="btn sm" type="submit">套用</button>
        </div>
      </div>
    </details>
  `;
}

function renderMaterialFilterChips(filters) {
  const { selectedCategories, selectedPriceBases, minPrice, maxPrice, sort } = filters;
  const chips = [];
  selectedCategories.forEach((category) => chips.push(`分類：${category}`));
  if (selectedPriceBases.includes("unit_price")) chips.push("依材料單價");
  if (selectedPriceBases.includes("labor_unit_price")) chips.push("依工錢單價");
  if (minPrice || maxPrice) chips.push(`單價：${minPrice || "不限"} - ${maxPrice || "不限"}`);
  if (sort === "asc") chips.push("單價低到高");
  if (sort === "desc") chips.push("單價高到低");
  if (!chips.length) return "";
  return `<div class="filter-chips">${chips.map((chip) => `<span class="filter-chip">${h(chip)}</span>`).join("")}<a class="filter-clear" href="${materialFilterClearHref(filters)}">清除範圍</a></div>`;
}

function materialFilterCount({ selectedCategories, selectedPriceBases, minPrice, maxPrice, sort }) {
  return selectedCategories.length + selectedPriceBases.length + (minPrice || maxPrice ? 1 : 0) + (sort ? 1 : 0);
}

function materialFilterClearHref({ q, includeInactive }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (includeInactive) params.set("inactive", "1");
  return link(`/materials${params.toString() ? `?${params}` : ""}`);
}

function materialComparablePrices(item, priceBases) {
  return priceBases
    .map((basis) => ({ basis, value: n(item[basis]) }))
    .filter(({ basis, value }) => basis !== "labor_unit_price" || value > 0)
    .map(({ value }) => value);
}

function materialSortPrice(item, selectedPriceBases, sort) {
  const prices = materialComparablePrices(item, selectedPriceBases.length ? selectedPriceBases : ["unit_price"]);
  if (!prices.length) return null;
  return selectedPriceBases.length > 1 && sort === "desc" ? Math.max(...prices) : Math.min(...prices);
}

function materialSpec(item) {
  const values = [item.default_thickness, item.default_width, item.default_length].map((v) => (v === "" || v == null ? "—" : h(v)));
  if (values.every((v) => v === "—")) return "—";
  return `${values.join(" × ")} cm`;
}

function statusBadge(text, color = "") {
  return `<span class="badge ${color}">${h(text)}</span>`;
}

function renderAccessDenied() {
  return `
    ${pageHead("無法進入", "此頁面只開放管理人員")}
    <section class="card">
      <div class="card-body"><div class="empty">目前帳號沒有管理權限</div></div>
    </section>
  `;
}

function renderAccounts() {
  const accounts = loadAccounts();
  return `
    ${pageHead("帳號管理", `共 ${accounts.length} 個帳號`, `<button class="btn" type="button" onclick="startAccountDraft()">＋ 新增帳號</button>`)}
    ${ui.accountDraft ? renderAccountDraft() : ""}
    <div class="account-list">
      ${accounts.map(renderAccountEditor).join("")}
    </div>
    ${renderAccountPermissionModal()}
  `;
}

function renderAccountDraft() {
  return `
    <form class="account-row-card account-row-new" onsubmit="createAccount(event)">
      <div class="field">
        <label>名稱</label>
        <input class="input" name="name" value="${h(ui.accountDraft.name)}" required>
      </div>
      <div class="field">
        <label>帳號</label>
        <input class="input" name="account" value="${h(ui.accountDraft.account)}" required>
      </div>
      <div class="field">
        <label>密碼</label>
        <input class="input" name="password" value="${h(ui.accountDraft.password)}" required>
      </div>
      <div class="field">
        <label>角色</label>
        <select class="select" name="role">
          ${renderRoleOptions(ui.accountDraft.role)}
        </select>
      </div>
      <div class="account-actions">
        <button class="btn sm" type="submit">建立帳號</button>
        <button class="btn secondary sm" type="button" onclick="cancelAccountDraft()">取消</button>
      </div>
    </form>
  `;
}

function renderAccountEditor(account) {
  return `
    <form class="account-row-card" onchange="autoSaveAccount(this,'${h(account.id)}')" onsubmit="saveAccount(event,'${h(account.id)}')">
      <div class="field">
        <label>名稱</label>
        <input class="input" name="name" value="${h(account.name)}" required>
      </div>
      <div class="field">
        <label>帳號</label>
        <input class="input" name="account" value="${h(account.account)}" required>
      </div>
      <div class="field">
        <label>密碼</label>
        <input class="input" name="password" value="${h(account.password)}" required>
      </div>
      <div class="field">
        <label>角色</label>
        <select class="select" name="role">
          ${renderRoleOptions(account.role)}
        </select>
      </div>
      <div class="account-actions">
        <button class="btn outline sm" type="button" onclick="openAccountPermissions('${h(account.id)}')">權限</button>
      </div>
    </form>
  `;
}

function renderRoleOptions(selectedRole) {
  return Object.entries(ACCOUNT_ROLE_LABELS)
    .map(([value, label]) => `<option value="${h(value)}" ${normalizeAccountRole(selectedRole) === value ? "selected" : ""}>${h(label)}</option>`)
    .join("");
}

function renderAccountPermissionModal() {
  if (!ui.permissionAccountId) return "";
  const account = accountById(ui.permissionAccountId);
  if (!account) return "";
  return `
    <div class="permission-backdrop" onclick="closeAccountPermissions()" role="presentation">
      <section class="permission-modal" role="dialog" aria-modal="true" aria-label="${h(account.name)} 權限" onclick="event.stopPropagation()">
        <div class="permission-head">
          <div>
            <h2>${h(account.name)} 權限</h2>
            <p>${h(account.account)} · ${h(accountRoleLabel(account.role))}</p>
          </div>
          <button class="icon-btn" type="button" onclick="closeAccountPermissions()" aria-label="關閉">×</button>
        </div>
        <div class="permission-list">
          ${renderPermissionToggle(
            account,
            "delete_user_data",
            "是否能刪除用戶數據",
            "開啟後，此帳號可以刪除客戶、材料、報價等資料。關閉後，按刪除會被系統阻擋。"
          )}
        </div>
      </section>
    </div>
  `;
}

function renderPermissionToggle(account, key, title, description) {
  const enabled = hasAccountPermission(account, key);
  return `
    <div class="permission-row">
      <div>
        <h3>${h(title)}</h3>
        <p>${h(description)}</p>
      </div>
      <button
        class="permission-switch ${enabled ? "is-on" : ""}"
        type="button"
        role="switch"
        aria-checked="${enabled}"
        title="${h(accountPermissionLabel(key))}"
        onclick="toggleAccountPermission('${h(account.id)}','${h(key)}')"
      >
        <span></span>
      </button>
    </div>
  `;
}
