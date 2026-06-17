function renderMaterialForm(materialId) {
  const item = materialId ? materialById(materialId) : null;
  const data = item || {
    id: "",
    name: "",
    code: "",
    category: "",
    unit: "件",
    pricing_type: "single",
    default_thickness: "",
    default_width: "",
    default_length: "",
    default_weight: "",
    wall_thickness_mm: "",
    density_factor: 0.02466,
    unit_price: 0,
    waste_pct: 0,
    labor_unit_price: 0,
    labor_waste_pct: "",
    labor_pricing_type: "",
    notes: "",
    is_active: true,
  };
  const opt = pricingOption(data.pricing_type);
  return `
    ${pageHead(item ? "編輯材料" : "新增材料", item ? `修改「${item.name}」的資料` : "建立一筆材料庫資料")}
    <form class="grid" onsubmit="saveMaterial(event,'${materialId || ""}')">
      <section class="card"><div class="card-header"><h2>基本資料</h2></div><div class="card-body form-grid">
        ${field("材料名稱", "name", data.name, true)}
        ${field("料號", "code", data.code, false, "選填,唯一")}
        ${field("分類", "category", data.category, false, "例:磁磚 / 木材 / 五金")}
        ${field("顯示單位", "unit", data.unit, true, "例:才、平、片、組")}
      </div></section>
      <section class="card"><div class="card-header"><h2>計價方式與規格</h2></div><div class="card-body">
        <div class="form-grid cols-4">
          <div class="field span-4"><label>計價類型*</label><select class="select" name="pricing_type" onchange="this.form.submit()">${pricingOptionsHtml(data.pricing_type)}</select><small>${h(opt.hint)}</small></div>
          ${numberField(dimLabel(data.pricing_type, "thickness"), "default_thickness", data.default_thickness, false, "公分")}
          ${numberField(dimLabel(data.pricing_type, "width"), "default_width", data.default_width, false, "公分")}
          ${numberField(dimLabel(data.pricing_type, "length"), "default_length", data.default_length, false, "公分")}
          ${numberField("重量", "default_weight", data.default_weight, false, "公斤 (kg)")}
          ${
            opt.needsWall
              ? `${numberField("壁厚", "wall_thickness_mm", data.wall_thickness_mm, false, "公釐 (mm),例 2T 填 2")}
                 ${numberField("重量換算係數", "density_factor", data.density_factor, false, "碳鋼 0.02466;不鏽鋼/鋁材可自行調整")}`
              : ""
          }
        </div>
      </div></section>
      <section class="card"><div class="card-header"><h2>單價</h2></div><div class="card-body form-grid cols-4">
        ${numberField("材料單價", "unit_price", data.unit_price, true, "每單位的材料價格")}
        ${numberField("材料損料 %", "waste_pct", data.waste_pct, false, "例:5 表示加 5%,報價時可覆寫")}
        ${numberField("工錢單價", "labor_unit_price", data.labor_unit_price, false, "每單位的人工費用,0 表示不計工錢")}
        ${numberField("工錢損料 %", "labor_waste_pct", data.labor_waste_pct, false, "留空 = 與材料損料相同")}
        <div class="field span-4"><label>工錢計價方式</label><select class="select" name="labor_pricing_type"><option value="">與材料相同</option>${pricingOptionsHtml(data.labor_pricing_type, true)}</select><small>多數情況留「與材料相同」;例:鋼管材料按 kg、工錢按板才。</small></div>
      </div></section>
      <section class="card"><div class="card-header"><h2>其他</h2></div><div class="card-body">
        <div class="field"><label>備註</label><textarea class="textarea" name="notes">${h(data.notes)}</textarea></div>
        <label class="checkbox-row" style="margin-top:12px"><input type="checkbox" name="is_active" ${data.is_active ? "checked" : ""}>啟用 (建報價時可選此材料)</label>
      </div><div class="card-footer">
        ${item ? `<button class="btn danger" type="button" onclick="deleteRecord('materials','${item.id}','/materials')">刪除</button>` : ""}
        <a class="btn outline" href="${link("/materials")}">取消</a>
        <button class="btn" type="submit">${item ? "儲存變更" : "建立"}</button>
      </div></section>
    </form>
  `;
}

function field(label, name, value, required = false, hint = "") {
  return `<div class="field"><label>${h(label)}${required ? "*" : ""}</label><input class="input" name="${h(name)}" value="${h(value)}" ${required ? "required" : ""}>${hint ? `<small>${h(hint)}</small>` : ""}</div>`;
}

function numberField(label, name, value, required = false, hint = "") {
  return `<div class="field"><label>${h(label)}${required ? "*" : ""}</label><input class="input" type="number" step="0.001" name="${h(name)}" value="${h(value)}" ${required ? "required" : ""}>${hint ? `<small>${h(hint)}</small>` : ""}</div>`;
}

