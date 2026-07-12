const test = require("node:test");
const assert = require("node:assert/strict");

const domain = require("../app-domain.js");

test("formatLocalDate returns the local calendar date", () => {
  assert.equal(domain.formatLocalDate(new Date(2026, 6, 10, 23, 59, 0)), "2026-07-10");
});

test("addCalendarDays keeps date-only values stable", () => {
  assert.equal(domain.addCalendarDays("2026-07-28", 7), "2026-08-04");
});

test("numeric credentials can be hashed without storing the PIN", async () => {
  assert.equal(domain.isNumericCredential("123"), true);
  assert.equal(domain.isNumericCredential("12a"), false);
  assert.equal(await domain.hashPin("123"), "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3");
});

test("nextQuoteNo advances from the highest daily sequence", () => {
  const quotes = [
    { quote_no: "Q-20260710-001" },
    { quote_no: "Q-20260710-003" },
    { quote_no: "Q-20260709-009" },
  ];

  assert.equal(domain.nextQuoteNo("2026-07-10", quotes), "Q-20260710-004");
  assert.equal(domain.nextQuoteNo("2026-07-10", quotes.slice(0, 1), 8), "Q-20260710-009");
});

test("legacy formula engine calculates documented basic units", () => {
  assert.equal(domain.computePriceableQuantity({ quantity: 3 }, "single", "legacy-v1"), 3);
  assert.equal(domain.computePriceableQuantity({ length: 250, quantity: 2 }, "by_length", "legacy-v1"), 5);
  assert.equal(domain.computePriceableQuantity({ width: 100, length: 200, quantity: 1 }, "by_area", "legacy-v1"), 2);
  assert.equal(domain.computePriceableQuantity({ thickness: 10, width: 20, length: 30, quantity: 1 }, "by_volume", "legacy-v1"), 0.006);
});

test("legacy wood and steel formulas remain stable for historical quotes", () => {
  const wood = { thickness: 2, width: 10, length: 100, quantity: 1 };
  const roundTube = { width: 5, wall_thickness_mm: 2, length: 100, quantity: 1, density_factor: 0.02466 };

  assert.ok(Math.abs(domain.computePriceableQuantity(wood, "wood_board_tsai", "legacy-v1") - 0.7189072609633357) < 1e-12);
  assert.ok(Math.abs(domain.computePriceableQuantity(wood, "wood_tsai", "legacy-v1") - 7.194244604316546) < 1e-12);
  assert.ok(Math.abs(domain.computePriceableQuantity(roundTube, "steel_round_tube", "legacy-v1") - 2.36736) < 1e-12);
  assert.throws(() => domain.computePriceableQuantity(wood, "wood_tsai", "future-v2"), /Unknown formula version/);
});

test("validateQuoteForStatus blocks incomplete quotes from being sent", () => {
  const quote = {
    customer_id: "c1",
    quote_date: "2026-07-10",
    valid_until: "2026-07-17",
    sections: [
      {
        name: "Outdoor deck",
        area_qty: 5,
        items: [{ name: "", unit: "", quantity: 1 }],
      },
    ],
  };

  const result = domain.validateQuoteForStatus(quote, { total: 0 }, "sent");

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ["工程 1 材料 1 尚未填完品名、單位或數量", "報價總額必須大於 0"]);
});

test("validateQuoteForStatus requires dimensions used by the selected formula", () => {
  const quote = {
    customer_id: "c1",
    quote_date: "2026-07-10",
    valid_until: "2026-07-17",
    sections: [{ name: "Deck", area_qty: 1, items: [{ name: "Board", unit: "M2", quantity: 1, pricing_type: "by_area", width: 100, length: "" }] }],
  };
  const result = domain.validateQuoteForStatus(quote, { total: 100, sections: [] }, "pending_approval");
  assert.deepEqual(result.errors, ["工程 1 材料 1 缺少長度"]);
});

test("validateQuoteForStatus requires a reason when a quote is lost", () => {
  const result = domain.validateQuoteForStatus({ customer_id: "c1", quote_date: "2026-07-10", lost_reason: "", sections: [] }, { total: 0 }, "lost");
  assert.deepEqual(result.errors, ["請填寫未成交原因"]);
});

test("validateQuoteForStatus checks expiry, labor allocation, and payment totals", () => {
  const quote = {
    customer_id: "c1",
    quote_date: "2026-07-10",
    valid_until: "2026-07-09",
    sections: [{ name: "Deck", area_qty: 1, items: [{ name: "Board", unit: "piece", quantity: 1 }] }],
  };
  const totals = { total: 100, sections: [{ laborDist: { overAllocated: true } }] };
  const result = domain.validateQuoteForStatus(quote, totals, "pending_approval", {
    template: { payments: [{ pct: 60 }, { pct: 30 }, { pct: "", text: "note" }] },
  });

  assert.deepEqual(result.errors, [
    "報價有效期限不可早於報價日期",
    "工錢細項已超過可分配的工錢總額",
    "付款條件百分比合計必須為 100%",
  ]);
});

test("createQuoteSnapshot is isolated from later source changes", () => {
  const customer = { id: "c1", name: "Site A", contacts: [{ name: "Lin" }] };
  const template = { id: "t1", notes: "Original terms", payments: [{ pct: 50, text: "Deposit" }] };
  const company = { name: "Lailai", phone: "03-1234567" };
  const quote = { id: "q1", quote_no: "Q-20260710-001", tax_rate: 5 };

  const snapshot = domain.createQuoteSnapshot({
    quote,
    customer,
    template,
    company,
    totals: { subtotal: 100, tax: 5, total: 105 },
    issuedAt: "2026-07-10T02:00:00.000Z",
    issuedBy: { id: "u1", name: "Admin" },
  });

  customer.name = "Changed";
  template.notes = "Changed";
  company.phone = "Changed";

  assert.equal(snapshot.customer.name, "Site A");
  assert.equal(snapshot.template.notes, "Original terms");
  assert.equal(snapshot.company.phone, "03-1234567");
  assert.equal(snapshot.totals.total, 105);
});

test("backup bundle validation rejects malformed data", () => {
  const valid = domain.createBackupBundle({
    state: { materials: [], customers: [], templates: [], quotes: [], company: {} },
    accounts: [{ id: "u1", account: "123", role: "admin", is_active: true }],
    workLogs: [],
    exportedAt: "2026-07-10T02:00:00.000Z",
  });

  assert.equal(domain.validateBackupBundle(valid).ok, true);
  assert.equal(domain.validateBackupBundle({ ...valid, data: { ...valid.data, accounts: [] } }).ok, false);
  assert.equal(domain.validateBackupBundle({ schema: "unknown" }).ok, false);
});
