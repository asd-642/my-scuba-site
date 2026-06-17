(function () {
  const PANEL_ID = "customer-card-import-panel";
  const TEXTAREA_ID = "customer-card-json";
  const STATUS_ID = "customer-card-import-status";
  const DEFAULT_OCR_TOOL_PATH = "ocr-tool/";

  function clean(value) {
    return String(value || "").trim();
  }

  function firstValue(source, keys) {
    for (const key of keys) {
      const value = clean(source && source[key]);
      if (value) return value;
    }
    return "";
  }

  function decodePayload(value) {
    let text = clean(value);
    if (!text) return null;

    try {
      if (text.startsWith("{")) return JSON.parse(text);
    } catch (error) {
      return null;
    }

    try {
      text = decodeURIComponent(text);
    } catch (error) {
      // It may already be decoded.
    }

    try {
      const base64 = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      return null;
    }
  }

  function cardParamFromHash() {
    const hash = window.location.hash || "";
    const queryIndex = hash.indexOf("?");
    if (queryIndex === -1) return "";
    return new URLSearchParams(hash.slice(queryIndex + 1)).get("card") || "";
  }

  function normalizeCard(card) {
    if (!card || typeof card !== "object") return null;
    const firstContact = Array.isArray(card.contacts) && card.contacts.length ? card.contacts[0] : {};
    const companyName = firstValue(card, ["customer_name", "company_name", "company", "name", "公司名稱", "客戶名稱"]);
    const contactName = firstValue(card, ["contact_name", "person", "owner", "manager", "負責人", "聯絡人"]) || clean(firstContact.name);
    const contactRole = firstValue(card, ["contact_role", "role", "title", "職稱"]) || clean(firstContact.role);
    const contactPhone = firstValue(card, ["contact_phone", "mobile", "cell", "cellphone", "手機"]) || clean(firstContact.phone);
    const contactEmail = firstValue(card, ["contact_email", "email", "mail", "電子信箱"]) || clean(firstContact.email);
    const website = firstValue(card, ["website", "url", "site", "網址"]);
    const notes = [firstValue(card, ["notes", "memo", "remark", "備註"]), website ? `網站：${website}` : ""].filter(Boolean).join("\n");

    return {
      name: companyName,
      phone: firstValue(card, ["phone", "company_phone", "tel", "telephone", "公司電話", "電話"]),
      address: firstValue(card, ["address", "company_address", "addr", "公司地址", "地址"]),
      company_name: firstValue(card, ["company_name", "company", "公司名稱"]) || companyName,
      tax_id: firstValue(card, ["tax_id", "vat", "uniform_number", "統一編號"]),
      invoice_title: firstValue(card, ["invoice_title", "invoice", "發票抬頭"]) || firstValue(card, ["company_name", "company", "公司名稱"]) || companyName,
      contacts: [
        {
          name: contactName,
          role: contactRole,
          phone: contactPhone,
          email: contactEmail,
          notes: clean(firstContact.notes),
          primary: true,
        },
      ],
      notes,
      is_active: card.is_active !== false,
    };
  }

  function field(form, name) {
    return form && form.elements ? form.elements[name] : null;
  }

  function setField(form, name, value) {
    const target = field(form, name);
    if (!target || value === undefined || value === null) return;
    target.value = value;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillForm(customer) {
    const form = document.querySelector('form[onsubmit^="saveCustomer"]');
    if (!form || !customer) return false;
    const contact = customer.contacts && customer.contacts[0] ? customer.contacts[0] : {};
    setField(form, "name", customer.name);
    setField(form, "phone", customer.phone);
    setField(form, "address", customer.address);
    setField(form, "company_name", customer.company_name);
    setField(form, "tax_id", customer.tax_id);
    setField(form, "invoice_title", customer.invoice_title);
    setField(form, "contact_name_0", contact.name);
    setField(form, "contact_role_0", contact.role);
    setField(form, "contact_phone_0", contact.phone);
    setField(form, "contact_email_0", contact.email);
    setField(form, "contact_notes_0", contact.notes);
    setField(form, "notes", customer.notes);
    const active = field(form, "is_active");
    if (active) active.checked = customer.is_active !== false;
    const primary = field(form, "contact_primary");
    if (primary) primary.checked = true;
    return true;
  }

  function applyTextarea() {
    const input = document.getElementById(TEXTAREA_ID);
    const status = document.getElementById(STATUS_ID);
    const customer = normalizeCard(decodePayload(input ? input.value : ""));
    if (!customer) {
      if (status) status.textContent = "JSON 無法讀取，請確認格式後再試。";
      return;
    }
    const ok = fillForm(customer);
    if (status) status.textContent = ok ? "已套用到表單，請確認後再儲存。" : "找不到新增客戶表單。";
  }

  function returnUrl() {
    return `${window.location.origin}${window.location.pathname}#/customers/new`;
  }

  function ocrToolUrl() {
    const defaultUrl = new URL(DEFAULT_OCR_TOOL_PATH, window.location.href.split("#")[0]).toString();
    let base = defaultUrl;
    try {
      base = window.localStorage.getItem("OCR_TOOL_URL") || defaultUrl;
    } catch (error) {
      // Keep the default URL.
    }
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}return_url=${encodeURIComponent(returnUrl())}`;
  }

  function renderPanel(importedCustomer) {
    const panel = document.createElement("section");
    panel.className = "card customer-card-import";
    panel.id = PANEL_ID;
    const cardJson = importedCustomer ? JSON.stringify(importedCustomer, null, 2) : "";
    panel.innerHTML = `
      <div class="card-header">
        <h2>名片資料匯入</h2>
        <a class="btn outline sm" href="${ocrToolUrl()}" target="_blank" rel="noreferrer">開啟名片辨識工具</a>
      </div>
      <div class="card-body">
        ${importedCustomer ? '<div class="notice success">已從名片辨識連結帶入資料，請確認欄位後再儲存。</div>' : ""}
        <div class="field">
          <label>貼上名片 JSON</label>
          <textarea class="textarea" id="${TEXTAREA_ID}" placeholder='{"company_name":"公司名稱","contact_name":"聯絡人","phone":"公司電話","address":"地址"}'>${cardJson}</textarea>
          <small>從 OCR 小工具複製 JSON 後貼上，按「套用到表單」即可預填欄位。</small>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">
          <span id="${STATUS_ID}" style="color:var(--muted);font-size:13px"></span>
          <button class="btn secondary" type="button" data-card-apply>套用到表單</button>
        </div>
      </div>
    `;
    panel.querySelector("[data-card-apply]").addEventListener("click", applyTextarea);
    return panel;
  }

  function ensurePanel() {
    if (!window.location.hash.startsWith("#/customers/new")) return;
    if (document.getElementById(PANEL_ID)) return;
    if (document.querySelector(".customer-card-import")) return;
    const form = document.querySelector('form[onsubmit^="saveCustomer"]');
    if (!form) return;
    const firstCard = form.querySelector("section.card");
    if (!firstCard) return;
    const importedCustomer = normalizeCard(decodePayload(cardParamFromHash()));
    form.insertBefore(renderPanel(importedCustomer), firstCard);
    if (importedCustomer) fillForm(importedCustomer);
  }

  window.applyCustomerCardJson = applyTextarea;
  window.addEventListener("hashchange", () => setTimeout(ensurePanel, 0));
  window.addEventListener("DOMContentLoaded", () => {
    ensurePanel();
    setTimeout(ensurePanel, 100);
    setTimeout(ensurePanel, 500);
  });

  const app = document.getElementById("app");
  if (app && window.MutationObserver) {
    new MutationObserver(() => ensurePanel()).observe(app, { childList: true, subtree: true });
  }
})();
