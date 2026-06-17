window.toggleAuthMode = function () {
  ui.authMode = ui.authMode === "login" ? "register" : "login";
  render();
};

window.login = function (event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  if (form.get("email") === DEMO_EMAIL && form.get("password") === DEMO_PASSWORD) {
    localStorage.setItem(AUTH_KEY, "yes");
    go("/dashboard");
    return;
  }
  setToast("帳號或密碼錯誤");
};

window.register = function (event) {
  event.preventDefault();
  localStorage.setItem(AUTH_KEY, "yes");
  setToast("已建立示範帳號");
  go("/dashboard");
};

window.logout = function () {
  localStorage.removeItem(AUTH_KEY);
  ui.accountOpen = false;
  ui.quoteDraft = null;
  go("/login");
};

window.toggleSidebar = function () {
  ui.sidebarCollapsed = !ui.sidebarCollapsed;
  render();
};

window.toggleAccount = function () {
  ui.accountOpen = !ui.accountOpen;
  render();
};

window.resetDemo = function () {
  state = seedData();
  saveState();
  ui.quoteDraft = null;
  setToast("示範資料已重置");
  render();
};

window.searchList = function (event, path) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const params = new URLSearchParams();
  if (form.get("q")) params.set("q", form.get("q"));
  if (form.get("inactive")) params.set("inactive", "1");
  go(`${path}${params.toString() ? `?${params}` : ""}`);
};

window.searchQuotes = function (event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const params = new URLSearchParams();
  if (form.get("q")) params.set("q", form.get("q"));
  if (form.get("status")) params.set("status", form.get("status"));
  go(`/quotes${params.toString() ? `?${params}` : ""}`);
};

window.saveMaterial = function (event, materialId) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const payload = {
    id: materialId || id("m"),
    name: data.name,
    code: data.code,
    category: data.category,
    unit: data.unit,
    pricing_type: data.pricing_type,
    default_thickness: data.default_thickness,
    default_width: data.default_width,
    default_length: data.default_length,
    default_weight: data.default_weight,
    wall_thickness_mm: data.wall_thickness_mm,
    density_factor: data.density_factor || 0.02466,
    unit_price: n(data.unit_price),
    waste_pct: n(data.waste_pct),
    labor_unit_price: n(data.labor_unit_price),
    labor_waste_pct: data.labor_waste_pct,
    labor_pricing_type: data.labor_pricing_type,
    notes: data.notes,
    is_active: Boolean(data.is_active),
  };
  upsert("materials", payload);
  go("/materials");
  setToast(materialId ? "材料已更新" : "材料已建立");
};

window.saveCustomer = function (event, customerId) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const existing = customerId ? customerById(customerId) : { contacts: [{ primary: true }] };
  const contacts = existing.contacts.map((_, index) => ({
    name: form.get(`contact_name_${index}`) || "",
    role: form.get(`contact_role_${index}`) || "",
    phone: form.get(`contact_phone_${index}`) || "",
    email: form.get(`contact_email_${index}`) || "",
    notes: form.get(`contact_notes_${index}`) || "",
    primary: String(index) === String(form.get("contact_primary")),
  }));
  const payload = {
    id: customerId || id("c"),
    name: form.get("name"),
    phone: form.get("phone"),
    address: form.get("address"),
    company_name: form.get("company_name"),
    tax_id: form.get("tax_id"),
    invoice_title: form.get("invoice_title"),
    contacts: contacts.length ? contacts : [{ name: "", primary: true }],
    notes: form.get("notes"),
    is_active: Boolean(form.get("is_active")),
  };
  upsert("customers", payload);
  go("/customers");
  setToast(customerId ? "客戶已更新" : "客戶已建立");
};

window.addContact = function (customerId) {
  const target = customerId ? customerById(customerId) : null;
  if (target) {
    target.contacts.push({ name: "", role: "", phone: "", email: "", notes: "", primary: false });
    saveState();
  }
  render();
};

window.removeContact = function (index) {
  const r = route();
  const customer = r.parts[1] ? customerById(r.parts[1]) : null;
  if (customer && customer.contacts.length > 1) {
    customer.contacts.splice(index, 1);
    if (!customer.contacts.some((c) => c.primary)) customer.contacts[0].primary = true;
    saveState();
  }
  render();
};

