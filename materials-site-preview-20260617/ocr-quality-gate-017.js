(function () {
  const VERSION = "018";
  const HAN = "\\u4e00-\\u9fff";

  function clean(value) {
    return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  function linesOf(text) {
    return String(text || "")
      .normalize("NFKC")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(clean)
      .filter(Boolean);
  }

  function chineseCount(value) {
    const matches = clean(value).match(/[\u4e00-\u9fff]/g);
    return matches ? matches.length : 0;
  }

  function latinCount(value) {
    const matches = clean(value).match(/[A-Za-z]/g);
    return matches ? matches.length : 0;
  }

  function includesAny(text, words) {
    return words.some((word) => text.includes(word));
  }

  function phoneLike(value) {
    return /(?:09\d{2}[\s-]?\d{3}[\s-]?\d{3}|0[2-8][\s-]?\d{3,4}[\s-]?\d{4}|\(0[2-8]\)\s*\d{3,4}[\s-]?\d{4})/.test(clean(value));
  }

  function normalizeEmailText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/(?:E[-\s]*mail|Email|Mail|ma[i1l]{2}|m[a4]11)\s*[:\uFF1A]?\s*/gi, " ")
      .replace(/\s*@\s*/g, "@")
      .replace(/\s*\.\s*/g, ".")
      .replace(/[;,+]/g, " ");
  }

  function emailFromRaw(text) {
    const normalized = normalizeEmailText(text);
    const match = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?:\.[A-Z]{2,})?/i);
    return match ? clean(match[0]).replace(/\.+$/, "") : "";
  }

  function hasCompanySuffix(value) {
    const text = clean(value);
    return /(\u80a1\u4efd\u6709\u9650\u516c\u53f8|\u6709\u9650\u516c\u53f8|\u5de5\u7a0b\u884c|\u4f01\u696d\u793e|\u5546\u884c|\u5de5\u4f5c\u5ba4|\u8a2d\u8a08\u5ba4|\u4e8b\u52d9\u6240|\u516c\u53f8|\u884c\u865f)$/.test(text);
  }

  function hasCompanyIndustry(value) {
    const text = clean(value);
    return /(\u8cc7\u8a0a|\u80a1\u4efd|\u6709\u9650|\u5370\u5237|\u8a2d\u8a08|\u5de5\u7a0b|\u5efa\u6750|\u6750\u6599|\u4e94\u91d1|\u5bb6\u5177|\u50a2\u4ff1|\u6c34\u679c|\u79d1\u6280|\u8cbf\u6613|\u71df\u9020|\u571f\u6728|\u5ba4\u5167|\u88dd\u4fee|\u6c34\u96fb|\u884c\u92b7)/.test(text);
  }

  function hasOcrNoise(value) {
    const text = clean(value);
    if (!text) return true;
    if (/[A-Za-z]{3,}/.test(text) && !hasCompanySuffix(text)) return true;
    if (/[A-Za-z][\u4e00-\u9fff][A-Za-z]|[\u4e00-\u9fff][A-Za-z]{2,}[\u4e00-\u9fff]/.test(text)) return true;
    if (/(QIW|RACIC|RAC1C|RCIC|Liii|LIii|IHP|Ofsas|ELESREE)/i.test(text)) return true;
    return false;
  }

  function isBadContactName(value) {
    const text = clean(value);
    if (!text) return true;
    if (!/^[\u4e00-\u9fff]{2,4}$/.test(text)) return true;
    return includesAny(text, [
      "\u516c\u53f8",
      "\u80a1\u4efd",
      "\u6709\u9650",
      "\u8cc7\u8a0a",
      "\u6613\u666e",
      "\u6613\u666e\u5370",
      "\u5370\u63a2",
      "\u6587\u63a2",
      "\u63a2\u96c6",
      "\u5370\u5237",
      "\u5de5\u7a0b",
      "\u5efa\u6750",
      "\u540d\u7247",
      "\u96fb\u8a71",
      "\u5730\u5740",
      "\u7d71\u7de8"
    ]);
  }

  function personNameFromLine(line) {
    const compact = clean(line)
      .replace(/[A-Za-z0-9@._%+\-:/()#]+/g, "")
      .replace(/[^\u4e00-\u9fff]/g, "");
    const match = compact.match(new RegExp("[" + HAN + "]{2,4}"));
    const name = match ? match[0] : "";
    return isBadContactName(name) ? "" : name;
  }

  function contactNameFromRaw(text) {
    const lines = linesOf(text);
    for (let index = 0; index < lines.length; index += 1) {
      if (!phoneLike(lines[index]) || !/09/.test(lines[index])) continue;
      const sameLine = personNameFromLine(lines[index].replace(/09\d{2}[\s-]?\d{3}[\s-]?\d{3}/, " "));
      if (sameLine) return sameLine;
      const nearby = [lines[index - 1], lines[index - 2], lines[index + 1]]
        .map(personNameFromLine)
        .find(Boolean);
      if (nearby) return nearby;
    }
    return "";
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
    return Boolean(
      parsed?.phone ||
      parsed?.address ||
      parsed?.tax_id ||
      contact.phone ||
      contact.email ||
      phoneLike(String(parsed?.raw_text || ""))
    );
  }

  function isReliableParsed(parsed) {
    if (!parsed || !isLikelyCompanyName(parsed.company_name || parsed.name)) return false;
    return hasHardEvidence(parsed);
  }

  function improveFieldsFromParsed(parsed, rawText) {
    if (!isReliableParsed(parsed)) return;
    const contact = parsed.contacts?.[0] || {};
    const rawName = contactNameFromRaw(rawText);
    const rawEmail = emailFromRaw(rawText);
    const currentName = fieldValue("contact_name_0");
    const nextName = rawName || clean(contact.name);
    if (nextName && (isBadContactName(currentName) || currentName !== nextName)) {
      setField("contact_name_0", nextName);
    }
    const currentEmail = fieldValue("contact_email_0");
    const nextEmail = rawEmail || clean(contact.email);
    if (nextEmail && (!currentEmail || !/@/.test(currentEmail))) {
      setField("contact_email_0", nextEmail);
    }
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
    const parsed = parsedFromRaw(rawText || "");
    if (parsed && isReliableParsed(parsed)) {
      improveFieldsFromParsed(parsed, rawText || "");
      return false;
    }
    const company = fieldValue("company_name") || fieldValue("name");
    const contactName = fieldValue("contact_name_0");
    if (hasOcrNoise(company)) return true;
    if (company && !isLikelyCompanyName(company)) return true;
    if (contactName && hasOcrNoise(contactName)) return true;
    if (parsed && !isReliableParsed(parsed)) return true;
    return false;
  }

  function guardRawText(rawText) {
    if (!rawText || !clean(rawText)) return false;
    const parsed = parsedFromRaw(rawText);
    if (parsed && isReliableParsed(parsed)) {
      setTimeout(() => improveFieldsFromParsed(parsed, rawText), 0);
      return false;
    }
    updateStatus("OCR result looks unreliable, so auto-fill was stopped.");
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
        const rawText = raw?.value || "";
        if (guardRawText(rawText)) return false;
        const result = previousApply.apply(this, arguments);
        const parsed = parsedFromRaw(rawText);
        if (parsed && isReliableParsed(parsed)) {
          setTimeout(() => improveFieldsFromParsed(parsed, rawText), 0);
          setTimeout(() => improveFieldsFromParsed(parsed, rawText), 300);
        }
        return result;
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
          updateStatus("OCR result looks unreliable, so suspicious auto-fill data was cleared.");
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