function pricingOptionsHtml(selected, short = false) {
  return PRICING_TYPE_OPTIONS.map((opt) => `<option value="${opt.value}" ${selected === opt.value ? "selected" : ""}>${h(short ? opt.short : opt.label)}</option>`).join("");
}

function renderCustomers() {
  const q = route().query.get("q") || "";
  const includeInactive = route().query.get("inactive") === "1";
  const rows = state.customers.filter((item) => {
    const text = `${item.name} ${item.company_name} ${item.tax_id} ${item.phone}`.toLowerCase();
    return (includeInactive || item.is_active) && text.includes(q.toLowerCase());
  });
  return `
    ${pageHead("客戶", `共 ${rows.length} 位客戶`, `<a class="btn" href="${link("/customers/new")}">＋ 新增客戶</a>`)}
    <form class="toolbar" onsubmit="searchList(event,'/customers')">
      <input class="input" style="max-width:320px" name="q" value="${h(q)}" placeholder="搜尋名稱、公司、統編、電話…">
      <label class="checkbox-row"><input type="checkbox" name="inactive" ${includeInactive ? "checked" : ""}>含停用</label>
      <button class="btn secondary" type="submit">搜尋</button>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>名稱</th><th>公司 / 統編</th><th>電話</th><th>聯絡人</th><th>狀態</th></tr></thead>
      <tbody>${rows.map((item) => {
        const primary = item.contacts.find((c) => c.primary) || item.contacts[0];
        return `<tr>
          <td><a class="link-strong" href="${link(`/customers/${item.id}`)}">${h(item.name)}</a><div class="sub">${h(item.address)}</div></td>
          <td>${h(item.company_name)}<div class="sub">統編 ${h(item.tax_id)}</div></td>
          <td>${h(item.phone)}</td>
          <td>${primary ? h(primary.name) : "—"}</td>
          <td>${statusBadge(item.is_active ? "啟用" : "停用", item.is_active ? "green" : "")}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
  `;
}

function renderCustomerForm(customerId) {
  const item = customerId ? customerById(customerId) : null;
  const data = item || {
    name: "",
    phone: "",
    address: "",
    company_name: "",
    tax_id: "",
    invoice_title: "",
    contacts: [{ name: "", role: "", phone: "", email: "", notes: "", primary: true }],
    notes: "",
    is_active: true,
  };
  return `
    ${pageHead(item ? "編輯客戶" : "新增客戶", item ? "編輯客戶與聯絡資訊" : "建立一位客戶與公司資訊")}
    <form class="grid" onsubmit="saveCustomer(event,'${customerId || ""}')">
      <section class="card"><div class="card-header"><h2>基本資料</h2></div><div class="card-body form-grid">
        ${field("客戶 / 案場名稱", "name", data.name, true)}
        ${field("公司電話", "phone", data.phone)}
        <div class="field span-2"><label>地址</label><input class="input" name="address" value="${h(data.address)}"></div>
      </div></section>
      <section class="card"><div class="card-header"><h2>公司資訊 / 開立發票</h2></div><div class="card-body form-grid">
        ${field("公司名稱", "company_name", data.company_name)}
        ${field("統一編號", "tax_id", data.tax_id)}
        ${field("發票抬頭", "invoice_title", data.invoice_title, false, "若和公司名稱一樣可留空")}
      </div></section>
      <section class="card"><div class="card-header"><h2>聯絡人 (${data.contacts.length})</h2><button class="btn outline sm" type="button" onclick="addContact('${customerId || ""}')">＋ 新增聯絡人</button></div><div class="card-body">
        ${data.contacts.map((contact, index) => renderContactRow(contact, index)).join("")}
      </div></section>
      <section class="card"><div class="card-header"><h2>備註 / 偏好</h2></div><div class="card-body">
        <div class="field"><label>備註</label><textarea class="textarea" name="notes">${h(data.notes)}</textarea><small>客戶偏好、交貨備註、發票資訊等</small></div>
        <label class="checkbox-row" style="margin-top:12px"><input type="checkbox" name="is_active" ${data.is_active ? "checked" : ""}>啟用 (建立報價時可選此客戶)</label>
      </div><div class="card-footer">
        ${item ? `<button class="btn danger" type="button" onclick="deleteRecord('customers','${item.id}','/customers')">刪除</button>` : ""}
        <a class="btn outline" href="${link("/customers")}">取消</a>
        <button class="btn" type="submit">${item ? "儲存變更" : "建立"}</button>
      </div></section>
    </form>
  `;
}

function renderContactRow(contact, index) {
  return `<div class="row-card" style="display:block;margin-bottom:10px">
    <div class="form-grid cols-4">
      <div class="field"><label>姓名*</label><input class="input" name="contact_name_${index}" value="${h(contact.name)}" placeholder="必填"></div>
      <div class="field"><label>職稱</label><input class="input" name="contact_role_${index}" value="${h(contact.role)}" placeholder="例:採購、監造"></div>
      <div class="field"><label>電話</label><input class="input" name="contact_phone_${index}" value="${h(contact.phone)}"></div>
      <div class="field"><label>Email</label><input class="input" type="email" name="contact_email_${index}" value="${h(contact.email)}"></div>
      <div class="field span-4"><label>備註</label><input class="input" name="contact_notes_${index}" value="${h(contact.notes)}"></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
      <label class="checkbox-row"><input type="radio" name="contact_primary" value="${index}" ${contact.primary ? "checked" : ""}>主要聯絡人</label>
      <button class="btn outline sm" type="button" onclick="removeContact(${index})">刪除聯絡人</button>
    </div>
  </div>`;
}

function renderTemplates() {
  return `
    ${pageHead("報價單版本", "管理不同情境的報價單範本 (注意事項 / 付款條件 / 保固說明)", `<a class="btn" href="${link("/quote-templates/new")}">＋ 新增版本</a>`)}
    <div class="list-card">
      ${state.templates.map((tpl) => `<a class="row-card" href="${link(`/quote-templates/${tpl.id}`)}">
        <span><strong>${h(tpl.name)}</strong> ${tpl.is_default ? statusBadge("預設", "blue") : ""}<br><span class="muted">${h(tpl.description || "—")}</span><br><span class="sub">注意事項　${h((tpl.notes || "").slice(0, 42))}…</span><br><span class="sub">付款條件　${h(tpl.payments.map((p) => `${p.pct ? `${p.pct}% ` : ""}${p.text}`).join(" / "))}</span></span>
        <span>${statusBadge(tpl.is_active ? "啟用中" : "停用", tpl.is_active ? "green" : "")}</span>
      </a>`).join("")}
    </div>
  `;
}

function renderTemplateForm(templateId) {
  const item = templateId ? templateById(templateId) : null;
  const data = item || { name: "", description: "", notes: "", warranty: "", payments: [{ pct: "", text: "" }], laborItems: defaultLaborItems(), is_default: false, is_active: true };
  return `
    ${pageHead(item ? "編輯版本" : "新增報價單版本", item ? "修改版本" : "建立報價單版本範本")}
    <form class="grid" onsubmit="saveTemplate(event,'${templateId || ""}')">
      <section class="card"><div class="card-header"><h2>版本資料</h2></div><div class="card-body form-grid">
        ${field("版本名稱", "name", data.name, true, "例如:公版、工程版、室內裝修")}
        ${field("描述備註", "description", data.description, false, "不印在正式報價單")}
      </div></section>
      <section class="card"><div class="card-header"><h2>報價單條款與付款條件</h2></div><div class="card-body">
        <div class="field"><label>注意事項</label><textarea class="textarea" name="notes" placeholder="請輸入注意事項">${h(data.notes)}</textarea></div>
        <div class="field" style="margin-top:14px"><label>付款條件</label><small>百分比留空的列只顯示文字，不計金額。</small></div>
        ${data.payments.map((payment, index) => `<div class="labor-grid" style="grid-template-columns:100px 1fr 36px">
          <input class="input" type="number" name="payment_pct_${index}" value="${h(payment.pct)}" placeholder="百分比%">
          <input class="input" name="payment_text_${index}" value="${h(payment.text)}" placeholder="例:訂約金請於簽約時支付現金">
          <button class="icon-btn" type="button" onclick="removePayment(${index})">×</button>
        </div>`).join("")}
        <button class="btn outline sm" type="button" style="margin-top:10px" onclick="addPayment()">＋ 新增分期</button>
        <div class="field" style="margin-top:14px"><label>保固說明</label><textarea class="textarea" name="warranty" placeholder="例:本工程提供完工後 1 年保固。">${h(data.warranty)}</textarea></div>
      </div></section>
      <section class="card"><div class="card-header"><h2>工錢明細細項</h2><button class="btn outline sm" type="button" onclick="addTemplateLabor()">＋ 新增細項</button></div><div class="card-body">
        ${laborRows(data.laborItems, "tpl_labor")}
        <label class="checkbox-row" style="margin-top:14px"><input type="checkbox" name="is_default" ${data.is_default ? "checked" : ""}>設為預設版本</label>
        <label class="checkbox-row" style="margin-top:14px;margin-left:14px"><input type="checkbox" name="is_active" ${data.is_active ? "checked" : ""}>啟用</label>
      </div><div class="card-footer">
        ${item ? `<button class="btn danger" type="button" onclick="deleteRecord('templates','${item.id}','/quote-templates')">刪除</button>` : ""}
        <a class="btn outline" href="${link("/quote-templates")}">取消</a>
        <button class="btn" type="submit">${item ? "儲存變更" : "建立"}</button>
      </div></section>
    </form>
  `;
}

function laborRows(rows, prefix) {
  return rows.map((row, index) => `<div class="labor-grid">
    <input class="input" name="${prefix}_name_${index}" value="${h(row.name)}" placeholder="名稱 (例:零星工料)">
    <input class="input" name="${prefix}_unit_${index}" value="${h(row.unit || "式")}" placeholder="式">
    <input class="input" type="number" step="0.01" name="${prefix}_pct_${index}" value="${h(row.pct)}" placeholder="%">
    <input class="input" type="number" step="0.01" name="${prefix}_unit_price_${index}" value="${h(row.unit_price)}" placeholder="工資單價">
    <input class="input" type="number" step="0.01" name="${prefix}_manual_${index}" value="${h(row.manual_amount)}" placeholder="固定金額">
    <label class="checkbox-row"><input type="radio" name="${prefix}_balancer" value="${index}" ${row.is_balancer ? "checked" : ""}>餘額</label>
    <span class="muted"></span>
    <button class="icon-btn" type="button" onclick="removeLabor('${prefix}',${index})">×</button>
  </div>`).join("");
}

function renderQuotes(query) {
  const q = query.get("q") || "";
  const status = query.get("status") || "";
  const rows = state.quotes.filter((quote) => {
    const customer = customerById(quote.customer_id);
    const text = `${quote.quote_no} ${quote.title} ${quote.project_name} ${customer?.name} ${customer?.company_name}`.toLowerCase();
    return (!status || quote.status === status) && text.includes(q.toLowerCase());
  });
  return `
    ${pageHead("報價單", `共 ${rows.length} 張`, `<a class="btn" href="${link("/quotes/new")}">＋ 新增報價單</a>`)}
    <form class="toolbar" onsubmit="searchQuotes(event)">
      <input class="input" style="max-width:320px" name="q" value="${h(q)}" placeholder="搜尋報價單號、標題、案名…">
      <select class="select" style="max-width:170px" name="status">
        <option value="">全部狀態</option>${Object.entries(QUOTE_STATUS_LABEL).map(([value, label]) => `<option value="${value}" ${status === value ? "selected" : ""}>${label}</option>`).join("")}
      </select>
      <button class="btn secondary" type="submit">篩選</button>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>報價單號 / 日期</th><th>客戶 / 案名</th><th>標題</th><th>金額</th><th>狀態</th></tr></thead>
      <tbody>${rows.map((quote) => {
        const customer = customerById(quote.customer_id);
        const totals = computeQuote(quote);
        return `<tr>
          <td><a class="link-strong" href="${link(`/quotes/${quote.id}`)}">${h(quote.quote_no)}</a><div class="sub">${h(quote.quote_date)}</div></td>
          <td>${h(customer?.name || "—")}${quote.project_name ? `<div class="sub">${h(quote.project_name)}</div>` : ""}</td>
          <td>${h(quote.title || "—")}</td>
          <td class="amount">${money(totals.total)}</td>
          <td>${statusBadge(QUOTE_STATUS_LABEL[quote.status], quote.status === "won" ? "green" : quote.status === "sent" ? "blue" : "")}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
  `;
}

function ensureQuoteDraft(quoteId) {
  if (ui.quoteDraft && ui.quoteDraftSource === quoteId) return ui.quoteDraft;
  const existing = quoteId ? quoteById(quoteId) : null;
  ui.quoteDraftSource = quoteId;
  ui.quoteDraft = existing
    ? JSON.parse(JSON.stringify(existing))
    : {
        id: "",
        quote_no: nextQuoteNo(),
        customer_id: "",
        template_id: state.templates.find((tpl) => tpl.is_default)?.id || "",
        title: "",
        project_name: "",
        quote_date: dateToday(),
        valid_until: "",
        status: "draft",
        discount_amount: 0,
        tax_rate: state.company.defaultTaxRate || 5,
        extra_notes: "",
        sections: [blankSection()],
      };
  const tpl = templateById(ui.quoteDraft.template_id);
  if (tpl && !quoteId) ui.quoteDraft.sections[0].laborItems = JSON.parse(JSON.stringify(tpl.laborItems));
  return ui.quoteDraft;
}

function nextQuoteNo() {
  const count = state.quotes.filter((quote) => quote.quote_date === dateToday()).length + 1;
  return `Q-${dateToday().replaceAll("-", "")}-${String(count).padStart(3, "0")}`;
}