window.saveTemplate = function (event, templateId) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const existing = templateId ? templateById(templateId) : { payments: [{ pct: "", text: "" }], laborItems: defaultLaborItems() };
  const payments = existing.payments.map((_, index) => ({
    pct: form.get(`payment_pct_${index}`),
    text: form.get(`payment_text_${index}`),
  })).filter((row) => row.pct !== "" || row.text !== "");
  const laborItems = existing.laborItems.map((_, index) => ({
    name: form.get(`tpl_labor_name_${index}`) || "",
    unit: form.get(`tpl_labor_unit_${index}`) || "式",
    pct: form.get(`tpl_labor_pct_${index}`) || "",
    unit_price: form.get(`tpl_labor_unit_price_${index}`) || "",
    manual_amount: form.get(`tpl_labor_manual_${index}`) || "",
    is_balancer: String(index) === String(form.get("tpl_labor_balancer")),
  }));
  const payload = {
    id: templateId || id("t"),
    name: form.get("name"),
    description: form.get("description"),
    notes: form.get("notes"),
    warranty: form.get("warranty"),
    payments: payments.length ? payments : [{ pct: "", text: "" }],
    laborItems,
    is_default: Boolean(form.get("is_default")),
    is_active: Boolean(form.get("is_active")),
  };
  if (payload.is_default) state.templates.forEach((item) => (item.is_default = false));
  upsert("templates", payload);
  go("/quote-templates");
  setToast(templateId ? "版本已更新" : "版本已建立");
};

window.addPayment = function () {
  const tpl = currentTemplateForEdit();
  tpl.payments.push({ pct: "", text: "" });
  saveState();
  render();
};

window.removePayment = function (index) {
  const tpl = currentTemplateForEdit();
  if (tpl.payments.length > 1) tpl.payments.splice(index, 1);
  saveState();
  render();
};

window.addTemplateLabor = function () {
  const tpl = currentTemplateForEdit();
  tpl.laborItems.push({ name: "", unit: "式", pct: "", unit_price: "", manual_amount: "", is_balancer: false });
  saveState();
  render();
};

window.removeLabor = function (prefix, index) {
  const tpl = currentTemplateForEdit();
  if (prefix === "tpl_labor" && tpl.laborItems.length > 1) tpl.laborItems.splice(index, 1);
  saveState();
  render();
};

function currentTemplateForEdit() {
  const r = route();
  if (r.parts[1] && r.parts[1] !== "new") return templateById(r.parts[1]);
  if (!ui.tempTemplate) ui.tempTemplate = { payments: [{ pct: "", text: "" }], laborItems: defaultLaborItems() };
  return ui.tempTemplate;
}

window.deleteRecord = function (collection, recordId, redirect) {
  if (!confirm("確定要刪除?此操作無法復原。")) return;
  state[collection] = state[collection].filter((item) => item.id !== recordId);
  saveState();
  ui.quoteDraft = null;
  go(redirect);
  setToast("已刪除");
};

function upsert(collection, payload) {
  const index = state[collection].findIndex((item) => item.id === payload.id);
  if (index >= 0) state[collection][index] = payload;
  else state[collection].push(payload);
  saveState();
}

window.togglePicker = function (type) {
  ui.picker = ui.picker === type ? null : type;
  ui.pickerSearch = "";
  render();
};

window.updatePickerSearch = function (value) {
  ui.pickerSearch = value;
  render();
};

window.setQuotePicker = function (type, value) {
  const draft = ui.quoteDraft;
  if (!draft) return;
  if (type === "customer") draft.customer_id = value;
  if (type === "template") {
    draft.template_id = value;
    const tpl = templateById(value);
    if (tpl) draft.sections.forEach((section) => (section.laborItems = JSON.parse(JSON.stringify(tpl.laborItems))));
  }
  if (type === "material" && ui.editingMaterial) {
    const mat = materialById(value);
    const item = mat ? itemFromMaterial(mat.id) : blankItem();
    draft.sections[ui.editingMaterial.sectionIndex].items[ui.editingMaterial.itemIndex] = item;
  }
  ui.picker = null;
  ui.pickerSearch = "";
  render();
};

window.updateQuotePath = function (el) {
  if (!ui.quoteDraft) return;
  ui.quoteDraft[el.dataset.quotePath] = el.value;
  render();
};

window.updateSectionField = function (el) {
  const section = ui.quoteDraft.sections[Number(el.dataset.section)];
  section[el.dataset.sectionField] = el.value;
  render();
};

window.updateLaborField = function (el) {
  const row = ui.quoteDraft.sections[Number(el.dataset.laborSection)].laborItems[Number(el.dataset.laborIndex)];
  row[el.dataset.laborField] = el.value;
  render();
};

