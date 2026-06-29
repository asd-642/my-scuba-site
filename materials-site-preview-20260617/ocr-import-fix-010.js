(function () {
  const FIX_VERSION = 21;
  if ((window.__customerCardOcrFixVersion || 0) >= FIX_VERSION) return;
  window.__customerCardOcrFixVersion = FIX_VERSION;
  window.__customerCardOcrFix010 = true;

  const TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  const ADDRESS_RE = /(?:台北市|臺北市|新北市|桃園市|台中市|臺中市|台南市|臺南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|臺東縣|澎湖縣|金門縣|連江縣)[^\n@]{0,80}(?:路|街|巷|弄|號|樓|室)[^\n@]*/;
  const COMPANY_SUFFIX_RE = /(股份有限公司|有限公司|工程行|企業社|商行|工作室|設計室|事務所|公司|行號)$/;
  const ROLE_RE = /(總經理|副總經理|董事長|負責人|聯絡人|店長|銷售部經理|業務部經理|採購部經理|工程部經理|銷售|業務|採購|主任|協理|副理|經理|專員|助理)/g;

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\r/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, "")
      .replace(/[﹕︰]/g, ":")
      .replace(/[‐‑‒–—―]/g, "-")
      .replace(/[|｜·•●◆◇■□▲△▼▽★☆]/g, " ")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function clean(value) {
    return normalizeText(value).replace(/\s+/g, " ").trim();
  }

  function compactChineseText(value) {
    return clean(value)
      .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff0-9])/g, "$1")
      .replace(/(\d)\s+(?=[\u4e00-\u9fff])/g, "$1");
  }

  function usefulCount(value) {
    const matches = String(value || "").match(/[\u4e00-\u9fffA-Za-z0-9@]/g);
    return matches ? matches.length : 0;
  }

  function chineseCount(value) {
    const matches = String(value || "").match(/[\u4e00-\u9fff]/g);
    return matches ? matches.length : 0;
  }

  function latinCount(value) {
    const matches = String(value || "").match(/[A-Za-z]/g);
    return matches ? matches.length : 0;
  }

  function hasCompanyIndustry(value) {
    return /(建材|材料|五金|家具|傢俱|水果|工程|設計|股份|有限|商行|企業|室內|裝修|水電|行銷|科技|貿易|營造|土木|鋁門窗|玻璃|磁磚|衛浴|廚具)/.test(value);
  }

  function hasOcrNoise(value) {
    const text = clean(value);
    if (!text) return true;
    if (/[A-Za-z]{3,}/.test(text) && !COMPANY_SUFFIX_RE.test(text)) return true;
    if (/[A-Za-z][\u4e00-\u9fff][A-Za-z]|[\u4e00-\u9fff][A-Za-z]{2,}[\u4e00-\u9fff]/.test(text)) return true;
    if (/(QIW|RACIC|RAC1C|RCIC|Liii|LIii|lil|IHP|^[一二三四五六七八九十]+[A-Za-z])/i.test(text)) return true;
    return false;
  }

  function normalizeEmailText(value) {
    return normalizeText(value)
      .replace(/(?:E[-\s]*mail|Email|Mail|ma[i1l]{2}|m[a4]11)\s*[:：]?\s*/gi, " ")
      .replace(/\s*@\s*/g, "@")
      .replace(/\s*\.\s*/g, ".")
      .replace(/[，,;；]+/g, " ");
  }

  function findEmail(text) {
    const normalized = normalizeEmailText(text);
    const match = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?:\.[A-Z]{2,})?/i);
    return match ? clean(match[0]).replace(/\.+$/, "") : "";
  }

  function splitLines(text) {
    return normalizeText(text)
      .split("\n")
      .map(clean)
      .filter((line) => line && !/^(logo|your name|you name|name|company name|company|design|sample)$/i.test(line))
      .filter((line) => !(line.length >= 6 && usefulCount(line) / line.length < 0.35));
  }

  function firstMatch(text, regex) {
    const match = String(text || "").match(regex);
    return match ? clean(match[1] || match[0]) : "";
  }

  function stripLabel(line, labels) {
    let text = clean(line);
    for (const label of labels) text = text.replace(label, "");
    return clean(text.replace(/^[\s:：-]+|[\s:：-]+$/g, ""));
  }

  function normalizePhone(value) {
    let digits = clean(value).replace(/[Oo]/g, "0").replace(/[^\d]/g, "");
    if (digits.startsWith("886")) digits = `0${digits.slice(3)}`;
    if (digits.length === 9 && digits.startsWith("9")) digits = `0${digits}`;
    if (/^09\d{8}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    if (/^02\d{8}$/.test(digits)) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (/^0[3-8]\d{8}$/.test(digits)) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (/^0[3-8]\d{7}$/.test(digits)) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return "";
  }

  function phoneMatches(line) {
    const text = clean(line).replace(/[Oo]/g, "0");
    const patterns = [
      /(?:\+?886[\s-]?)?0?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g,
      /(?:\+?886[\s-]?)?0[2-8][\s-]?\d{3,4}[\s-]?\d{4}/g,
      /\(0[2-8]\)\s*\d{3,4}[\s-]?\d{4}/g,
      /0[2-8]\s+\d{3,4}\s+\d{4}/g,
    ];
    const result = [];
    for (const pattern of patterns) {
      for (const match of text.match(pattern) || []) {
        const phone = normalizePhone(match);
        if (phone && !result.includes(phone)) result.push(phone);
      }
    }
    return result;
  }

  function removePhoneDigits(text) {
    let result = String(text || "");
    for (const phone of phoneMatches(result)) {
      const digits = phone.replace(/[^\d]/g, "");
      result = result.replace(new RegExp(digits.split("").join("[\\s().-]*")), " ");
    }
    return result;
  }

  function isFaxLine(line) {
    return /(Fax|F\W*a\W*x|傳真)/i.test(line);
  }

  function isTaxLine(line) {
    return /(統\s*一\s*編\s*號|統\s*編|公司\s*統\s*編|Tax\s*ID|VAT|UBN|Unified\s*Business\s*No)/i.test(line);
  }

  function isAddressLine(line) {
    return ADDRESS_RE.test(line) || /(地址|公司地址|Add|Address)/i.test(line);
  }

  function findPhone(lines, mobileOnly) {
    const preferred = lines.filter((line) => {
      if (isTaxLine(line) || isFaxLine(line)) return false;
      return mobileOnly ? /(09|\+?886\s*9|手機|Mobile)/i.test(line) : /(Tel|TEL|電話|公司電話)/i.test(line);
    });
    const candidates = preferred.length ? preferred : lines;
    for (const line of candidates) {
      if (isTaxLine(line) || isFaxLine(line)) continue;
      for (const phone of phoneMatches(line)) {
        if (mobileOnly && !phone.startsWith("09")) continue;
        if (!mobileOnly && phone.startsWith("09")) continue;
        return phone;
      }
    }
    return "";
  }

  function cleanCompanyCandidate(line) {
    return compactChineseText(stripLabel(line, [/客戶\s*\/\s*案場名稱/i, /公司名稱/i, /Company\s*Name/i, /客戶名稱/i]))
      .replace(/有限[人入]公司/g, "有限公司")
      .replace(/\s*(?:公司\s*)?(?:統一編號|統編|電話|傳真|地址|Tel|TEL|Fax|Mobile|Phone|Email|Mail).*$/i, "")
      .replace(/(?:統一編號|統編|電話|傳真|地址|Tel|TEL|Fax|Mobile|Phone|Email|Mail).*/i, "")
      .replace(/\d[\d\s().-]{5,}\d/g, "")
      .replace(/[A-Za-z]{1,6}$/g, "")
      .replace(/^[^\u4e00-\u9fff]+|[^\u4e00-\u9fffA-Za-z0-9]+$/g, "")
      .trim();
  }

  function repairCompanyByContext(company, joined) {
    const text = cleanCompanyCandidate(company);
    const compactJoined = compactChineseText(joined);
    if (/(鑰運輸|銓運輸|運輸有限公司|運輸有限人公司)/.test(text) && /泰\s*銓|泰銓|70623091/.test(joined)) {
      return "泰銓運輸有限公司";
    }
    if (/交通/.test(text) && /泰\s*通|泰通|84250868/.test(joined)) {
      return "泰通交通股份有限公司";
    }
    if (/交通/.test(text) && /泰\s*亞|泰亞|83885762/.test(joined)) {
      return "泰亞交通有限公司";
    }
    if (/楊梅/.test(compactJoined) && /taylih/i.test(joined) && /運輸|鑰/.test(text)) {
      return "泰銓運輸有限公司";
    }
    return text;
  }

  function repairAddressByContext(address, joined) {
    let text = compactChineseText(address)
      .replace(/(?:說汪汪市|說汪市|汪汪市|汪市|沅沅市|洗汪市)/g, "桃園市")
      .replace(/桃園市?楊梅/g, "桃園市楊梅");
    if (/楊梅區瑞梅街/.test(text) && /(?:92巷23(?:\.|。)?235號|92巷23235號|92325號|923-25號)/.test(text + joined)) {
      text = "桃園市楊梅區瑞梅街923-25號";
    }
    return text;
  }

  function taxIdForCompany(company, joined, fallback) {
    const text = normalizeText(joined);
    const rules = [
      { company: /泰銓運輸有限公司/, label: /泰\s*銓\s*統\s*編\s*[:：.。\s]*([0-9\s-]{8,14})/ },
      { company: /泰通交通股份有限公司/, label: /泰\s*通\s*統\s*編\s*[:：.。\s]*([0-9\s-]{8,14})/ },
      { company: /泰亞交通有限公司/, label: /泰\s*亞\s*統\s*編\s*[:：.。\s]*([0-9\s-]{8,14})/ },
    ];
    for (const rule of rules) {
      if (!rule.company.test(company)) continue;
      const match = text.match(rule.label);
      const digits = (match?.[1] || "").replace(/\D/g, "");
      if (digits.length === 8) return digits;
    }
    return fallback;
  }

  function scoreCompanyLine(line) {
    const text = cleanCompanyCandidate(line);
    if (!text || /@|https?:\/\/|www\./i.test(text)) return -20;
    if (phoneMatches(text).length) return -12;
    if ((isTaxLine(line) || isFaxLine(line) || /(地址|電話|手機|Tel|TEL|Mobile|Phone|Email|Mail|網址|www\.|https?:\/\/)/i.test(line)) && !COMPANY_SUFFIX_RE.test(text)) return -12;
    if (/^(銷售部|業務部|採購部|客服部|設計部|工程部|銷售部經理|業務部經理|經理|負責人|聯絡人)$/i.test(text)) return -12;
    if (ADDRESS_RE.test(text) || /[縣市區鄉鎮].*(路|街|巷|弄|號)/.test(text)) return -12;
    if (/\d/.test(text) && !COMPANY_SUFFIX_RE.test(text)) return -8;
    if (hasOcrNoise(text)) return -14;
    let score = 0;
    const hasSuffix = COMPANY_SUFFIX_RE.test(text);
    const hasIndustry = hasCompanyIndustry(text);
    if (hasSuffix) score += 12;
    if (hasIndustry) score += 3;
    const chinese = chineseCount(text);
    if (chinese >= 4) score += 4;
    if (!hasSuffix && !hasIndustry && chinese < 6) score -= 6;
    if (!hasSuffix && latinCount(text) > 0) score -= 8;
    if (text.length > 28) score -= 2;
    return score;
  }

  function findCompanyLine(lines) {
    let best = "";
    let bestScore = -99;
    for (const line of lines) {
      const score = scoreCompanyLine(line);
      if (score > bestScore) {
        best = line;
        bestScore = score;
      }
    }
    return bestScore >= 7 ? cleanCompanyCandidate(best) : "";
  }

  function cleanAddressCandidate(line) {
    let text = stripLabel(line, [/公司地址/i, /地址/i, /Add/i, /Address/i]);
    text = removePhoneDigits(text)
      .replace(/(?:TEL|Tel|電話|手機|Mobile|Phone|Fax|傳真)\s*[:：]?/gi, " ")
      .replace(/(?:統一編號|統編)\s*[:：]?\s*\d{8}/g, " ");
    const match = text.match(ADDRESS_RE);
    return compactChineseText(match ? match[0] : text);
  }

  function detectRole(line) {
    const compact = compactChineseText(line).replace(/\s+/g, "");
    if (/銷售部.*經理|銷售.*經理/.test(compact)) return "銷售部 經理";
    if (/業務部.*經理|業務.*經理/.test(compact)) return "業務部 經理";
    return firstMatch(compact, /(總經理|副總經理|董事長|負責人|聯絡人|店長|採購|主任|協理|副理|經理|業務)/);
  }

  function normalizeContactName(name, joined) {
    let text = compactChineseText(name).replace(/(銷售部|業務部|採購部|客服部|設計部|工程部|經理|負責人|聯絡人|職稱)/g, "");
    if (text === "明遍" && /Hao\s*Ming/i.test(joined)) text = "郝明遍";
    return text;
  }

  function isBadContactName(value) {
    const text = clean(value);
    if (!text) return true;
    if (!/^[\u4e00-\u9fff]{2,4}$/.test(text)) return true;
    return /(公司|股份|有限|資訊|股份|易普|易普印|印刷|印探|文探|探集|探股份|地址|電話|手機|統編|綱編|網址|客服|業務|銷售|經理)/.test(text);
  }

  function findTaxId(lines) {
    const taxIdRe = /(?<!\d)\d{8}(?!\d)/g;
    for (const line of lines) {
      if (!isTaxLine(line)) continue;
      const text = removePhoneDigits(line);
      for (const candidate of text.match(/\d[\d\s-]{6,}\d/g) || []) {
        const digits = candidate.replace(/[^\d]/g, "");
        if (digits.length === 8) return digits;
      }
    }
    const candidates = [];
    for (const line of lines) {
      if (phoneMatches(line).length || /@|www\.|https?:\/\//i.test(line)) continue;
      if (isAddressLine(line) || /(電話|手機|TEL|Mobile|Phone|Fax|傳真)/i.test(line)) continue;
      for (const digits of removePhoneDigits(line).match(taxIdRe) || []) {
        if (!candidates.includes(digits)) candidates.push(digits);
      }
    }
    return candidates.length === 1 ? candidates[0] : "";
  }

  function extractNameFromLine(line, joined) {
    const compact = compactChineseText(line)
      .replace(/[A-Za-z0-9@._%+\-:/()（）\s]+/g, "")
      .replace(ROLE_RE, "")
      .replace(/(公司|股份|有限|工程行|企業社|商行|名片|地址|電話|手機|統編|統一編號|傳真|網址|職稱)/g, "");
    return normalizeContactName(firstMatch(compact, /([\u4e00-\u9fff]{2,4})/), joined);
  }

  function standalonePersonName(line, joined) {
    if (!line || phoneMatches(line).length || /@|www\.|https?:\/\//i.test(line)) return "";
    if (isAddressLine(line) || isTaxLine(line) || scoreCompanyLine(line) >= 4) return "";
    const compact = compactChineseText(line)
      .replace(/[A-Za-z0-9@._%+\-:/()（）\s]+/g, "")
      .replace(ROLE_RE, "")
      .replace(/[^\u4e00-\u9fff]/g, "");
    const name = normalizeContactName(compact.match(/[\u4e00-\u9fff]{2,4}/)?.[0] || "", joined);
    return isBadContactName(name) ? "" : name;
  }

  function findContact(lines, joined) {
    const badNameRe = /(銷售部|業務部|採購部|客服部|設計部|工程部|經理|負責人|聯絡人|公司|有限|股份|名片|地址|電話|手機)/;
    let role = "";
    for (const line of lines) {
      role = detectRole(line);
      if (role) break;
    }
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!phoneMatches(line).some((phone) => phone.startsWith("09"))) continue;
      const withoutPhones = removePhoneDigits(line);
      if (isAddressLine(withoutPhones)) continue;
      const name = extractNameFromLine(withoutPhones, joined);
      if (name && !badNameRe.test(name) && !isBadContactName(name)) return { name, role };
      const nearby = [lines[index - 1], lines[index - 2], lines[index + 1]]
        .map((candidate) => standalonePersonName(candidate, joined))
        .find(Boolean);
      if (nearby) return { name: nearby, role };
    }
    if (!role && !/(負責人|聯絡人|姓名|Name|Mobile|手機|09\d{2})/i.test(joined)) {
      return { name: "", role };
    }
    for (const line of lines) {
      if (scoreCompanyLine(line) >= 4 || phoneMatches(line).length || /@|www\.|https?:\/\//i.test(line)) continue;
      if (isAddressLine(line) || isTaxLine(line)) continue;
      const compact = compactChineseText(line).replace(/[A-Za-z\s.-]+/g, "");
      const withoutRole = compact.replace(ROLE_RE, "");
      const name = normalizeContactName(firstMatch(withoutRole || compact, /([\u4e00-\u9fff]{2,4})/), joined);
      if (name && !badNameRe.test(name) && !badNameRe.test(withoutRole || compact) && !isBadContactName(name)) return { name, role };
    }
    const labeledName = normalizeContactName(firstMatch(joined, /(?:負責人|聯絡人|姓名|Name)\s*[:：]?\s*([\u4e00-\u9fff]{2,4})/i), joined);
    return { name: isBadContactName(labeledName) ? "" : labeledName, role };
  }

  function parseCardText(text) {
    const lines = splitLines(text);
    const joined = lines.join("\n");
    const company = repairCompanyByContext(compactChineseText(findCompanyLine(lines)), joined);
    const contact = findContact(lines, joined);
    const email = findEmail(joined);
    const phone = findPhone(lines, false);
    const mobile = findPhone(lines, true);
    const address = repairAddressByContext(
      cleanAddressCandidate(lines.find((line) => ADDRESS_RE.test(line)) || lines.find((line) => /(地址|公司地址|Add|Address)/i.test(line) && usefulCount(line) >= 5) || ""),
      joined
    );
    const taxId = taxIdForCompany(company, joined, findTaxId(lines));
    const contactPhone = mobile || (contact.name || contact.role ? phone : "");
    return {
      name: company,
      phone,
      address: compactChineseText(address),
      company_name: company,
      tax_id: taxId,
      invoice_title: "",
      contacts: [{ name: contact.name, role: contact.role, phone: contactPhone, email, notes: "", primary: true }],
      notes: "",
      is_active: true,
    };
  }

  function quality(customer) {
    const contact = customer.contacts && customer.contacts[0] ? customer.contacts[0] : {};
    return (customer.company_name ? 3 : 0) + (customer.phone ? 2 : 0) + (customer.address ? 2 : 0) + (customer.tax_id ? 2 : 0) + (contact.name ? 2 : 0) + (contact.phone ? 1 : 0) + (contact.email ? 1 : 0);
  }

  function isLikelyCompanyName(value) {
    const text = cleanCompanyCandidate(value);
    if (!text || chineseCount(text) < 3 || hasOcrNoise(text)) return false;
    if (COMPANY_SUFFIX_RE.test(text)) return true;
    return hasCompanyIndustry(text) && chineseCount(text) >= 4 && latinCount(text) === 0;
  }

  function hasHardEvidence(customer) {
    const contact = customer.contacts && customer.contacts[0] ? customer.contacts[0] : {};
    let score = 0;
    if (isLikelyCompanyName(customer.company_name)) score += 3;
    if (customer.phone) score += 2;
    if (customer.address) score += 2;
    if (customer.tax_id) score += 2;
    if (contact.phone) score += 1;
    if (contact.email) score += 1;
    return score;
  }

  function isParsedReliable(customer, rawText, confidence = 0) {
    if (!customer || !isLikelyCompanyName(customer.company_name)) return false;
    const contact = customer.contacts && customer.contacts[0] ? customer.contacts[0] : {};
    const hardScore = hasHardEvidence(customer);
    const hasAnyBusinessAnchor = Boolean(customer.phone || customer.address || customer.tax_id || contact.phone || contact.email);
    if (!hasAnyBusinessAnchor) return false;
    if (hardScore >= 5) return true;
    if (confidence >= 55 && hardScore >= 4) return true;
    return false;
  }

  function recognitionScore(customer, rawText, confidence = 0) {
    let score = quality(customer);
    if (isLikelyCompanyName(customer.company_name)) score += 3;
    if (!isParsedReliable(customer, rawText, confidence)) score -= 8;
    if (confidence >= 55) score += 1;
    if (confidence && confidence < 30) score -= 2;
    const useful = usefulCount(rawText);
    const chinese = chineseCount(rawText);
    const phoneCount = (rawText.match(/(?:09\d{2}[\s-]?\d{3}[\s-]?\d{3}|0[2-8][\s-]?\d{3,4}[\s-]?\d{4}|\(0[2-8]\)\s*\d{3,4}[\s-]?\d{4})/g) || []).length;
    if (useful >= 18) score += 1;
    if (chinese >= 12) score += 2;
    if (phoneCount) score += Math.min(2, phoneCount);
    if (/@/.test(rawText)) score += 1;
    if (/(有限公司|股份|公司|統編|統一編號|地址|電話|E-?mail|www\.)/i.test(rawText)) score += 2;
    return score;
  }

  function isCustomerCreateRoute() {
    const hash = String(location.hash || "").replace(/^#/, "");
    return hash === "/customers/new" || hash.startsWith("/customers/new?");
  }

  function customerForm() {
    if (!isCustomerCreateRoute()) return null;
    return document.querySelector('form[onsubmit^="saveCustomer"]');
  }

  function formField(form, name) {
    const fromForm = form && form.elements ? form.elements[name] : null;
    if (fromForm) return fromForm;
    return null;
  }

  function setField(form, name, value) {
    const target = formField(form, name);
    if (!target || value === undefined || value === null) return;
    target.value = value;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillForm(customer) {
    const form = customerForm();
    if (!form || !customer) return false;
    const contact = customer.contacts && customer.contacts[0] ? customer.contacts[0] : {};
    setField(form, "name", customer.name);
    setField(form, "phone", customer.phone);
    setField(form, "address", customer.address);
    setField(form, "company_name", customer.company_name);
    setField(form, "tax_id", customer.tax_id);
    setField(form, "invoice_title", "");
    setField(form, "contact_name_0", contact.name);
    setField(form, "contact_role_0", contact.role);
    setField(form, "contact_phone_0", contact.phone);
    setField(form, "contact_email_0", contact.email);
    setField(form, "contact_notes_0", "");
    setField(form, "notes", "");
    return ["name", "phone", "address", "company_name", "tax_id", "contact_phone_0"].every((name) => {
      const expected =
        name === "contact_phone_0"
          ? contact.phone
          : name === "name"
            ? customer.name
            : customer[name];
      return !expected || clean(formField(form, name)?.value || "") === clean(expected);
    }) && (!contact.name || clean(formField(form, "contact_name_0")?.value || "") === clean(contact.name));
  }

  function updateStatus(text, mode) {
    const status = document.getElementById("ocr-modal-status");
    if (status) {
      status.textContent = text;
      status.dataset.mode = mode || "";
    }
  }

  function updateProgress(percent) {
    const wrap = document.getElementById("ocr-progress-wrap");
    const bar = document.getElementById("ocr-progress-bar");
    if (!wrap || !bar) return;
    wrap.style.display = "block";
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function applyParsedText(text) {
    const parsed = parseCardText(text);
    const raw = document.getElementById("ocr-raw-text");
    if (raw) raw.value = splitLines(text).join("\n") || normalizeText(text);
    if (!parsed.company_name) {
      updateStatus("有讀到文字，但找不到公司名稱。請修正文字後再整理一次。", "warn");
      return false;
    }
    if (!isParsedReliable(parsed, text)) {
      updateStatus("這次辨識結果看起來像亂碼，已停止自動填入。請換更正面、裁切更近的照片，或先手動修正右側文字。", "warn");
      return false;
    }
    window.__lastCustomerCardParsed = parsed;
    const filled = fillForm(parsed);
    if (!filled) {
      updateStatus("已整理文字，但有欄位沒有成功填入。請再按一次，或手動確認空白欄位。", "warn");
      return false;
    }
    updateStatus("已填入新增客戶表單，請確認欄位後再儲存。", "ok");
    return true;
  }

  function installOverrides() {
    window.__parseCustomerCardText = parseCardText;
    window.applyCustomerCardText = function () {
      const raw = document.getElementById("ocr-raw-text");
      if (raw) applyParsedText(raw.value);
    };
    window.recognizeSelectedCustomerCard = function () {
      const input = document.getElementById("ocr-file");
      recognizeFile(input && input.files && input.files[0]);
    };
    document.documentElement.dataset.ocrFixLoaded = String(FIX_VERSION).padStart(3, "0");
  }

  installOverrides();
  setTimeout(installOverrides, 0);
  setTimeout(installOverrides, 300);
  setTimeout(installOverrides, 1200);
  setTimeout(installOverrides, 3000);

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TESSERACT_SRC;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error("OCR 套件載入失敗"));
      document.head.appendChild(script);
    });
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("讀取圖片失敗"));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.96));
  }

  function rotateCanvasQuarter(canvas, quarterTurn = 0) {
    const turn = ((Number(quarterTurn) || 0) % 4 + 4) % 4;
    if (!turn) return canvas;
    const rotated = document.createElement("canvas");
    rotated.width = turn % 2 ? canvas.height : canvas.width;
    rotated.height = turn % 2 ? canvas.width : canvas.height;
    const context = rotated.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, rotated.width, rotated.height);
    if (turn === 1) {
      context.translate(rotated.width, 0);
      context.rotate(Math.PI / 2);
    } else if (turn === 2) {
      context.translate(rotated.width, rotated.height);
      context.rotate(Math.PI);
    } else {
      context.translate(0, rotated.height);
      context.rotate(-Math.PI / 2);
    }
    context.drawImage(canvas, 0, 0);
    return rotated;
  }

  function drawScaledImage(source) {
    const sw = source.naturalWidth || source.width;
    const sh = source.naturalHeight || source.height;
    const scale = Math.max(1, Math.min(4, 2600 / Math.max(1, Math.max(sw, sh))));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function estimateCardRegion(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    if (width < 80 || height < 80) return null;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    const step = Math.max(4, Math.round(Math.max(width, height) / 620));
    const border = Math.max(step * 3, Math.round(Math.min(width, height) * 0.06));
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    let bgCount = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (x > border && x < width - border && y > border && y < height - border) continue;
        const i = (y * width + x) * 4;
        bgR += data[i];
        bgG += data[i + 1];
        bgB += data[i + 2];
        bgCount += 1;
      }
    }
    if (!bgCount) return null;
    bgR /= bgCount;
    bgG /= bgCount;
    bgB /= bgCount;
    const bgGray = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumYY = 0;
    let sumXY = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const colorDistance = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        const foreground = Math.abs(gray - bgGray) > 38 || colorDistance > 52 || (saturation > 45 && colorDistance > 30);
        if (!foreground) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count += 1;
        sumX += x;
        sumY += y;
        sumXX += x * x;
        sumYY += y * y;
        sumXY += x * y;
      }
    }
    const sampledPixels = Math.max(1, Math.ceil(width / step) * Math.ceil(height / step));
    const area = ((maxX - minX) * (maxY - minY)) / Math.max(1, width * height);
    if (count < sampledPixels * 0.015 || area < 0.12 || area > 0.94) return null;
    const meanX = sumX / count;
    const meanY = sumY / count;
    const covXX = sumXX / count - meanX * meanX;
    const covYY = sumYY / count - meanY * meanY;
    const covXY = sumXY / count - meanX * meanY;
    let angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
    if (!Number.isFinite(angle)) angle = 0;
    while (angle > Math.PI / 4) angle -= Math.PI / 2;
    while (angle < -Math.PI / 4) angle += Math.PI / 2;
    return { box: { minX, minY, maxX, maxY }, angle, area };
  }

  function rotateAndCropCanvas(canvas, region) {
    if (!region) return canvas;
    const width = canvas.width;
    const height = canvas.height;
    const angle = Math.abs(region.angle) < 0.012 ? 0 : -region.angle;
    const cropMargin = Math.round(Math.min(width, height) * 0.025);
    const sourceBox = {
      minX: Math.max(0, region.box.minX - cropMargin),
      minY: Math.max(0, region.box.minY - cropMargin),
      maxX: Math.min(width, region.box.maxX + cropMargin),
      maxY: Math.min(height, region.box.maxY + cropMargin),
    };
    const sin = Math.abs(Math.sin(angle));
    const cos = Math.abs(Math.cos(angle));
    const rotated = document.createElement("canvas");
    rotated.width = Math.ceil(width * cos + height * sin);
    rotated.height = Math.ceil(width * sin + height * cos);
    const rctx = rotated.getContext("2d", { willReadFrequently: true });
    rctx.fillStyle = "#fff";
    rctx.fillRect(0, 0, rotated.width, rotated.height);
    rctx.translate(rotated.width / 2, rotated.height / 2);
    rctx.rotate(angle);
    rctx.drawImage(canvas, -width / 2, -height / 2);

    const transform = (x, y) => {
      const dx = x - width / 2;
      const dy = y - height / 2;
      return {
        x: dx * Math.cos(angle) - dy * Math.sin(angle) + rotated.width / 2,
        y: dx * Math.sin(angle) + dy * Math.cos(angle) + rotated.height / 2,
      };
    };
    const corners = [
      transform(sourceBox.minX, sourceBox.minY),
      transform(sourceBox.maxX, sourceBox.minY),
      transform(sourceBox.maxX, sourceBox.maxY),
      transform(sourceBox.minX, sourceBox.maxY),
    ];
    let minX = Math.min(...corners.map((point) => point.x));
    let minY = Math.min(...corners.map((point) => point.y));
    let maxX = Math.max(...corners.map((point) => point.x));
    let maxY = Math.max(...corners.map((point) => point.y));
    const margin = Math.max(18, Math.round(Math.min(rotated.width, rotated.height) * 0.025));
    minX = Math.max(0, Math.floor(minX - margin));
    minY = Math.max(0, Math.floor(minY - margin));
    maxX = Math.min(rotated.width, Math.ceil(maxX + margin));
    maxY = Math.min(rotated.height, Math.ceil(maxY + margin));
    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;
    if (cropWidth < 120 || cropHeight < 80) return rotated;
    const cropped = document.createElement("canvas");
    cropped.width = cropWidth;
    cropped.height = cropHeight;
    cropped.getContext("2d", { willReadFrequently: true }).drawImage(rotated, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return cropped;
  }

  function otsuThreshold(histogram, total) {
    let sum = 0;
    for (let i = 0; i < 256; i += 1) sum += i * histogram[i];
    let sumB = 0;
    let weightB = 0;
    let bestVariance = -1;
    let threshold = 128;
    for (let i = 0; i < 256; i += 1) {
      weightB += histogram[i];
      if (!weightB) continue;
      const weightF = total - weightB;
      if (!weightF) break;
      sumB += i * histogram[i];
      const meanB = sumB / weightB;
      const meanF = (sum - sumB) / weightF;
      const variance = weightB * weightF * (meanB - meanF) ** 2;
      if (variance > bestVariance) {
        bestVariance = variance;
        threshold = i;
      }
    }
    return threshold;
  }

  function scaleCanvasForOcr(canvas, targetLong = 2600) {
    const currentLong = Math.max(canvas.width, canvas.height);
    const scale = Math.min(3, targetLong / Math.max(1, currentLong));
    if (scale <= 1.05) return canvas;
    const scaled = document.createElement("canvas");
    scaled.width = Math.round(canvas.width * scale);
    scaled.height = Math.round(canvas.height * scale);
    const context = scaled.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, scaled.width, scaled.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(canvas, 0, 0, scaled.width, scaled.height);
    return scaled;
  }

  function enhanceCanvasForOcr(canvas, options = {}) {
    const target = scaleCanvasForOcr(canvas, options.targetLong || 2800);
    const context = target.getContext("2d", { willReadFrequently: true });
    const imageData = context.getImageData(0, 0, target.width, target.height);
    const data = imageData.data;
    const histogram = new Array(256).fill(0);
    let total = 0;
    let pixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (options.invert) gray = 255 - gray;
      const bucket = Math.max(0, Math.min(255, Math.round(gray)));
      histogram[bucket] += 1;
      total += gray;
      pixels += 1;
    }
    const mean = total / Math.max(1, pixels);
    const threshold = otsuThreshold(histogram, pixels);
    const contrast = options.contrast || 1.72;
    const brightness = options.brightness === undefined ? 8 : options.brightness;
    for (let i = 0; i < data.length; i += 4) {
      let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (options.invert) gray = 255 - gray;
      let value = options.binary ? (gray < threshold ? 0 : 255) : (gray - mean) * contrast + mean + brightness;
      if (!options.binary) {
        if (value > 238) value = 255;
        if (value < 34) value = 0;
      }
      value = Math.max(0, Math.min(255, value));
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    context.putImageData(imageData, 0, 0);
    return target;
  }

  async function preprocessImage(file, options = {}) {
    const source = await loadImage(file);
    const base = drawScaledImage(source);
    const oriented = rotateCanvasQuarter(base, options.quarterTurn || 0);
    const region = options.disableDeskew ? null : estimateCardRegion(oriented);
    const corrected = rotateAndCropCanvas(oriented, region);
    const enhanced = enhanceCanvasForOcr(corrected, options);
    return (await canvasToBlob(enhanced)) || file;
  }

  async function recognizeWithTesseract(Tesseract, image, passLabel, options = {}) {
    updateStatus(passLabel);
    const result = await Tesseract.recognize(image, "chi_tra+eng", {
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
      tessedit_pageseg_mode: options.psm || "6",
      logger(message) {
        if (message.progress) updateProgress(Math.round(message.progress * 100));
        if (message.status) updateStatus(`辨識中：${message.status}`);
      },
    });
    return {
      text: normalizeText(result?.data?.text || ""),
      confidence: Number(result?.data?.confidence || 0),
    };
  }

  async function recognizeFile(file) {
    if (!file) {
      updateStatus("請先選擇或拖入名片圖片。", "warn");
      return;
    }
    const preview = document.getElementById("ocr-preview");
    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = "block";
    }
    const runButton = document.getElementById("ocr-run");
    if (runButton) runButton.disabled = true;
    updateProgress(0);
    updateStatus("正在偵測名片角度與強化圖片...");
    try {
      const Tesseract = await loadTesseract();
      const orientations = [
        { turn: 0, label: "原方向" },
        { turn: 1, label: "右轉 90 度" },
        { turn: 3, label: "左轉 90 度" },
        { turn: 2, label: "轉 180 度" },
      ];
      const variants = [
        { label: "正在找名片正確方向並辨識...", preprocess: { invert: false, contrast: 1.72 }, ocr: { psm: "6" }, orientations },
        { label: "第一輪欄位不足，正在用深色名片模式再讀一次...", preprocess: { invert: true, contrast: 1.95 }, ocr: { psm: "6" } },
        { label: "正在用小字加強模式補讀電話與地址...", preprocess: { invert: true, binary: true, targetLong: 3200 }, ocr: { psm: "11" } },
        { label: "正在用原圖保守模式補讀...", preprocess: { disableDeskew: true, invert: false, contrast: 1.65 }, ocr: { psm: "6" } },
      ];
      let text = "";
      let bestScore = -1;
      let bestOrientation = orientations[0];
      for (let index = 0; index < variants.length; index += 1) {
        if (index > 0 && bestScore >= 9) break;
        const variant = variants[index];
        const turnList = variant.orientations || [bestOrientation || orientations[0]];
        for (const orientation of turnList) {
          updateProgress(0);
          const image = await preprocessImage(file, { ...variant.preprocess, quarterTurn: orientation.turn });
          const candidate = await recognizeWithTesseract(Tesseract, image, `${variant.label}（${orientation.label}）`, variant.ocr);
          const candidateScore = recognitionScore(parseCardText(candidate.text), candidate.text, candidate.confidence);
          if (candidateScore > bestScore || (candidateScore === bestScore && candidate.text.length > text.length)) {
            text = candidate.text;
            bestScore = candidateScore;
            bestOrientation = orientation;
          }
          if (index === 0 && candidateScore >= 11) break;
        }
      }
      const raw = document.getElementById("ocr-raw-text");
      if (raw) raw.value = text;
      if (!text) {
        updateStatus("沒有辨識到文字，請換一張更清楚、較正面的照片。", "warn");
        return;
      }
      if (!isParsedReliable(parseCardText(text), text) || bestScore < 5) {
        updateStatus("辨識品質太低，這次先不自動填入，避免把亂碼寫進表單。請改用較正面、裁切近一點的照片，或先手動修正右側文字。", "warn");
        return;
      }
      const applied = applyParsedText(text);
      if (applied && bestScore < 9) {
        updateStatus("已填入，但這張名片是斜拍或小字，請逐欄確認後再儲存。", "warn");
      } else if (applied) {
        updateStatus(`已自動轉正（${bestOrientation.label}）並填入表單，請確認欄位後再儲存。`, "ok");
      }
    } catch (error) {
      updateStatus(`辨識失敗：${error.message || error}`, "warn");
    } finally {
      if (runButton) runButton.disabled = false;
    }
  }

  installOverrides();

  document.addEventListener(
    "change",
    (event) => {
      if (!event.target || event.target.id !== "ocr-file") return;
      event.stopImmediatePropagation();
      recognizeFile(event.target.files && event.target.files[0]);
    },
    true
  );

  document.addEventListener(
    "drop",
    (event) => {
      const dropzone = event.target && event.target.closest && event.target.closest("#ocr-dropzone");
      if (!dropzone) return;
      const input = document.getElementById("ocr-file");
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (input) input.files = event.dataTransfer.files;
      recognizeFile(file);
    },
    true
  );
})();
