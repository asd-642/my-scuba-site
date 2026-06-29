function itemFromMaterial(materialId, overrides = {}) {
  const materialMap = {
    m1: {
      material_id: "m1",
      name: "不銹鋼管",
      category: "鋼構",
      unit: "KG",
      pricing_type: "steel_rect_tube",
      thickness: 3.8,
      width: 3.8,
      length: "",
      wall_thickness_mm: 2,
      density_factor: 0.02466,
      quantity: 1,
      unit_price: 150,
      waste_pct: 0,
      labor_unit_price: 180,
      labor_waste_pct: 5,
      labor_pricing_type: "wood_board_tsai",
      notes: "",
    },
    m2: {
      material_id: "m2",
      name: "不鏽鋼扣件",
      category: "其他配件",
      unit: "個",
      pricing_type: "single",
      thickness: "",
      width: "",
      length: "",
      wall_thickness_mm: "",
      density_factor: 0.02466,
      quantity: 1,
      unit_price: 15,
      waste_pct: 0,
      labor_unit_price: 0,
      labor_waste_pct: "",
      labor_pricing_type: "",
      notes: "",
    },
    m3: {
      material_id: "m3",
      name: "不鏽鋼角鐵",
      category: "其他配件",
      unit: "個",
      pricing_type: "single",
      thickness: "",
      width: "",
      length: "",
      wall_thickness_mm: "",
      density_factor: 0.02466,
      quantity: 1,
      unit_price: 45,
      waste_pct: 0,
      labor_unit_price: 0,
      labor_waste_pct: "",
      labor_pricing_type: "",
      notes: "",
    },
    m4: {
      material_id: "m4",
      name: "塑木(中空)-一代",
      category: "塑木",
      unit: "才",
      pricing_type: "wood_board_tsai",
      thickness: 2.5,
      width: 14.6,
      length: 100,
      wall_thickness_mm: "",
      density_factor: 0.02466,
      quantity: 1,
      unit_price: 170,
      waste_pct: 5,
      labor_unit_price: 180,
      labor_waste_pct: "",
      labor_pricing_type: "",
      notes: "",
    },
  };
  return { ...blankItem(), ...materialMap[materialId], ...overrides };
}

function blankItem() {
  return {
    material_id: null,
    name: "",
    category: "",
    unit: "件",
    pricing_type: "single",
    thickness: "",
    width: "",
    length: "",
    wall_thickness_mm: "",
    density_factor: 0.02466,
    quantity: 1,
    unit_price: 0,
    waste_pct: 0,
    labor_unit_price: 0,
    labor_waste_pct: "",
    labor_pricing_type: "",
    notes: "",
  };
}

function blankSection() {
  return {
    name: "",
    area_qty: 1,
    unit: "M²",
    spec: "",
    items: [blankItem()],
    laborItems: defaultLaborItems(),
  };
}

let state = loadState();
let ui = {
  authMode: "login",
  sidebarCollapsed: false,
  accountOpen: false,
  accountDraft: null,
  permissionAccountId: null,
  personalModal: null,
  personalAvatarFile: null,
  picker: null,
  pickerSearch: "",
  quoteDraft: null,
  editingMaterial: null,
  toast: "",
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) {
    console.warn(error);
  }
  const seeded = seedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isAuthed() {
  return localStorage.getItem(AUTH_KEY) === "yes";
}

function defaultAccounts() {
  return [
    {
      id: "account-admin-123",
      account: DEMO_EMAIL,
      name: "管理人員",
      avatar: "管",
      avatarImage: "",
      password: DEMO_PASSWORD,
      role: "admin",
      permissions: defaultAccountPermissions("admin"),
      is_active: true,
    },
    {
      id: "account-staff-456",
      account: STAFF_EMAIL,
      name: "一般人員",
      avatar: "員",
      avatarImage: "",
      password: STAFF_PASSWORD,
      role: "staff",
      permissions: defaultAccountPermissions("staff"),
      is_active: true,
    },
  ];
}

function defaultAccountPermissions(role) {
  return {
    delete_user_data: normalizeAccountRole(role) === "admin",
  };
}

function normalizeAccountPermissions(permissions, role) {
  return {
    ...defaultAccountPermissions(role),
    ...(permissions && typeof permissions === "object" ? permissions : {}),
  };
}

function accountPermissionLabel(key) {
  return {
    delete_user_data: "刪除用戶數據",
  }[key] || key;
}