window.setLaborBalancer = function (sectionIndex, laborIndex) {
  ui.quoteDraft.sections[sectionIndex].laborItems.forEach((row, index) => (row.is_balancer = index === laborIndex));
  render();
};

window.addQuoteSection = function () {
  ui.quoteDraft.sections.push(blankSection());
  render();
};

window.removeSection = function (index) {
  if (ui.quoteDraft.sections.length > 1) ui.quoteDraft.sections.splice(index, 1);
  render();
};

window.moveSection = function (index, delta) {
  const target = index + delta;
  const sections = ui.quoteDraft.sections;
  if (target < 0 || target >= sections.length) return;
  [sections[index], sections[target]] = [sections[target], sections[index]];
  render();
};

window.addQuoteItem = function (sectionIndex) {
  ui.quoteDraft.sections[sectionIndex].items.push(blankItem());
  ui.editingMaterial = { sectionIndex, itemIndex: ui.quoteDraft.sections[sectionIndex].items.length - 1 };
  render();
};

window.removeQuoteItem = function (sectionIndex, itemIndex) {
  const items = ui.quoteDraft.sections[sectionIndex].items;
  if (items.length > 1) items.splice(itemIndex, 1);
  else items[0] = blankItem();
  ui.editingMaterial = null;
  render();
};

window.addQuoteLabor = function (sectionIndex) {
  ui.quoteDraft.sections[sectionIndex].laborItems.push({ name: "", unit: "式", pct: "", unit_price: "", manual_amount: "", is_balancer: false });
  render();
};

window.removeQuoteLabor = function (sectionIndex, laborIndex) {
  const rows = ui.quoteDraft.sections[sectionIndex].laborItems;
  if (rows.length > 1) rows.splice(laborIndex, 1);
  if (!rows.some((row) => row.is_balancer)) rows[rows.length - 1].is_balancer = true;
  render();
};

window.openMaterialDrawer = function (sectionIndex, itemIndex) {
  ui.editingMaterial = { sectionIndex, itemIndex };
  ui.picker = null;
  render();
};

window.closeMaterialDrawer = function () {
  ui.editingMaterial = null;
  ui.picker = null;
  render();
};

window.updateItemField = function (el) {
  const edit = ui.editingMaterial;
  if (!edit) return;
  const item = ui.quoteDraft.sections[edit.sectionIndex].items[edit.itemIndex];
  item[el.dataset.itemField] = el.value;
  render();
};

window.saveQuote = function (event, quoteId) {
  event.preventDefault();
  const draft = ui.quoteDraft;
  if (!draft.customer_id) {
    setToast("請先選擇客戶");
    return;
  }
  const payload = JSON.parse(JSON.stringify(draft));
  payload.id = quoteId || id("q");
  payload.quote_no = payload.quote_no || nextQuoteNo();
  delete payload.manualTotal;
  upsert("quotes", payload);
  ui.quoteDraft = null;
  ui.quoteDraftSource = null;
  ui.editingMaterial = null;
  go(`/quotes/${payload.id}`);
  setToast(quoteId ? "報價單已更新" : "報價單已建立");
};

window.setQuoteStatus = function (quoteId, status) {
  const quote = quoteById(quoteId);
  if (!quote) return;
  quote.status = status;
  saveState();
  setToast("狀態已更新");
  render();
};

window.saveSettings = function (event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.company = {
    ...state.company,
    name: form.get("name"),
    englishName: form.get("englishName"),
    taxId: form.get("taxId"),
    defaultTaxRate: n(form.get("defaultTaxRate")),
    email: form.get("email"),
    phone: form.get("phone"),
    fax: form.get("fax"),
    address: form.get("address"),
    managerName: form.get("managerName"),
    preparerName: form.get("preparerName"),
    formCode: form.get("formCode"),
    bankInfo: form.get("bankInfo"),
    defaultTerms: form.get("defaultTerms"),
  };
  saveState();
  setToast("設定已儲存");
};

window.addEventListener("hashchange", () => {
  ui.accountOpen = false;
  ui.picker = null;
  if (!route().path.includes("/quotes/new") && !route().path.includes("/edit")) {
    ui.quoteDraft = null;
    ui.quoteDraftSource = null;
  }
  render();
});

if (!location.hash) location.hash = isAuthed() ? "#/dashboard" : "#/login";
render();
