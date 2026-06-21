(function () {
  const VERSION = "017";

  function clean(value) {
    return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  function chineseCount(value) {
    const matches = clean(value).match(/[\u4e00-\u9fff]/g);
    return matches ? matches.length : 0;
  }

  function latinCount(value) {
    const matches = clean(value).match(/[A-Za-z]/g);
    return matches ? matches.length : 0;
  }

  function phoneLike(value) {
    return /(?:09\d{2}[\s-]?\d{3}[\s-]?\d{3}|0[2-8][\s-]?\d{3,4}[\s-]?\d{4}|\(0[2-8]\)\s*\d{3,4}[\s-]?\d{4})/.test(clean(value));
  }

  function hasCompanySuffix(value) {
    return /(股份有限公司|有限公司|工程行|企業社|商行|工作室|設計室|事務所|公司|行號)$/.test(clean(value));
  }

  function hasCompanyIndustry(value) {
    return /(建材|材料|五金|家具|傢俱|水果|工程|設計|股份|有限|商行|企業|室內|裝修|水電|行銷|科技|貿易|營造|土木|鋁門窗|玻璃|磁磚|衛浴|廚具)/.test(clean(value));
  }

  function hasOcrNoise(value) {
    const text = clean(value);
    if (!text) return true;
    if (/[A-Za-z]{3,}/.test(text) && !hasCompanySuffix(text)) return true;
    if (/[A-Za-z][\u4e00-\u9fff][A-Za-z]|[\u4e00-\u9fff][A-Za-z]{2,}[\u4e00-\u9fff]/.test(text)) return true;
    if (/(QIW|RACIC|RAC1C|RCIC|Liii|LIii|IHP)/i.test(text)) return true;
    return false;
  }

  function isLikelyCompanyName(value) {
    const text = clean(value);
    if (!text || chineseCount(text) < 3 || hasOcrNoise(text)) return false;
    if (hasCompanySuffix(text)) return true;
    return hasCompanyIndustry(text) && chineseCount(text) >= 4 && latinCount(text) === 0;
  }

  function getField(name) {
    return document.querySelector(`[name="${name}"]`);
  }

  function fieldValue(name) {
    return clean(getField(name)?.value || "");
  }

  function setField(name, value) {
    const target = getField(name);
    if (!target) return;
    target.value = value || "";
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function updateStatus(text) {
    const status = document.getElementById("ocr-modal-status");
    if (status) {
      status.textContent = text;
      status.dataset.mode = "warn";
    }
  }

  function parsedFromRaw(text) {
    if (typeof window.__parseCustomerCardText === "function") {
      try {
        return window.__parseCustomerCardText(text);
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function hasHardEvidence(parsed) {
    const contact = parsed?.contacts?.[0] || {};
    return Boolean(parsed?.phone || parsed?.address || parsed?.tax_id || contact.phone || contact.email || phoneLike(String(parsed?.raw_text || "")));
  }

  function isReliableParsed(parsed) {
    if (!parsed || !isLikelyCompanyName(parsed.company_name || parsed.name)) return false;
    return hasHardEvidence(parsed);
  }

  function clearSuspiciousFields() {
    setField("name", "");
    setField("company_name", "");
    setField("phone", "");
    setField("address", "");
    setField("tax_id", "");
    setField("invoice_title", "");
    setField("contact_name_0", "");
    setField("contact_role_0", "");
    setField("contact_phone_0", "");
    setField("contact_email_0", "");
    setField("contact_notes_0", "");
    setField("notes", "");
  }

  function shouldBlockCurrentForm(rawText) {
    const company = fieldValue("company_name") || fieldValue("name");
    const contactName = fieldValue("contact_name_0");
    if (hasOcrNoise(company)) return true;
    if (company && !isLikelyCompanyName(company)) return true;
    if (contactName && hasOcrNoise(contactName)) return true;
    const parsed = parsedFromRaw(rawText || "");
    if (parsed && !isReliableParsed(parsed)) return true;
    return false;
  }

  function guardRawText(rawText) {
    if (!rawText || !clean(rawText)) return false;
    const parsed = parsedFromRaw(rawText);
    if (parsed && isReliableParsed(parsed)) return false;
    updateStatus("這次辨識像亂碼，已停止自動填入。請換更正面、裁切更近的照片，或先手動修正文字。");
    clearSuspiciousFields();
    return true;
  }

  function installGuard() {
    document.documentElement.dataset.ocrQualityGate = VERSION;
    document.documentElement.dataset.ocrFixLoaded = VERSION;

    const previousApply = window.applyCustomerCardText;
    if (previousApply && !previousApply.__ocrQualityGate017) {
      const guardedApply = function () {
        const raw = document.getElementById("ocr-raw-text");
        if (guardRawText(raw?.value || "")) return false;
        return previousApply.apply(this, arguments);
      };
      guardedApply.__ocrQualityGate017 = true;
      window.applyCustomerCardText = guardedApply;
    }

    if (!window.__ocrQualityGate017Timer) {
      window.__ocrQualityGate017Timer = setInterval(() => {
        const raw = document.getElementById("ocr-raw-text");
        const rawText = raw?.value || "";
        if (!rawText) return;
        if (shouldBlockCurrentForm(rawText)) {
          updateStatus("這次辨識像亂碼，已清除自動填入內容，避免錯資料被儲存。");
          clearSuspiciousFields();
        }
      }, 700);
    }
  }

  installGuard();
  setTimeout(installGuard, 300);
  setTimeout(installGuard, 1200);
  setTimeout(installGuard, 3000);
})();