function hasAccountPermission(account, key) {
  if (!account) return false;
  const permissions = normalizeAccountPermissions(account.permissions, account.role);
  return Boolean(permissions[key]);
}

function normalizeAccountRole(role) {
  return role === "admin" ? "admin" : "staff";
}

function accountRoleLabel(role) {
  return ACCOUNT_ROLE_LABELS[normalizeAccountRole(role)];
}

function normalizeAccountRecord(account) {
  const role = normalizeAccountRole(account?.role);
  const name = String(account?.name || account?.account || accountRoleLabel(role)).trim();
  const avatar = String(account?.avatar || name.slice(0, 1) || "用").trim().slice(0, 2);
  return {
    id: account?.id || id("u"),
    account: String(account?.account || "").trim(),
    name,
    avatar,
    avatarImage: String(account?.avatarImage || ""),
    password: String(account?.password || ""),
    role,
    permissions: normalizeAccountPermissions(account?.permissions, role),
    is_active: account?.is_active === false ? false : true,
  };
}

function loadAccounts() {
  let accounts = null;
  try {
    const saved = localStorage.getItem(ACCOUNTS_KEY);
    if (saved) accounts = JSON.parse(saved);
  } catch (error) {
    console.warn(error);
  }
  if (!Array.isArray(accounts)) accounts = defaultAccounts();
  accounts = accounts.map(normalizeAccountRecord).filter((account) => account.account);
  const defaults = defaultAccounts();
  defaults.forEach((defaultAccount) => {
    if (!accounts.some((account) => account.account === defaultAccount.account)) {
      accounts.push(defaultAccount);
    }
  });
  if (!accounts.some((account) => account.role === "admin" && account.is_active)) {
    accounts[0] = { ...accounts[0], role: "admin", is_active: true };
  }
  saveAccounts(accounts);
  return accounts;
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.map(normalizeAccountRecord)));
}

function accountById(accountId) {
  return loadAccounts().find((account) => account.id === accountId);
}

function currentUser() {
  if (!isAuthed()) return null;
  try {
    const saved = localStorage.getItem(AUTH_USER_KEY);
    if (saved) {
      const user = normalizeAccountRecord(JSON.parse(saved));
      const latest = accountById(user.id) || loadAccounts().find((account) => account.account === user.account);
      if (latest && latest.is_active) return latest;
      if (latest && !latest.is_active) {
        clearAuthSession();
        return null;
      }
      if (!latest) {
        clearAuthSession();
        return null;
      }
    }
  } catch (error) {
    console.warn(error);
  }
  const admin = loadAccounts().find((account) => account.account === DEMO_EMAIL) || defaultAccounts()[0];
  setAuthSession(admin);
  return admin;
}

function isAdmin() {
  return currentUser()?.role === "admin";
}

