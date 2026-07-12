const MATERIAL_UNIT_OPTIONS = ["件", "個", "組", "片", "才", "平", "坪", "支", "枝", "米", "公尺", "尺", "KG", "噸", "式", "批"];

function renderMaterialForm(materialId) {
  if (!canEditMaterialPrices()) return renderAccessDenied();
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
    formula_version: "legacy-v1",
    cost_price: "",
    price_effective_date: dateToday(),
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
        ${unitField(data.unit)}
      </div></section>
      <section class="card"><div class="card-header"><h2>計價方式與規格</h2></div><div class="card-body">
        <div class="form-grid cols-4">
          <div class="field span-4"><label>計價類型*</label><select class="select" name="pricing_type">${pricingOptionsHtml(data.pricing_type)}</select><small>${h(opt.hint)} 儲存後會依選擇的計價類型顯示對應說明。</small></div>
          ${numberField(dimLabel(data.pricing_type, "thickness"), "default_thickness", data.default_thickness, false, "公分")}
          ${numberField(dimLabel(data.pricing_type, "width"), "default_width", data.default_width, false, "公分")}
          ${numberField(dimLabel(data.pricing_type, "length"), "default_length", data.default_length, false, "公分")}
          ${numberField("重量", "default_weight", data.default_weight, false, "公斤 (kg)")}
          ${numberField("壁厚", "wall_thickness_mm", data.wall_thickness_mm, false, "公釐 (mm)；方管與圓管公式使用")}
          ${numberField("重量換算係數", "density_factor", data.density_factor, false, "管材公式使用；碳鋼預設 0.02466")}
        </div>
      </div></section>
      <section class="card"><div class="card-header"><h2>價格與公式版本</h2></div><div class="card-body form-grid cols-4">
        ${numberField("成本價", "cost_price", data.cost_price, false, "供應商或內部成本；留空表示尚未建立成本")}
        ${numberField("報價單價", "unit_price", data.unit_price, true, "帶入報價單的每單位價格")}
        <div class="field"><label>價格生效日</label><input class="input" type="date" name="price_effective_date" value="${h(data.price_effective_date || "")}"><small>保留價格來源日期</small></div>
        <div class="field"><label>公式版本</label><input class="input" value="${h(data.formula_version || "legacy-v1")}" disabled><input type="hidden" name="formula_version" value="${h(data.formula_version || "legacy-v1")}"><small>目前沿用既有公式，正式公式確認後再建立新版</small></div>
        ${numberField("材料損料 %", "waste_pct", data.waste_pct, false, "例:5 表示加 5%,報價時可覆寫")}
        ${numberField("工錢單價", "labor_unit_price", data.labor_unit_price, false, "每單位的人工費用,0 表示不計工錢")}
        ${numberField("工錢損料 %", "labor_waste_pct", data.labor_waste_pct, false, "留空 = 與材料損料相同")}
        <div class="field span-4"><label>工錢計價方式</label><select class="select" name="labor_pricing_type"><option value="">與材料相同</option>${pricingOptionsHtml(data.labor_pricing_type, true)}</select><small>多數情況留「與材料相同」;例:鋼管材料按 kg、工錢按板才。</small></div>
        <div class="field span-4"><div class="hint amber">公式版本 <strong>legacy-v1</strong> 代表目前網站既有算法。未經公司正式核算前不自動改寫工程公式；報價寄出時會記錄本次使用的版本與輸入值。</div></div>
      </div></section>
      <section class="card"><div class="card-header"><h2>其他</h2></div><div class="card-body">
        <div class="field"><label>備註</label><textarea class="textarea" name="notes">${h(data.notes)}</textarea></div>
        <label class="checkbox-row" style="margin-top:12px"><input type="checkbox" name="is_active" ${data.is_active ? "checked" : ""}>啟用 (建報價時可選此材料)</label>
      </div><div class="card-footer">
        ${item && canDeleteCollection("materials") ? `<button class="btn danger" type="button" onclick="deleteRecord('materials','${item.id}','/materials')">刪除</button>` : ""}
        <a class="btn outline" href="${link("/materials")}">取消</a>
        <button class="btn" type="submit">${item ? "儲存變更" : "建立"}</button>
      </div></section>
    </form>
  `;
}

function field(label, name, value, required = false, hint = "") {
  return `<div class="field"><label>${h(label)}${required ? "*" : ""}</label><input class="input" name="${h(name)}" value="${h(value)}" ${required ? "required" : ""}>${hint ? `<small>${h(hint)}</small>` : ""}</div>`;
}

function unitField(value) {
  return `<div class="field"><label>顯示單位*</label><select class="select" name="unit" required>${unitOptionsHtml(value)}</select><small>請從清單選擇，避免單位輸入不一致</small></div>`;
}

function unitOptionsHtml(selected) {
  const current = String(selected || "").trim();
  const options = current && !MATERIAL_UNIT_OPTIONS.includes(current) ? [current, ...MATERIAL_UNIT_OPTIONS] : MATERIAL_UNIT_OPTIONS;
  return options.map((unit) => `<option value="${h(unit)}" ${current === unit ? "selected" : ""}>${h(unit)}</option>`).join("");
}

function numberField(label, name, value, required = false, hint = "") {
  return `<div class="field"><label>${h(label)}${required ? "*" : ""}</label><input class="input" type="number" step="0.001" name="${h(name)}" value="${h(value)}" ${required ? "required" : ""}>${hint ? `<small>${h(hint)}</small>` : ""}</div>`;
}

function pricingOptionsHtml(selected, short = false) {
  return PRICING_TYPE_OPTIONS.map((opt) => `<option value="${opt.value}" ${selected === opt.value ? "selected" : ""}>${h(short ? opt.short : opt.label)}</option>`).join("");
}

function renderCustomers() {
  const q = route().query.get("q") || "";
  const customerFilter = route().query.get("customer_filter") || "";
  const rows = state.customers.filter((item) => {
    const text = `${item.name} ${item.company_name} ${item.tax_id} ${item.phone}`.toLowerCase();
    if (!text.includes(q.toLowerCase())) return false;
    if (customerFilter === "reviewed") return item.review_status !== "unreviewed";
    if (customerFilter === "unreviewed") return item.review_status === "unreviewed";
    if (customerFilter === "needs_attention") return customerDataQualityIssues(item).length > 0 || (item.duplicate_candidate_ids || []).length > 0;
    if (customerFilter === "active") return item.is_active !== false;
    if (customerFilter === "inactive") return item.is_active === false;
    return true;
  });
  const filterOptions = [
    ["", "全部客戶"],
    ["reviewed", "已審核"],
    ["unreviewed", "未審核"],
    ["needs_attention", "需補正 / 疑似重複"],
    ["active", "已啟用"],
    ["inactive", "未啟用"],
  ];
  return `
    ${pageHead("客戶", `共 ${rows.length} 位客戶`, `<a class="btn" href="${link("/customers/new")}">＋ 新增客戶</a>`)}
    <form class="toolbar" onsubmit="searchList(event,'/customers')">
      <input class="input" style="max-width:320px" name="q" value="${h(q)}" placeholder="搜尋名稱、公司、統編、電話…">
      <label class="field-inline">
        <span>綜合篩選</span>
        <select class="select" name="customer_filter">
          ${filterOptions.map(([value, label]) => `<option value="${value}" ${customerFilter === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </label>
      <button class="btn secondary" type="submit">搜尋</button>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>名稱</th><th>公司 / 統編</th><th>電話</th><th>聯絡人</th><th>審核</th><th>狀態</th></tr></thead>
      <tbody>${rows.map((item) => {
        const primary = item.contacts.find((c) => c.primary) || item.contacts[0];
        const qualityIssues = customerDataQualityIssues(item);
        const duplicateCount = (item.duplicate_candidate_ids || []).length;
        return `<tr>
          <td><a class="link-strong" href="${link(`/customers/${item.id}`)}">${h(item.name)}</a><div class="sub">${h(item.address)}</div></td>
          <td>${h(item.company_name)}<div class="sub">統編 ${h(item.tax_id)}</div></td>
          <td>${h(item.phone)}</td>
          <td>${primary ? h(primary.name) : "—"}</td>
          <td><div class="badge-stack">${customerReviewBadge(item)}${qualityIssues.length ? statusBadge(`需補正 ${qualityIssues.length}`, "amber") : ""}${duplicateCount ? statusBadge("疑似重複", "amber") : ""}</div></td>
          <td>${statusBadge(item.is_active ? "啟用" : "停用", item.is_active ? "green" : "")}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
  `;
}

function customerReviewBadge(customer) {
  const unreviewed = customer?.review_status === "unreviewed";
  return statusBadge(unreviewed ? "未審核" : "已審核", unreviewed ? "amber" : "green");
}

function renderCustomerCardImportPanel(cardData) {
  if (!canUseCustomerOcr()) return "";
  const cardJson = cardData ? JSON.stringify(customerCardPayloadFromCustomer(cardData), null, 2) : "";
  return `<section class="card customer-card-import"><div class="card-header"><h2>名片資料匯入</h2><a class="btn outline sm" href="${h(buildCustomerOcrUrl())}" target="_blank" rel="noreferrer">開啟名片辨識工具</a></div><div class="card-body">
    ${cardData ? `<div class="hint" style="margin-bottom:12px">已從名片辨識連結帶入資料，請確認欄位後再儲存。</div>` : ""}
    <div class="field"><label>貼上名片 JSON</label><textarea class="textarea" id="customer-card-json" placeholder='{"company_name":"公司名稱","contact_name":"聯絡人","phone":"公司電話","address":"地址"}'>${h(cardJson)}</textarea><small>從 OCR 小工具複製 JSON 後貼上，按「套用到表單」即可預填欄位。</small></div>
    <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
      <span id="customer-card-import-status" class="sub" aria-live="polite"></span>
      <button class="btn secondary" type="button" onclick="applyCustomerCardJson()">套用到表單</button>
    </div>
  </div></section>`;
}

function customerBusinessCardImages(customer) {
  const images = [];
  const pushImage = (image) => {
    const src = image?.data_url || image?.dataUrl || image?.src || image?.url || "";
    if (!src || images.some((item) => (item.data_url || item.dataUrl || item.src || item.url || "") === src)) return;
    images.push(image);
  };
  (customer?.business_card_images || []).forEach(pushImage);
  pushImage(customer?.business_card_image);
  return images;
}

function customerBusinessCardImage(customer) {
  return customerBusinessCardImages(customer)[0] || null;
}

function renderCustomerBusinessCardAction(customer) {
  if (!customerBusinessCardImages(customer).length) return "";
  return `<button class="btn outline sm" type="button" onclick="openCustomerBusinessCard('${h(customer.id)}')">查看名片</button>`;
}

function renderCustomerBatchImportPanel() {
  if (!canUseCustomerOcr()) return "";
  return `<section class="card customer-card-batch-import"><div class="card-header"><h2>批量名片匯入</h2></div><div class="card-body">
    <div class="field">
      <label>一次選擇多張名片照片</label>
      <input class="input" id="customer-batch-card-files" type="file" accept="image/*" multiple>
      <small>批量建立的客戶會先標示為「未審核」，進入編輯頁確認後按儲存變更，才會轉成「已審核」。</small>
    </div>
    <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
      <span id="customer-batch-card-import-status" class="sub" aria-live="polite"></span>
      <button class="btn secondary" id="customer-batch-card-import-btn" type="button" onclick="importCustomerCardsBatch()">批量匯入客戶</button>
    </div>
  </div></section>`;
}

function normalizeCustomerFormData(source) {
  const fallbackContact = { name: "", role: "", phone: "", email: "", notes: "", primary: true };
  const contacts = Array.isArray(source?.contacts) && source.contacts.length ? source.contacts : [fallbackContact];
  return {
    ...(source || {}),
    name: source?.name || source?.company_name || contacts[0]?.name || "",
    phone: source?.phone || "",
    address: source?.address || "",
    company_name: source?.company_name || source?.name || "",
    tax_id: source?.tax_id || "",
    invoice_title: source?.invoice_title || "",
    contacts,
    notes: source?.notes || "",
    is_active: source?.is_active !== false,
  };
}

function renderCustomerForm(customerId) {
  const item = customerId ? customerById(customerId) : null;
  const importedCard = item || !canUseCustomerOcr() ? null : customerCardFromRoute();
  const data = normalizeCustomerFormData(item || importedCard);
  const qualityIssues = item ? customerDataQualityIssues(item) : [];
  const duplicateNames = item ? (item.duplicate_candidate_ids || []).map((id) => customerById(id)?.company_name || customerById(id)?.name).filter(Boolean) : [];
  return `
    ${pageHead(item ? "編輯客戶" : "新增客戶", item ? "編輯客戶與聯絡資訊" : "建立一位客戶與公司資訊")}
    <form class="grid" onsubmit="saveCustomer(event,'${customerId || ""}')">
      ${qualityIssues.length || duplicateNames.length ? `<div class="hint amber"><strong>儲存前請確認：</strong> ${h([...qualityIssues, ...(duplicateNames.length ? [`疑似與 ${duplicateNames.join("、")} 重複`] : [])].join("；"))}</div>` : ""}
      ${item ? "" : renderCustomerCardImportPanel(importedCard)}
      ${item ? "" : renderCustomerBatchImportPanel()}
      <section class="card"><div class="card-header"><h2>基本資料</h2>${item ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${customerReviewBadge(item)}${renderCustomerBusinessCardAction(item)}</div>` : ""}</div><div class="card-body form-grid">
        ${field("客戶顯示名稱", "name", data.name, true, "案場名稱請在各張報價單中填寫")}
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
        ${item && canDeleteCollection("customers") ? `<button class="btn danger" type="button" onclick="deleteRecord('customers','${item.id}','/customers')">刪除</button>` : ""}
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
  const canEdit = canEditQuoteTemplates();
  return `
    ${pageHead("報價單版本", "管理不同情境的報價單範本 (注意事項 / 付款條件 / 保固說明)", canEdit ? `<a class="btn" href="${link("/quote-templates/new")}">＋ 新增版本</a>` : "")}
    <div class="list-card">
      ${state.templates.map((tpl) => {
        const tag = canEdit ? "a" : "div";
        const href = canEdit ? ` href="${link(`/quote-templates/${tpl.id}`)}"` : "";
        return `<${tag} class="row-card"${href}>
        <span><strong>${h(tpl.name)}</strong> ${tpl.is_default ? statusBadge("預設", "blue") : ""}<br><span class="muted">${h(tpl.description || "—")}</span><br><span class="sub">注意事項　${h((tpl.notes || "").slice(0, 42))}…</span><br><span class="sub">付款條件　${h(tpl.payments.map((p) => `${p.pct ? `${p.pct}% ` : ""}${p.text}`).join(" / "))}</span></span>
        <span>${statusBadge(tpl.is_active ? "啟用中" : "停用", tpl.is_active ? "green" : "")}</span>
      </${tag}>`;
      }).join("")}
    </div>
  `;
}

function renderTemplateForm(templateId) {
  if (!canEditQuoteTemplates()) return renderAccessDenied();
  const item = templateId ? templateById(templateId) : null;
  const data = item || currentTemplateForEdit();
  if (!Array.isArray(data.payments) || !data.payments.length) data.payments = [{ pct: "", text: "" }];
  if (!Array.isArray(data.laborItems) || !data.laborItems.length) data.laborItems = defaultLaborItems();
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
        ${item && canDeleteCollection("templates") ? `<button class="btn danger" type="button" onclick="deleteRecord('templates','${item.id}','/quote-templates')">刪除</button>` : ""}
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
    const owner = accountById(quote.owner_id);
    const text = `${quote.quote_no} ${quoteRevisionLabel(quote)} ${quote.title} ${quote.project_name} ${customer?.name} ${customer?.company_name} ${owner?.name}`.toLowerCase();
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
      <thead><tr><th>報價單號 / 版次</th><th>客戶 / 案名</th><th>負責人 / 追蹤</th><th>金額</th><th>狀態</th></tr></thead>
      <tbody>${rows.map((quote) => {
        const customer = customerById(quote.customer_id);
        const owner = accountById(quote.owner_id);
        const totals = quoteDocumentContext(quote).totals;
        return `<tr class="${quote.is_superseded ? "is-superseded" : ""}">
          <td><a class="link-strong" href="${link(`/quotes/${quote.id}`)}">${h(quote.quote_no)}</a><div class="sub">${h(quoteRevisionLabel(quote))} · ${h(quote.quote_date)}</div></td>
          <td>${h(customer?.name || "—")}${quote.project_name ? `<div class="sub">${h(quote.project_name)}</div>` : ""}</td>
          <td>${h(owner?.name || "—")}<div class="sub">${quote.next_follow_up ? `追蹤 ${h(quote.next_follow_up)}` : "未設定追蹤日"}</div></td>
          <td class="amount">${money(totals.total)}</td>
          <td>${statusBadge(quote.is_superseded ? "已有新版" : QUOTE_STATUS_LABEL[quote.status], quote.status === "won" ? "green" : quote.status === "sent" || quote.status === "pending_approval" ? "blue" : "")}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
  `;
}

function ensureQuoteDraft(quoteId) {
  const source = quoteId || "new";
  if (ui.quoteDraft && ui.quoteDraftSource === source) return ui.quoteDraft;
  const existing = quoteId ? quoteById(quoteId) : null;
  const stored = loadStoredQuoteDraft(source);
  ui.quoteDraftSource = source;
  ui.quoteDraftRestored = Boolean(stored?.draft);
  ui.quoteDraftSavedAt = stored?.saved_at || "";
  ui.quoteDraftDirty = Boolean(stored?.draft);
  ui.quoteDraft = stored?.draft
    ? normalizeQuoteRecord(JSON.parse(JSON.stringify(stored.draft)))
    : existing
      ? normalizeQuoteRecord(JSON.parse(JSON.stringify(existing)))
      : normalizeQuoteRecord({
        id: "",
        quote_no: nextQuoteNo(),
        customer_id: "",
        template_id: state.templates.find((tpl) => tpl.is_default)?.id || "",
        title: "",
        project_name: "",
        project_address: "",
        project_contact: "",
        quote_date: dateToday(),
        valid_until: MaterialsQuoteDomain.addCalendarDays(dateToday(), 7),
        status: "draft",
        owner_id: currentUser()?.id || "",
        next_follow_up: MaterialsQuoteDomain.addCalendarDays(dateToday(), 3),
        lost_reason: "",
        discount_amount: 0,
        tax_rate: state.company.defaultTaxRate || 5,
        extra_notes: "",
        sections: [blankSection()],
      });
  const tpl = templateById(ui.quoteDraft.template_id);
  if (tpl && !quoteId && !stored?.draft) ui.quoteDraft.sections[0].laborItems = JSON.parse(JSON.stringify(tpl.laborItems));
  if (!existing && !stored?.draft) saveStoredQuoteDraft(false);
  return ui.quoteDraft;
}

function nextQuoteNo() {
  return previewNextQuoteNo(dateToday());
}
