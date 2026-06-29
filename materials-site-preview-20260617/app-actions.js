window.toggleAuthMode = function () {
  ui.authMode = ui.authMode === "login" ? "register" : "login";
  render();
};

window.login = function (event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const account = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const user = loadAccounts().find((item) => item.account === account && item.password === password && item.is_active);
  if (user) {
    setAuthSession(user);
    go("/dashboard");
    return;
  }
  setToast("帳號或密碼錯誤");
};

window.register = function (event) {
  event.preventDefault();
  setToast("請由管理人員新增帳號");
};

window.logout = function () {
  clearAuthSession();
  ui.accountOpen = false;
  ui.accountDraft = null;
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
  saveAccounts(defaultAccounts());
  const user = currentUser();
  if (user) setAuthSession(accountById(user.id) || user);
  ui.quoteDraft = null;
  setToast("示範資料已重置");
  render();
};

function blankAccountDraft() {
  return { account: "", name: "", password: "", role: "staff", permissions: defaultAccountPermissions("staff"), is_active: true };
}

window.startAccountDraft = function () {
  if (!isAdmin()) return;
  ui.accountDraft = blankAccountDraft();
  render();
};

window.startAccountFromMenu = function () {
  if (!isAdmin()) return;
  ui.accountOpen = false;
  ui.accountDraft = blankAccountDraft();
  if (route().path === "/accounts") render();
  else go("/accounts");
};

window.cancelAccountDraft = function () {
  ui.accountDraft = null;
  render();
};

function accountPayloadFromForm(form) {
  const data = new FormData(form);
  return normalizeAccountRecord({
    id: data.get("id") || id("u"),
    account: data.get("account"),
    name: data.get("name"),
    password: data.get("password"),
    role: data.get("role"),
    is_active: data.get("is_active") === null ? true : Boolean(data.get("is_active")),
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("頭像圖片讀取失敗"));
    reader.readAsDataURL(file);
  });
}

function validateAccountPayload(payload, accounts, currentId = null) {
  if (!payload.name || !payload.account || !payload.password) {
    setToast("名稱、帳號、密碼都要填寫");
    return false;
  }
  if (accounts.some((account) => account.id !== currentId && account.account === payload.account)) {
    setToast("這個帳號已經存在");
    return false;
  }
  const nextAccounts = currentId
    ? accounts.map((account) => (account.id === currentId ? payload : account))
    : [...accounts, payload];
  if (!nextAccounts.some((account) => account.role === "admin" && account.is_active)) {
    setToast("至少要保留一個啟用的管理人員");
    return false;
  }
  return true;
}

window.createAccount = function (event) {
  event.preventDefault();
  if (!isAdmin()) return;
  const accounts = loadAccounts();
  const payload = accountPayloadFromForm(event.currentTarget);
  if (!validateAccountPayload(payload, accounts)) return;
  saveAccounts([...accounts, payload]);
  ui.accountDraft = null;
  setToast("帳號已建立");
  render();
};

function saveAccountFromForm(form, accountId, options = {}) {
  if (!isAdmin()) return;
  const accounts = loadAccounts();
  const existing = accounts.find((account) => account.id === accountId);
  if (!existing) return;
  const payload = {
    ...accountPayloadFromForm(form),
    id: accountId,
    avatar: existing.avatar,
    avatarImage: existing.avatarImage,
    permissions: existing.permissions,
  };
  if (!validateAccountPayload(payload, accounts, accountId)) return;
  saveAccounts(accounts.map((account) => (account.id === accountId ? payload : account)));
  const user = currentUser();
  if (user?.id === accountId) setAuthSession(payload);
  if (options.toast !== false) setToast("帳號已更新");
  else render();
}

window.autoSaveAccount = function (form, accountId) {
  saveAccountFromForm(form, accountId, { toast: false });
};

window.saveAccount = function (event, accountId) {
  event.preventDefault();
  saveAccountFromForm(event.currentTarget, accountId);
};

window.openAccountPermissions = function (accountId) {
  if (!isAdmin()) return;
  const account = accountById(accountId);
  if (!account) return;
  ui.permissionAccountId = accountId;
  render();
};