function setAuthSession(account) {
  const user = normalizeAccountRecord(account);
  localStorage.setItem(AUTH_KEY, "yes");
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function accountInitial(account) {
  const avatar = String(account?.avatar || "").trim();
  if (avatar) return avatar.slice(0, 2);
  const name = String(account?.name || account?.account || "用").trim();
  return name.slice(0, 1) || "用";
}

function renderAvatar(account, className = "") {
  const classes = ["avatar", className].filter(Boolean).join(" ");
  if (account?.avatarImage) {
    return `<span class="${classes} avatar-image"><img src="${h(account.avatarImage)}" alt="${h(account.name || "頭像")}"></span>`;
  }
  return `<span class="${classes}">${h(accountInitial(account))}</span>`;
}

function setToast(message) {
  ui.toast = message;
  render();
  window.clearTimeout(setToast.timer);
  setToast.timer = window.setTimeout(() => {
    ui.toast = "";
    render();
  }, 1800);
}

function h(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function n(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function money(value) {
  const rounded = Math.round(n(value));
  return "$" + rounded.toLocaleString("en-US");
}

function dateToday() {
  return "2026-06-17";
}

function id(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function pricingOption(type) {
  return PRICING_TYPE_OPTIONS.find((item) => item.value === type) || PRICING_TYPE_OPTIONS[2];
}

function pricingLabel(type, short = false) {
  const opt = pricingOption(type);
  return short ? opt.short : opt.label;
}

function dimLabel(type, key) {
  const opt = pricingOption(type);
  return opt.dimLabels?.[key] || { thickness: "厚", width: "寬", length: "長" }[key];
}

function materialById(materialId) {
  return state.materials.find((item) => item.id === materialId);
}

function customerById(customerId) {
  return state.customers.find((item) => item.id === customerId);
}

function templateById(templateId) {
  return state.templates.find((item) => item.id === templateId);
}

function quoteById(quoteId) {
  return state.quotes.find((item) => item.id === quoteId);
}

function computePriceableQty(item, pricingType = item.pricing_type) {
  const qty = n(item.quantity || 1);
  const thickness = n(item.thickness);
  const width = n(item.width);
  const length = n(item.length);
  const wall = n(item.wall_thickness_mm);
  const factor = n(item.density_factor || 0.02466);
  switch (pricingType) {
    case "wood_board_tsai":
      return (thickness * width * length * qty) / 2782;
    case "wood_tsai":
      return (thickness * width * length * qty) / 278;
    case "by_length":
      return (length / 100) * qty;
    case "by_area":
      return (width * length * qty) / 10000;
    case "by_volume":
      return (thickness * width * length * qty) / 1000000;
    case "steel_rect_tube": {
      const equivalentDiameterMm = ((2 * thickness + 2 * width) / Math.PI) * 10;
      return Math.max(0, equivalentDiameterMm - wall) * wall * factor * ((length || 100) * qty / 100);
    }
    case "steel_round_tube": {
      const outerDiameterMm = width * 10;
      return Math.max(0, outerDiameterMm - wall) * wall * factor * ((length || 100) * qty / 100);
    }
    case "single":
    default:
      return qty;
  }
}

function computeItem(item) {
  const baseQty = computePriceableQty(item);
  const wasteQty = baseQty * (n(item.waste_pct) / 100);
  const priceableQty = baseQty + wasteQty;
  const materialSubtotal = priceableQty * n(item.unit_price);
  const laborPricing = item.labor_pricing_type || item.pricing_type;
  const laborBaseQty = computePriceableQty(item, laborPricing);
  const laborWastePct = item.labor_waste_pct === "" || item.labor_waste_pct == null ? n(item.waste_pct) : n(item.labor_waste_pct);
  const laborPricedQty = laborBaseQty + laborBaseQty * (laborWastePct / 100);
  const laborSubtotal = laborPricedQty * n(item.labor_unit_price);
  return {
    ok: Boolean(item.name && item.unit),
    baseQty,
    wasteQty,
    priceableQty,
    materialSubtotal,
    laborPricedQty,
    laborSubtotal,
    subtotal: materialSubtotal + laborSubtotal,
    message: item.name ? "資料不全" : "請填寫品名",
  };
}

function computeLaborDistribution(laborItems, laborTotal) {
  let fixed = 0;
  let balancerIndex = laborItems.findIndex((item) => item.is_balancer);
  const rows = laborItems.map((item, index) => {
    let amount = 0;
    if (item.is_balancer) return { ...item, amount: 0, qty: 1 };
    if (item.manual_amount !== "" && item.manual_amount != null) amount = n(item.manual_amount);
    else if (item.unit_price !== "" && item.unit_price != null) amount = n(item.unit_price);
    else amount = laborTotal * (n(item.pct) / 100);
    fixed += amount;
    return { ...item, amount, qty: 1 };
  });
  if (balancerIndex >= 0) rows[balancerIndex].amount = laborTotal - fixed;
  return {
    items: rows,
    overAllocated: fixed > laborTotal && balancerIndex >= 0,
    unbalanced: balancerIndex < 0 && Math.round(fixed) !== Math.round(laborTotal),
  };
}

function computeSection(section) {
  const itemsComputed = section.items.map(computeItem);
  const materialSubtotal = itemsComputed.reduce((sum, item) => sum + item.materialSubtotal, 0);
  const laborSubtotal = itemsComputed.reduce((sum, item) => sum + item.laborSubtotal, 0);
  const laborDist = computeLaborDistribution(section.laborItems || [], laborSubtotal);
  const unitCost = materialSubtotal + laborSubtotal;
  const sectionTotal = unitCost * n(section.area_qty || 1);
  return { itemsComputed, materialSubtotal, laborSubtotal, laborDist, unitCost, sectionTotal };
}

function computeQuote(quote) {
  if (quote.manualTotal && !ui.quoteDraft) {
    return {
      sections: quote.sections.map(computeSection),
      subtotal: Math.round(quote.manualTotal / 1.05),
      tax: Math.round(quote.manualTotal - quote.manualTotal / 1.05),
      total: quote.manualTotal,
      discount: 0,
    };
  }
  const sections = quote.sections.map(computeSection);
  const subtotalBeforeDiscount = sections.reduce((sum, section) => sum + section.sectionTotal, 0);
  const discount = n(quote.discount_amount);
  const taxable = Math.max(0, subtotalBeforeDiscount - discount);
  const tax = taxable * (n(quote.tax_rate) / 100);
  return { sections, subtotal: subtotalBeforeDiscount, discount, tax, total: taxable + tax };
}

function route() {
  const raw = location.hash.replace(/^#/, "") || "/login";
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return { raw, path, parts, query: new URLSearchParams(query) };
}

function link(path) {
  return `#${path}`;
}

function go(path) {
  location.hash = path;
}

const DEFAULT_OCR_TOOL_PATH = "ocr-tool/";

function cleanCardValue(value) {
  return String(value ?? "").trim();
}

function getCustomerOcrToolUrl() {
  const defaultUrl = new URL(DEFAULT_OCR_TOOL_PATH, location.href.split("#")[0]).toString();
  return localStorage.getItem("OCR_TOOL_URL") || defaultUrl;
}

function getCustomerReturnUrl() {
  return `${location.href.split("#")[0]}#/customers/new`;
}

function buildCustomerOcrUrl() {
  const url = new URL(getCustomerOcrToolUrl());
  url.searchParams.set("return_url", getCustomerReturnUrl());
  return url.toString();
}

function decodeBase64UrlJson(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeCustomerCardPayload(value) {
  const raw = cleanCardValue(value);
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch (error) {
    console.warn(error);
  }
  try {
    candidates.push(decodeBase64UrlJson(raw));
  } catch (error) {
    console.warn(error);
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      console.warn(error);
    }
  }
  return null;
}

function normalizeCustomerCard(card) {
  if (!card || typeof card !== "object") return null;
  const firstContact = Array.isArray(card.contacts) ? card.contacts[0] || {} : {};
  const contactName = cleanCardValue(card.contact_name || card.contactName || firstContact.name || card.owner || card.responsible);
  const contactRole = cleanCardValue(card.contact_role || card.contactRole || firstContact.role || card.title);
  const contactPhone = cleanCardValue(card.contact_phone || card.contactPhone || firstContact.phone || card.mobile);
  const contactEmail = cleanCardValue(card.contact_email || card.contactEmail || firstContact.email || card.email);
  const companyName = cleanCardValue(card.company_name || card.companyName || card.company);
  const companyPhone = cleanCardValue(card.phone || card.company_phone || card.companyPhone || card.tel || card.telephone);
  const website = cleanCardValue(card.website || card.web || card.url);
  const notes = [
    cleanCardValue(card.notes),
    website ? `網站：${website}` : "",
    cleanCardValue(card.raw_text || card.rawText) ? `OCR原文：\n${cleanCardValue(card.raw_text || card.rawText)}` : "",
  ].filter(Boolean).join("\n");
  const payload = {
    name: cleanCardValue(card.customer_name || card.customerName || card.name || companyName || contactName),
    phone: companyPhone || contactPhone,
    address: cleanCardValue(card.address || card.company_address || card.companyAddress),
    company_name: companyName,
    tax_id: cleanCardValue(card.tax_id || card.taxId || card.vat),
    invoice_title: cleanCardValue(card.invoice_title || card.invoiceTitle || companyName),
    contacts: [{
      name: contactName,
      role: contactRole,
      phone: contactPhone,
      email: contactEmail,
      notes: cleanCardValue(firstContact.notes),
      primary: true,
    }],
    notes,
    is_active: card.is_active === false ? false : true,
  };
  const hasAnyValue = [
    payload.name,
    payload.phone,
    payload.address,
    payload.company_name,
    payload.tax_id,
    payload.invoice_title,
    payload.contacts[0].name,
    payload.contacts[0].phone,
    payload.contacts[0].email,
    payload.notes,
  ].some(Boolean);
  return hasAnyValue ? payload : null;
}

function customerCardFromRoute() {
  const cardParam = route().query.get("card");
  return normalizeCustomerCard(decodeCustomerCardPayload(cardParam));
}

function customerCardPayloadFromCustomer(customer) {
  const contact = customer?.contacts?.[0] || {};
  return {
    customer_name: customer?.name || "",
    company_name: customer?.company_name || "",
    phone: customer?.phone || "",
    address: customer?.address || "",
    tax_id: customer?.tax_id || "",
    invoice_title: customer?.invoice_title || "",
    contact_name: contact.name || "",
    contact_role: contact.role || "",
    contact_phone: contact.phone || "",
    contact_email: contact.email || "",
    notes: customer?.notes || "",
  };
}
