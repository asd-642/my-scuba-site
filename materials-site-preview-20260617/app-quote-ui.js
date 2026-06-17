function renderQuoteForm(quoteId) {
  const draft = ensureQuoteDraft(quoteId);
  const totals = computeQuote(draft);
  const customer = customerById(draft.customer_id);
  const tpl = templateById(draft.template_id);
  return `
    ${pageHead(quoteId ? "編輯報價單" : "新增報價單", quoteId ? draft.quote_no : "選擇客戶與版本,加入材料明細,即時試算")}
    <form class="grid" onsubmit="saveQuote(event,'${quoteId || ""}')">
      <section class="card"><div class="card-header"><h2>報價單資訊</h2></div><div class="card-body form-grid">
        <div class="field picker-wrap"><label>客戶*</label>${pickerButton("customer", customer ? customer.name : "搜尋並選擇客戶…", customer ? `${customer.company_name} · ${customer.phone}` : "")}</div>
        <div class="field picker-wrap"><label>使用版本</label>${pickerButton("template", tpl ? tpl.name : "選擇版本", tpl ? tpl.description : "", true)}<small>選擇報價單版本範本 (注意事項/付款條件/保固/工錢細項)</small></div>
        ${quoteInput("報價單標題", "title", draft.title, "例:某某案場 二樓裝修報價")}
        ${quoteInput("案名", "project_name", draft.project_name)}
        ${quoteInput("報價日期", "quote_date", draft.quote_date, "", "date", true)}
        ${quoteInput("報價有效期至", "valid_until", draft.valid_until, "選填", "date")}
        <div class="field"><label>狀態</label><select class="select" data-quote-path="status" onchange="updateQuotePath(this)">${Object.entries(QUOTE_STATUS_LABEL).map(([value, label]) => `<option value="${value}" ${draft.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
      </div></section>
      <section class="card"><div class="card-header"><h2>工程項目 (${draft.sections.length})</h2><button class="btn outline sm" type="button" onclick="addQuoteSection()">＋ 新增工程項目</button></div><div class="card-body">
        ${draft.sections.map((section, index) => renderQuoteSection(section, totals.sections[index], index)).join("")}
      </div></section>
      <section class="card"><div class="card-header"><h2>金額計算</h2></div><div class="card-body split">
        <div class="form-grid">
          ${quoteInput("折讓金額", "discount_amount", draft.discount_amount, "直接從工程小計扣除", "number")}
          ${quoteInput("稅率 %", "tax_rate", draft.tax_rate, "例:5 表示加 5% 營業稅,0 = 含稅或免稅", "number")}
          <div class="field span-2"><label>本張覆蓋備註</label><textarea class="textarea" data-quote-path="extra_notes" oninput="updateQuotePath(this)">${h(draft.extra_notes)}</textarea><small>若想覆蓋版本範本的「注意事項」,可填這裡</small></div>
        </div>
        <div class="calc-box">
          ${draft.sections.map((section, index) => calcLine(`工程 #${index + 1} (${section.area_qty} ${section.unit})`, money(totals.sections[index].sectionTotal))).join("")}
          ${calcLine("工程小計", money(totals.subtotal))}
          ${totals.discount ? calcLine("折讓", `− ${money(totals.discount)}`) : ""}
          ${calcLine(`稅額 (${draft.tax_rate}% × ${money(Math.max(0, totals.subtotal - totals.discount))})`, `+ ${money(totals.tax)}`)}
          ${calcLine("合計", money(totals.total))}
        </div>
      </div><div class="card-footer">
        ${quoteId ? `<button class="btn danger" type="button" onclick="deleteRecord('quotes','${quoteId}','/quotes')">刪除</button>` : ""}
        <a class="btn outline" href="${link("/quotes")}">取消</a>
        <button class="btn" type="submit">${quoteId ? "儲存變更" : "建立報價單"}</button>
      </div></section>
    </form>
    ${renderMaterialDrawer()}
  `;
}

function quoteInput(label, pathName, value, hint = "", type = "text", required = false) {
  return `<div class="field"><label>${h(label)}${required ? "*" : ""}</label><input class="input" type="${type}" data-quote-path="${h(pathName)}" value="${h(value)}" ${required ? "required" : ""} oninput="updateQuotePath(this)">${hint ? `<small>${h(hint)}</small>` : ""}</div>`;
}

function pickerButton(type, text, sub = "", clearable = false) {
  const panel = ui.picker === type ? renderPickerPanel(type) : "";
  return `<button class="picker-btn" type="button" onclick="togglePicker('${type}')"><span><strong>${h(text)}</strong>${sub ? `<br><span class="sub">${h(sub)}</span>` : ""}</span><span>⌄</span></button>${clearable ? `<button class="btn outline sm" type="button" onclick="setQuotePicker('${type}','')">清除</button>` : ""}${panel}`;
}

function renderPickerPanel(type) {
  let items = [];
  if (type === "customer") {
    items = state.customers.filter((item) => item.is_active).map((item) => ({ id: item.id, title: item.name, sub: `${item.company_name} · ${item.phone}` }));
  }
  if (type === "template") {
    items = state.templates.filter((item) => item.is_active).map((item) => ({ id: item.id, title: item.name, sub: item.description }));
  }
  if (type === "material") {
    items = state.materials.filter((item) => item.is_active).map((item) => ({ id: item.id, title: item.name, sub: `${item.category} · #${item.code}` }));
  }
  const needle = ui.pickerSearch.toLowerCase();
  const filtered = items.filter((item) => `${item.title} ${item.sub}`.toLowerCase().includes(needle));
  return `<div class="picker-panel">
    <input class="input" placeholder="搜尋…" value="${h(ui.pickerSearch)}" oninput="updatePickerSearch(this.value)" autofocus>
    <div class="picker-list">
      ${filtered.length ? filtered.map((item) => `<button class="picker-option" type="button" onclick="setQuotePicker('${type}','${item.id}')"><strong>${h(item.title)}</strong><br><span class="sub">${h(item.sub)}</span></button>`).join("") : `<div class="empty">找不到符合的項目</div>`}
    </div>
  </div>`;
}

