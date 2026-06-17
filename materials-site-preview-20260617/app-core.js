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