window.closeAccountPermissions = function () {
  ui.permissionAccountId = null;
  render();
};

window.toggleAccountPermission = function (accountId, permissionKey) {
  if (!isAdmin()) return;
  const accounts = loadAccounts();
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return;
  const permissions = normalizeAccountPermissions(account.permissions, account.role);
  const next = {
    ...account,
    permissions: {
      ...permissions,
      [permissionKey]: !permissions[permissionKey],
    },
  };
  saveAccounts(accounts.map((item) => (item.id === accountId ? next : item)));
  const user = currentUser();
  if (user?.id === accountId) setAuthSession(next);
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

window.searchMaterials = function (event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const params = new URLSearchParams();
  const q = String(form.get("q") || "").trim();
  const priceBases = Array.from(new Set(form.getAll("price_basis").filter((value) => ["unit_price", "labor_unit_price"].includes(value))));
  const sort = String(form.get("sort") || "");
  let minPrice = String(form.get("min_price") || "").trim();
  let maxPrice = String(form.get("max_price") || "").trim();

  if (minPrice && maxPrice && n(minPrice) > n(maxPrice)) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  if (q) params.set("q", q);
  form.getAll("category").forEach((category) => {
    const value = String(category || "").trim();
    if (value) params.append("category", value);
  });
  if (form.get("inactive")) params.set("inactive", "1");
  priceBases.forEach((priceBasis) => params.append("price_basis", priceBasis));
  if (minPrice) params.set("min_price", minPrice);
  if (maxPrice) params.set("max_price", maxPrice);
  if (["asc", "desc"].includes(sort)) params.set("sort", sort);
  go(`/materials${params.toString() ? `?${params}` : ""}`);
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

function setCustomerFormValue(form, name, value) {
  const field = form.elements[name];
  if (field && value !== undefined && value !== null) field.value = value;
}

function fillCustomerFormFromCard(customer) {
  const form = document.querySelector("form[onsubmit^=\"saveCustomer\"]");
  if (!form || !customer) return false;
  const contact = customer.contacts?.[0] || {};
  setCustomerFormValue(form, "name", customer.name);
  setCustomerFormValue(form, "phone", customer.phone);
  setCustomerFormValue(form, "address", customer.address);
  setCustomerFormValue(form, "company_name", customer.company_name);
  setCustomerFormValue(form, "tax_id", customer.tax_id);
  setCustomerFormValue(form, "invoice_title", customer.invoice_title);
  setCustomerFormValue(form, "contact_name_0", contact.name);
  setCustomerFormValue(form, "contact_role_0", contact.role);
  setCustomerFormValue(form, "contact_phone_0", contact.phone);
  setCustomerFormValue(form, "contact_email_0", contact.email);
  setCustomerFormValue(form, "contact_notes_0", contact.notes);
  setCustomerFormValue(form, "notes", customer.notes);
  const primary = form.elements.contact_primary;
  if (primary) primary.checked = true;
  const active = form.elements.is_active;
  if (active) active.checked = customer.is_active !== false;
  return true;
}

window.applyCustomerCardJson = function () {
  const input = document.getElementById("customer-card-json");
  const status = document.getElementById("customer-card-import-status");
  const parsed = decodeCustomerCardPayload(input?.value || "");
  const customer = normalizeCustomerCard(parsed);
  if (!customer) {
    if (status) status.textContent = "JSON 格式錯誤，請重新複製名片資料。";
    return;
  }
  const applied = fillCustomerFormFromCard(customer);
  if (status) status.textContent = applied ? "已套用到表單，請確認後再儲存。" : "找不到新增客戶表單。";
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

function blankTemplateDraft() {
  return {
    name: "",
    description: "",
    notes: "",
    warranty: "",
    payments: [{ pct: "", text: "" }],
    laborItems: defaultLaborItems(),
    is_default: false,
    is_active: true,
  };
}

function indexedFieldCount(form, pattern) {
  let highest = -1;
  for (const key of form.keys()) {
    const match = key.match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

function syncTemplateDraftFromForm(tpl, formData) {
  const form = formData || document.querySelector("form[onsubmit^=\"saveTemplate\"]");
  if (!tpl || !form) return tpl;

  const data = form instanceof FormData ? form : new FormData(form);
  const defaultLaborUnit = defaultLaborItems()[0]?.unit || "";

  tpl.name = data.get("name") || "";
  tpl.description = data.get("description") || "";
  tpl.notes = data.get("notes") || "";
  tpl.warranty = data.get("warranty") || "";
  tpl.is_default = Boolean(data.get("is_default"));
  tpl.is_active = Boolean(data.get("is_active"));

  const paymentCount = Math.max(
    tpl.payments?.length || 0,
    indexedFieldCount(data, /^payment_(?:pct|text)_(\d+)$/),
    1
  );
  tpl.payments = Array.from({ length: paymentCount }, (_, index) => ({
    pct: data.get(`payment_pct_${index}`) || "",
    text: data.get(`payment_text_${index}`) || "",
  }));

  const laborCount = Math.max(
    tpl.laborItems?.length || 0,
    indexedFieldCount(data, /^tpl_labor_(?:name|unit|pct|unit_price|manual)_(\d+)$/),
    1
  );
  tpl.laborItems = Array.from({ length: laborCount }, (_, index) => ({
    name: data.get(`tpl_labor_name_${index}`) || "",
    unit: data.get(`tpl_labor_unit_${index}`) || defaultLaborUnit,
    pct: data.get(`tpl_labor_pct_${index}`) || "",
    unit_price: data.get(`tpl_labor_unit_price_${index}`) || "",
    manual_amount: data.get(`tpl_labor_manual_${index}`) || "",
    is_balancer: String(index) === String(data.get("tpl_labor_balancer")),
  }));

  return tpl;
}

window.saveTemplate = function (event, templateId) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const existing = syncTemplateDraftFromForm(templateId ? templateById(templateId) : currentTemplateForEdit(), form);
  const payments = existing.payments.filter((row) => row.pct !== "" || row.text !== "");
  const laborItems = existing.laborItems;
  const payload = {
    id: templateId || id("t"),
    name: existing.name,
    description: existing.description,
    notes: existing.notes,
    warranty: existing.warranty,
    payments: payments.length ? payments : [{ pct: "", text: "" }],
    laborItems,
    is_default: existing.is_default,
    is_active: existing.is_active,
  };
  if (payload.is_default) state.templates.forEach((item) => (item.is_default = false));
  upsert("templates", payload);
  if (!templateId) ui.tempTemplate = null;
  go("/quote-templates");
  setToast(templateId ? "版本已更新" : "版本已建立");
};

window.addPayment = function () {
  const tpl = currentTemplateForEdit();
  syncTemplateDraftFromForm(tpl);
  tpl.payments.push({ pct: "", text: "" });
  saveState();
  render();
};

window.removePayment = function (index) {
  const tpl = currentTemplateForEdit();
  syncTemplateDraftFromForm(tpl);
  if (tpl.payments.length > 1) tpl.payments.splice(index, 1);
  saveState();
  render();
};

window.addTemplateLabor = function () {
  const tpl = currentTemplateForEdit();
  syncTemplateDraftFromForm(tpl);
  tpl.laborItems.push({ name: "", unit: "式", pct: "", unit_price: "", manual_amount: "", is_balancer: false });
  saveState();
  render();
};

window.removeLabor = function (prefix, index) {
  const tpl = currentTemplateForEdit();
  syncTemplateDraftFromForm(tpl);
  if (prefix === "tpl_labor" && tpl.laborItems.length > 1) tpl.laborItems.splice(index, 1);
  saveState();
  render();
};

function currentTemplateForEdit() {
  const r = route();
  if (r.parts[1] && r.parts[1] !== "new") return templateById(r.parts[1]);
  if (!ui.tempTemplate) ui.tempTemplate = blankTemplateDraft();
  return ui.tempTemplate;
}

window.deleteRecord = function (collection, recordId, redirect) {
  if (!hasAccountPermission(currentUser(), "delete_user_data")) {
    setToast("此帳號沒有刪除用戶數據的權限");
    return;
  }
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

window.savePersonalSettings = async function (event) {
  event.preventDefault();
  const user = currentUser();
  if (!user) return;
  const form = new FormData(event.currentTarget);
  const payload = normalizeAccountRecord({
    ...user,
    name: form.get("name"),
  });
  const accounts = loadAccounts();
  if (!payload.name) {
    setToast("名稱要填寫");
    return;
  }
  saveAccounts(accounts.map((account) => (account.id === user.id ? payload : account)));
  setAuthSession(payload);
  setToast("個人設定已儲存");
  render();
};

window.openPersonalModal = function (modal) {
  if (modal !== "avatar" && modal !== "password") return;
  ui.personalModal = modal;
  ui.personalAvatarFile = null;
  render();
};

window.closePersonalModal = function () {
  ui.personalModal = null;
  ui.personalAvatarFile = null;
  render();
};

function updateAvatarDropzoneLabel(target, file) {
  const label = target?.querySelector?.("[data-avatar-file-name]");
  if (label && file?.name) label.textContent = file.name;
}

window.handleAvatarDragOver = function (event) {
  event.preventDefault();
  event.currentTarget?.classList.add("is-dragging");
};

window.handleAvatarDragLeave = function (event) {
  event.currentTarget?.classList.remove("is-dragging");
};

window.handleAvatarDrop = function (event) {
  event.preventDefault();
  const target = event.currentTarget;
  target?.classList.remove("is-dragging");
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  ui.personalAvatarFile = file;
  const input = target?.querySelector?.('input[type="file"]');
  if (input && event.dataTransfer?.files) {
    try {
      input.files = event.dataTransfer.files;
    } catch (error) {
      // Some browsers keep file inputs read-only; the stored file is still used on save.
    }
  }
  updateAvatarDropzoneLabel(target, file);
};

window.handleAvatarFilePick = function (event) {
  const file = event.currentTarget?.files?.[0] || null;
  ui.personalAvatarFile = file;
  updateAvatarDropzoneLabel(event.currentTarget?.closest?.(".avatar-dropzone"), file);
};

window.saveAvatarImage = async function (event) {
  event.preventDefault();
  const user = currentUser();
  if (!user) return;
  const form = new FormData(event.currentTarget);
  const formFile = form.get("avatarFile");
  const file = formFile && formFile.size ? formFile : ui.personalAvatarFile;
  if (!file || !file.size) {
    setToast("請先選擇頭像圖片");
    return;
  }
  let avatarImage = "";
  try {
    avatarImage = await readFileAsDataUrl(file);
  } catch (error) {
    setToast(error.message || "頭像圖片讀取失敗");
    return;
  }
  const payload = normalizeAccountRecord({ ...user, avatarImage });
  saveAccounts(loadAccounts().map((account) => (account.id === user.id ? payload : account)));
  setAuthSession(payload);
  ui.personalModal = null;
  ui.personalAvatarFile = null;
  setToast("頭像已更新");
  render();
};

window.changePersonalPassword = function (event) {
  event.preventDefault();
  const user = currentUser();
  if (!user) return;
  const form = new FormData(event.currentTarget);
  const oldPassword = String(form.get("oldPassword") || "");
  const newPassword = String(form.get("newPassword") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");
  if (oldPassword !== user.password) {
    setToast("舊密碼不正確");
    return;
  }
  if (!newPassword) {
    setToast("請輸入新密碼");
    return;
  }
  if (newPassword !== confirmPassword) {
    setToast("兩次新密碼不一致");
    return;
  }
  const payload = normalizeAccountRecord({ ...user, password: newPassword });
  saveAccounts(loadAccounts().map((account) => (account.id === user.id ? payload : account)));
  setAuthSession(payload);
  ui.personalModal = null;
  setToast("密碼已更新");
  render();
};

window.addEventListener("hashchange", () => {
  ui.accountOpen = false;
  ui.permissionAccountId = null;
  ui.personalModal = null;
  ui.personalAvatarFile = null;
  ui.picker = null;
  if (!route().path.includes("/quotes/new") && !route().path.includes("/edit")) {
    ui.quoteDraft = null;
    ui.quoteDraftSource = null;
  }
  render();
});

if (!location.hash) location.hash = isAuthed() ? "#/dashboard" : "#/login";
render();