function renderQuoteSection(section, computed, index) {
  return `<div class="quote-section">
    <div class="quote-section-head">
      <button class="icon-btn" type="button" onclick="moveSection(${index},-1)" ${index === 0 ? "disabled" : ""}>↑</button>
      <button class="icon-btn" type="button" onclick="moveSection(${index},1)" ${index === ui.quoteDraft.sections.length - 1 ? "disabled" : ""}>↓</button>
      <button class="main-toggle" type="button"><strong>${h(section.name || `工程項目 #${index + 1}`)}</strong><span class="muted">${money(computed.unitCost)}/${h(section.unit)} × ${h(section.area_qty)}</span><span class="amount">${money(computed.sectionTotal)}</span></button>
      <button class="icon-btn" type="button" onclick="removeSection(${index})">×</button>
    </div>
    <div class="card-body">
      <div class="form-grid cols-4">
        ${sectionInput(index, "工程名稱", "name", section.name, "例:塑木天花", "text", true, "span-2")}
        ${sectionInput(index, "面積 / 數量", "area_qty", section.area_qty, "", "number", true)}
        ${sectionInput(index, "單位", "unit", section.unit, "M²")}
        <div class="field span-4"><label>規格 (印在報價單上)</label><textarea class="textarea" data-section="${index}" data-section-field="spec" oninput="updateSectionField(this)" placeholder="例:面板:塑木中空2.5*14.6cm 7號色 / 底樑:不鏽鋼">${h(section.spec)}</textarea></div>
      </div>
      <div style="margin-top:18px;display:flex;align-items:center;justify-content:space-between;gap:10px"><h3 style="margin:0;font-size:15px">材料明細 (${section.items.length}) — 以每 1 ${h(section.unit)} 用量計</h3><button class="btn outline sm" type="button" onclick="addQuoteItem(${index})">＋ 新增材料</button></div>
      ${section.items.map((item, itemIndex) => renderQuoteItem(item, computed.itemsComputed[itemIndex], index, itemIndex)).join("")}
      <div style="display:flex;justify-content:flex-end;margin:10px 4px 0"><span class="muted">材料小計 (每${h(section.unit)})</span><span class="amount" style="margin-left:12px">${money(computed.materialSubtotal)}</span></div>
      <div style="margin-top:18px;display:flex;align-items:center;justify-content:space-between;gap:10px"><h3 style="margin:0;font-size:15px">工錢明細 — 工錢總額 ${money(computed.laborSubtotal)} (每${h(section.unit)})</h3><button class="btn outline sm" type="button" onclick="addQuoteLabor(${index})">＋ 新增細項</button></div>
      ${computed.laborDist.items.map((row, laborIndex) => renderQuoteLabor(row, index, laborIndex)).join("")}
      <div class="calc-box" style="margin-top:14px;display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap"><span>每 ${h(section.unit)} 單價 <strong>${money(computed.unitCost)}</strong></span><span>×</span><span>${h(section.area_qty)} ${h(section.unit)}</span><span>=</span><span class="amount">${money(computed.sectionTotal)}</span></div>
    </div>
  </div>`;
}

function sectionInput(index, label, fieldName, value, placeholder = "", type = "text", required = false, cls = "") {
  return `<div class="field ${cls}"><label>${h(label)}${required ? "*" : ""}</label><input class="input" type="${type}" data-section="${index}" data-section-field="${fieldName}" oninput="updateSectionField(this)" value="${h(value)}" placeholder="${h(placeholder)}" ${required ? "required" : ""}></div>`;
}

function renderQuoteItem(item, computed, sectionIndex, itemIndex) {
  return `<div class="mini-row">
    <span class="muted">${itemIndex + 1}</span>
    <button type="button" style="border:0;background:transparent;text-align:left;cursor:pointer;min-width:0" onclick="openMaterialDrawer(${sectionIndex},${itemIndex})">
      <strong>${h(item.name || "(未命名)")}</strong> <span class="badge">${h(pricingLabel(item.pricing_type, true))}</span>
      <div class="sub">${computed.ok ? `${computed.priceableQty.toFixed(2)} ${h(item.unit)} @${money(item.unit_price)} ${money(computed.materialSubtotal)}` : "資料不全"}</div>
    </button>
    <button class="btn outline sm" type="button" onclick="openMaterialDrawer(${sectionIndex},${itemIndex})">編輯</button>
    <button class="icon-btn" type="button" onclick="removeQuoteItem(${sectionIndex},${itemIndex})">×</button>
  </div>`;
}

function renderQuoteLabor(row, sectionIndex, laborIndex) {
  return `<div class="labor-grid">
    <input class="input" value="${h(row.name)}" data-labor-section="${sectionIndex}" data-labor-index="${laborIndex}" data-labor-field="name" oninput="updateLaborField(this)" placeholder="名稱">
    <input class="input" value="${h(row.unit || "式")}" data-labor-section="${sectionIndex}" data-labor-index="${laborIndex}" data-labor-field="unit" oninput="updateLaborField(this)" placeholder="式">
    <input class="input" type="number" step="0.01" value="${h(row.pct)}" data-labor-section="${sectionIndex}" data-labor-index="${laborIndex}" data-labor-field="pct" oninput="updateLaborField(this)" placeholder="%" ${row.is_balancer ? "disabled" : ""}>
    <input class="input" type="number" step="0.01" value="${h(row.unit_price)}" data-labor-section="${sectionIndex}" data-labor-index="${laborIndex}" data-labor-field="unit_price" oninput="updateLaborField(this)" placeholder="工資/工">
    <input class="input" type="number" step="0.01" value="${h(row.manual_amount)}" data-labor-section="${sectionIndex}" data-labor-index="${laborIndex}" data-labor-field="manual_amount" oninput="updateLaborField(this)" placeholder="固定額" ${row.is_balancer ? "disabled" : ""}>
    <label class="checkbox-row"><input type="radio" name="labor_balancer_${sectionIndex}" ${row.is_balancer ? "checked" : ""} onchange="setLaborBalancer(${sectionIndex},${laborIndex})">餘額</label>
    <span class="amount">${money(row.amount)}</span>
    <button class="icon-btn" type="button" onclick="removeQuoteLabor(${sectionIndex},${laborIndex})">×</button>
  </div>`;
}

function renderMaterialDrawer() {
  const edit = ui.editingMaterial;
  if (!edit || !ui.quoteDraft) return "";
  const item = ui.quoteDraft.sections[edit.sectionIndex].items[edit.itemIndex];
  const computed = computeItem(item);
  const opt = pricingOption(item.pricing_type);
  return `<div class="drawer-backdrop" onclick="closeMaterialDrawer()"></div>
    <aside class="drawer">
      <div class="drawer-head"><span>編輯材料 #${edit.itemIndex + 1}(${ui.quoteDraft.sections[edit.sectionIndex].name || "工程"})</span><button class="icon-btn" onclick="closeMaterialDrawer()">×</button></div>
      <div class="drawer-body">
        <div class="field picker-wrap"><label>材料</label>${pickerButton("material", item.material_id ? materialById(item.material_id)?.name || "從材料庫選" : "從材料庫選 (或留空手動輸入)", item.material_id ? `${materialById(item.material_id)?.category || ""} · #${materialById(item.material_id)?.code || ""}` : "")}<small>選材料會自動帶入預設值,可再覆寫</small></div>
        <div class="form-grid cols-4" style="margin-top:14px">
          ${drawerInput("品名", "name", item.name, "必填", "text", "span-2")}
          ${drawerInput("顯示單位", "unit", item.unit, "", "text")}
          <div class="field"><label>計價方式</label><select class="select" data-item-field="pricing_type" onchange="updateItemField(this)">${PRICING_TYPE_OPTIONS.map((p) => `<option value="${p.value}" ${item.pricing_type === p.value ? "selected" : ""}>${h(p.short)}</option>`).join("")}</select></div>
        </div>
        ${item.pricing_type === "wood_tsai" || item.pricing_type === "wood_board_tsai" ? `<div class="hint amber" style="margin-top:12px">${h(opt.hint)}</div>` : ""}
        ${opt.needsWall ? `<div class="hint" style="margin-top:12px">${h(opt.hint)}</div>` : ""}
        <div class="form-grid cols-4" style="margin-top:14px">
          ${drawerInput(`${dimLabel(item.pricing_type, "thickness")} (cm)`, "thickness", item.thickness, opt.needs.thickness ? "影響計算" : "參考用", "number")}
          ${drawerInput(`${dimLabel(item.pricing_type, "width")} (cm)`, "width", item.width, opt.needs.width ? "影響計算" : "參考用", "number")}
          ${drawerInput(`${dimLabel(item.pricing_type, "length")} (cm)`, "length", item.length, opt.needs.length ? "影響計算" : "參考用", "number")}
          ${drawerInput("數量 (每單位)", "quantity", item.quantity, "", "number")}
          ${opt.needsWall ? `${drawerInput("壁厚 (mm)", "wall_thickness_mm", item.wall_thickness_mm, "例 2", "number")}${drawerInput("重量換算係數", "density_factor", item.density_factor, "0.02466", "number")}` : ""}
          ${drawerInput(opt.needsWall ? "材料單價 (元/kg)" : "材料單價", "unit_price", item.unit_price, "", "number")}
          ${drawerInput("材料損料 %", "waste_pct", item.waste_pct, "", "number")}
          ${drawerInput("工錢單價", "labor_unit_price", item.labor_unit_price, "", "number")}
          ${drawerInput("工錢損料 %", "labor_waste_pct", item.labor_waste_pct, "同材料", "number")}
        </div>
        <div class="field" style="margin-top:14px"><label>工錢計價方式</label><select class="select" data-item-field="labor_pricing_type" onchange="updateItemField(this)"><option value="">與材料相同</option>${PRICING_TYPE_OPTIONS.map((p) => `<option value="${p.value}" ${item.labor_pricing_type === p.value ? "selected" : ""}>${h(p.short)}</option>`).join("")}</select><small>留「與材料相同」最常見;例:鋼管材料按 kg、工錢按板才。</small></div>
        <div class="field" style="margin-top:14px"><label>備註</label><input class="input" data-item-field="notes" value="${h(item.notes)}" oninput="updateItemField(this)" placeholder="(選填)"></div>
        <div class="calc-box" style="margin-top:14px">
          ${computed.ok ? `${calcLine("計價量", `${computed.priceableQty.toFixed(3)} ${item.unit}${computed.wasteQty ? ` (+損 ${computed.wasteQty.toFixed(3)})` : ""}`)}${calcLine("材料", money(computed.materialSubtotal))}${calcLine("工錢", computed.laborSubtotal ? money(computed.laborSubtotal) : "—")}${calcLine("小計", money(computed.subtotal))}` : `<div class="hint amber">${h(computed.message)}</div>`}
        </div>
      </div>
      <div class="drawer-foot"><button class="btn danger" onclick="removeQuoteItem(${edit.sectionIndex},${edit.itemIndex})">刪除此項</button><button class="btn" onclick="closeMaterialDrawer()">完成</button></div>
    </aside>`;
}

function drawerInput(label, fieldName, value, hint = "", type = "text", cls = "") {
  return `<div class="field ${cls}"><label>${h(label)}</label><input class="input" type="${type}" step="0.001" data-item-field="${fieldName}" value="${h(value)}" oninput="updateItemField(this)" placeholder="${h(hint)}">${hint && type !== "number" ? `<small>${h(hint)}</small>` : ""}</div>`;
}
