(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MaterialsQuoteDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BACKUP_SCHEMA = "materials-quote-backup/v1";

  function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function formatLocalDate(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addCalendarDays(dateISO, days) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO || ""));
    if (!match) return "";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
    date.setDate(date.getDate() + Number(days || 0));
    return formatLocalDate(date);
  }

  function isNumericCredential(value) {
    return /^\d{3,20}$/.test(String(value || ""));
  }

  async function hashPin(value) {
    const bytes = new TextEncoder().encode(String(value || ""));
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function nextQuoteNo(dateISO, quotes = [], reservedSequence = 0) {
    const compactDate = String(dateISO || formatLocalDate()).replaceAll("-", "");
    const prefix = `Q-${compactDate}-`;
    const highest = quotes.reduce((max, quote) => {
      const quoteNo = String(quote?.quote_no || "");
      if (!quoteNo.startsWith(prefix)) return max;
      const sequence = Number(quoteNo.slice(prefix.length));
      return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
    }, Math.max(0, Number(reservedSequence) || 0));
    return `${prefix}${String(highest + 1).padStart(3, "0")}`;
  }

  function missingFormulaFields(item) {
    const requirements = {
      wood_board_tsai: ["thickness", "width", "length"],
      wood_tsai: ["thickness", "width", "length"],
      by_length: ["length"],
      by_area: ["width", "length"],
      by_volume: ["thickness", "width", "length"],
      steel_rect_tube: ["thickness", "width", "length", "wall_thickness_mm", "density_factor"],
      steel_round_tube: ["width", "length", "wall_thickness_mm", "density_factor"],
    };
    const labels = {
      thickness: "厚度",
      width: "寬度／外徑",
      length: "長度",
      wall_thickness_mm: "壁厚",
      density_factor: "重量換算係數",
    };
    return (requirements[item?.pricing_type] || []).filter((field) => !(Number(item?.[field]) > 0)).map((field) => labels[field]);
  }

  function computePriceableQuantity(item, pricingType = item?.pricing_type, formulaVersion = item?.formula_version || "legacy-v1") {
    if (formulaVersion !== "legacy-v1") throw new Error(`Unknown formula version: ${formulaVersion}`);
    const number = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const qty = number(item?.quantity || 1);
    const thickness = number(item?.thickness);
    const width = number(item?.width);
    const length = number(item?.length);
    const wall = number(item?.wall_thickness_mm);
    const factor = number(item?.density_factor || 0.02466);
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
        return Math.max(0, equivalentDiameterMm - wall) * wall * factor * (((length || 100) * qty) / 100);
      }
      case "steel_round_tube": {
        const outerDiameterMm = width * 10;
        return Math.max(0, outerDiameterMm - wall) * wall * factor * (((length || 100) * qty) / 100);
      }
      case "single":
      default:
        return qty;
    }
  }

  function validateQuoteForStatus(quote, totals, targetStatus, context = {}) {
    const errors = [];
    const strict = targetStatus === "pending_approval" || targetStatus === "sent" || targetStatus === "won";
    if (!quote?.customer_id) errors.push("請先選擇客戶");
    if (!quote?.quote_date) errors.push("請填寫報價日期");
    if (strict && !quote?.valid_until) errors.push("請填寫報價有效期限");
    if (strict && quote?.quote_date && quote?.valid_until && quote.valid_until < quote.quote_date) errors.push("報價有效期限不可早於報價日期");
    if (targetStatus === "lost" && !String(quote?.lost_reason || "").trim()) errors.push("請填寫未成交原因");

    const sections = Array.isArray(quote?.sections) ? quote.sections : [];
    if (strict && !sections.length) errors.push("至少需要一個工程項目");
    if (strict) sections.forEach((section, index) => {
      if (!section?.name) errors.push(`工程 ${index + 1} 尚未填寫名稱`);
      if (!(Number(section?.area_qty) > 0)) errors.push(`工程 ${index + 1} 的面積或數量必須大於 0`);
      const items = Array.isArray(section?.items) ? section.items : [];
      if (!items.length) {
        errors.push(`工程 ${index + 1} 尚有未完成的材料資料`);
        return;
      }
      items.forEach((item, itemIndex) => {
        if (!item?.name || !item?.unit || !(Number(item?.quantity) > 0)) {
          errors.push(`工程 ${index + 1} 材料 ${itemIndex + 1} 尚未填完品名、單位或數量`);
          return;
        }
        const missing = missingFormulaFields(item);
        if (missing.length) errors.push(`工程 ${index + 1} 材料 ${itemIndex + 1} 缺少${missing.join("、")}`);
      });
    });
    if (strict && !(Number(totals?.total) > 0)) errors.push("報價總額必須大於 0");
    if (strict && Array.isArray(totals?.sections) && totals.sections.some((section) => section?.laborDist?.overAllocated)) {
      errors.push("工錢細項已超過可分配的工錢總額");
    }
    const paymentPercentages = Array.isArray(context?.template?.payments)
      ? context.template.payments.filter((row) => row?.pct !== "" && row?.pct != null).map((row) => Number(row.pct))
      : [];
    if (strict && paymentPercentages.length) {
      const paymentTotal = paymentPercentages.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
      if (paymentPercentages.some((value) => !Number.isFinite(value) || value < 0) || Math.abs(paymentTotal - 100) > 0.01) {
        errors.push("付款條件百分比合計必須為 100%");
      }
    }
    return { ok: errors.length === 0, errors };
  }

  function createQuoteSnapshot({ quote, customer, template, company, totals, issuedAt, issuedBy }) {
    return deepClone({
      schema: "quote-document-snapshot/v1",
      issued_at: issuedAt || new Date().toISOString(),
      issued_by: issuedBy || null,
      quote: quote || {},
      customer: customer || {},
      template: template || {},
      company: company || {},
      totals: totals || {},
    });
  }

  function createBackupBundle({ state, accounts, workLogs, exportedAt, appVersion }) {
    return deepClone({
      schema: BACKUP_SCHEMA,
      exported_at: exportedAt || new Date().toISOString(),
      app_version: appVersion || "941025-001",
      data: {
        state: state || {},
        accounts: Array.isArray(accounts) ? accounts : [],
        work_logs: Array.isArray(workLogs) ? workLogs : [],
      },
    });
  }

  function validateBackupBundle(bundle) {
    const state = bundle?.data?.state;
    const validCollections = state && ["materials", "customers", "templates", "quotes"].every((key) => Array.isArray(state[key]));
    const accounts = bundle?.data?.accounts;
    const hasActiveAdmin = Array.isArray(accounts) && accounts.some((account) => account?.role === "admin" && account?.is_active !== false && account?.account);
    const ok = bundle?.schema === BACKUP_SCHEMA && validCollections && hasActiveAdmin && Array.isArray(bundle?.data?.work_logs);
    return { ok: Boolean(ok), error: ok ? "" : "備份檔格式不正確或資料不完整" };
  }

  return {
    BACKUP_SCHEMA,
    addCalendarDays,
    createBackupBundle,
    createQuoteSnapshot,
    computePriceableQuantity,
    deepClone,
    formatLocalDate,
    hashPin,
    isNumericCredential,
    nextQuoteNo,
    validateBackupBundle,
    validateQuoteForStatus,
  };
});
