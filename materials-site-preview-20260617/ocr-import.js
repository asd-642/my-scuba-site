(() => {
  const PANEL = 'customer-card-import-panel';
  const MODAL = 'customer-card-ocr-modal';
  const STYLE = 'customer-card-ocr-style';
  const SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const $ = (s, r = document) => r.querySelector(s);

  function norm(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/\r/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, '')
      .replace(/[\uE000-\uF8FF\uFFF0-\uFFFF]/g, '')
      .replace(/[﹕︰]/g, ':')
      .replace(/[‐‑‒–—―]/g, '-')
      .replace(/[|｜]/g, ' ')
      .replace(/[·•●◆◇■□▲△▼▽★☆]/g, ' ')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  const clean = (v) => norm(v).replace(/\s+/g, ' ').trim();
  const useful = (v) => ((String(v || '').match(/[\u4e00-\u9fffA-Za-z0-9@]/g) || []).length);
  function noise(line) {
    const text = clean(line);
    if (!text) return true;
    if (/^(logo|your name|you name|name|company name|company|design|sample)$/i.test(text)) return true;
    return text.length >= 6 && useful(text) / text.length < 0.35;
  }
  const lines = (t) => norm(t).split('\n').map(clean).filter((line) => line && !noise(line));
  const first = (t, r) => { const m = String(t || '').match(r); return m ? clean(m[1] || m[0]) : ''; };
  const get = (o, keys) => { for (const k of keys) { const v = clean(o && o[k]); if (v) return v; } return ''; };
  const strip = (line, labels) => {
    let text = clean(line);
    labels.forEach((label) => { text = text.replace(label, ''); });
    return clean(text.replace(/^[:：\-\s]+|[:：\-\s]+$/g, ''));
  };

  function decode(value) {
    let text = clean(value);
    if (!text) return null;
    try { if (text.startsWith('{')) return JSON.parse(text); } catch (_) { return null; }
    try { text = decodeURIComponent(text); } catch (_) {}
    try {
      const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) { return null; }
  }

  function normPhone(value) {
    let digits = clean(value).replace(/[Oo]/g, '0').replace(/[^\d]/g, '');
    if (digits.startsWith('886')) digits = `0${digits.slice(3)}`;
    if (digits.length === 9 && digits.startsWith('9')) digits = `0${digits}`;
    if (/^09\d{8}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    if (/^02\d{8}$/.test(digits)) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    if (/^0[3-8]\d{7}$/.test(digits)) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    if (/^0[3-8]\d{8}$/.test(digits)) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    return '';
  }

  function phoneOf(ls, mobileOnly = false) {
    const phoneLike = /(?:\+?886[\s-]?)?(?:0|9)[\d\s().-]{7,}\d/g;
    for (const line of ls) {
      if (/(統一編號|統編|Tax|VAT)/i.test(line)) continue;
      const matches = line.replace(/[Oo]/g, '0').match(phoneLike) || [];
      for (const match of matches) {
        const phone = normPhone(match);
        if (!phone) continue;
        if (mobileOnly && !phone.startsWith('09')) continue;
        if (!mobileOnly && phone.startsWith('09')) continue;
        return phone;
      }
    }
    return '';
  }

  function companyScore(line) {
    const text = clean(line);
    if (!text || /@|https?:\/\/|www\./i.test(text)) return -20;
    if (phoneOf([text]) || /(地址|Add|Address|電話|手機|TEL|FAX|Email|Mail|網址|統一編號|統編)/i.test(text)) return -12;
    if (/^(logo|name|design|sales manager|manager)$/i.test(text)) return -12;
    let score = 0;
    if (/(有限公司|股份有限公司|企業社|工程行|商行|行號|公司)$/.test(text)) score += 8;
    if (/(建材|材料|五金|工程|設計|裝潢|家具|傢俱|水果|蔬果|行號|公司|企業社|商行)/.test(text)) score += 4;
    const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    if (chinese >= 4) score += 4;
    if (text.length > 28) score -= 2;
    if (/[A-Za-z]{12,}/.test(text) && chinese === 0) score -= 4;
    return score;
  }
  function companyOf(ls) {
    let best = '';
    let score = -1;
    ls.forEach((line) => {
      const value = companyScore(line);
      if (value > score) { best = line; score = value; }
    });
    if (score >= 4) return strip(best, [/公司名稱/i, /Company\s*Name/i, /客戶名稱/i]);
    return ls.find((line) => /[\u4e00-\u9fff]{4,}/.test(line) && companyScore(line) > -10) || '';
  }
  function addressOf(ls) {
    const addressRe = /(?:台|臺).{0,10}(?:市|縣).{0,12}(?:區|鄉|鎮|市)?.*(?:路|街|巷|弄|號|樓|室)/;
    return ls.find((line) => addressRe.test(line)) || ls.find((line) => /(地址|公司地址|Add|Address)/i.test(line) && useful(line) >= 5) || '';
  }
  function contactOf(ls, joined) {
    const roleRe = /(負責人|聯絡人|業務|經理|總經理|董事長|店長|採購|主任|協理|副理)/;
    for (const line of ls) {
      const role = first(line, roleRe);
      if (!role) continue;
      const name = first(strip(line, [roleRe, /姓名/i, /Name/i]), /([\u4e00-\u9fff]{2,4})/);
      return { name, role };
    }
    const name = first(joined, /(?:負責人|聯絡人|姓名|Name)\s*[:：]?\s*([\u4e00-\u9fff]{2,4})/i);
    return { name, role: name ? '聯絡人' : '' };
  }

  function parse(text) {
    const ls = lines(text);
    const joined = ls.join('\n');
    const email = first(joined, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const websiteLine = ls.find((line) => !/@/.test(line) && /(?:https?:\/\/|www\.)/i.test(line)) || ls.find((line) => !/@/.test(line) && /[A-Z0-9-]+(?:\.[A-Z0-9-]+){1,}/i.test(line)) || '';
    const website = first(websiteLine, /(?:https?:\/\/)?(?:www\.)?[A-Z0-9-]+(?:\.[A-Z0-9-]+)+(?:\/[^\s]*)?/i);
    const taxId = first(joined, /(?:統一編號|統編|Tax\s*ID|VAT|UBN)\s*[:：]?\s*(\d{8})/i) || first(ls.filter((line) => !phoneOf([line])).join('\n'), /\b(\d{8})\b/);
    const company = companyOf(ls);
    const addressLine = addressOf(ls);
    const contact = contactOf(ls, joined);
    const phone = phoneOf(ls, false);
    const mobile = phoneOf(ls, true);
    const notes = ls
      .filter((line) => line !== company && line !== addressLine && line !== email && line !== website)
      .filter((line) => !phoneOf([line]) && !/@/.test(line) && !/(統一編號|統編|Tax|VAT)/i.test(line))
      .slice(0, 8)
      .join('\n');
    return {
      customer_name: company,
      company_name: company,
      phone,
      address: strip(addressLine, [/公司地址/i, /地址/i, /Add/i, /Address/i]),
      tax_id: taxId,
      invoice_title: company,
      contact_name: contact.name,
      contact_role: contact.role,
      contact_phone: mobile || phone,
      contact_email: email,
      website,
      notes,
      contacts: [{ name: contact.name, role: contact.role, phone: mobile || phone, email, notes: '', primary: true }],
    };
  }

  function normalizedCard(card) {
    if (!card || typeof card !== 'object') return null;
    const firstContact = Array.isArray(card.contacts) && card.contacts.length ? card.contacts[0] : {};
    const companyName = get(card, ['customer_name', 'company_name', 'company', 'name', '公司名稱', '客戶名稱']);
    const contactName = get(card, ['contact_name', 'person', 'owner', 'manager', '負責人', '聯絡人']) || clean(firstContact.name);
    const contactRole = get(card, ['contact_role', 'role', 'title', '職稱']) || clean(firstContact.role);
    const contactPhone = get(card, ['contact_phone', 'mobile', 'cell', 'cellphone', '手機']) || clean(firstContact.phone);
    const contactEmail = get(card, ['contact_email', 'email', 'mail', '電子信箱']) || clean(firstContact.email);
    const website = get(card, ['website', 'url', 'site', '網址']);
    const notes = [get(card, ['notes', 'memo', 'remark', '備註']), website ? `網站：${website}` : ''].filter(Boolean).join('\n');
    return {
      name: companyName,
      phone: get(card, ['phone', 'company_phone', 'tel', 'telephone', '公司電話', '電話']),
      address: get(card, ['address', 'company_address', 'addr', '公司地址', '地址']),
      company_name: get(card, ['company_name', 'company', '公司名稱']) || companyName,
      tax_id: get(card, ['tax_id', 'vat', 'uniform_number', '統一編號', '統編']),
      invoice_title: get(card, ['invoice_title', 'invoice', '發票抬頭']) || get(card, ['company_name', 'company', '公司名稱']) || companyName,
      contacts: [{ name: contactName, role: contactRole, phone: contactPhone, email: contactEmail, notes: clean(firstContact.notes), primary: true }],
      notes,
      is_active: card.is_active !== false,
    };
  }

  function set(form, name, value) {
    const field = form && form.elements ? form.elements[name] : null;
    if (!field || value === undefined || value === null) return;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function fill(customer) {
    const form = document.querySelector('form[onsubmit^="saveCustomer"]');
    if (!form || !customer) return false;
    const contact = customer.contacts && customer.contacts[0] ? customer.contacts[0] : {};
    set(form, 'name', customer.name);
    set(form, 'phone', customer.phone);
    set(form, 'address', customer.address);
    set(form, 'company_name', customer.company_name);
    set(form, 'tax_id', customer.tax_id);
    set(form, 'invoice_title', customer.invoice_title);
    set(form, 'contact_name_0', contact.name);
    set(form, 'contact_role_0', contact.role);
    set(form, 'contact_phone_0', contact.phone);
    set(form, 'contact_email_0', contact.email);
    set(form, 'contact_notes_0', contact.notes);
    set(form, 'notes', customer.notes);
    if (form.elements.is_active) form.elements.is_active.checked = customer.is_active !== false;
    if (form.elements.contact_primary) form.elements.contact_primary.checked = true;
    return true;
  }

  function status(text, mode = '') { const target = $('#ocr-modal-status'); if (target) { target.textContent = text; target.dataset.mode = mode; } }
  function progress(percent) {
    const wrap = $('#ocr-progress-wrap');
    const bar = $('#ocr-progress-bar');
    if (!wrap || !bar) return;
    wrap.style.display = 'block';
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片讀取失敗')); };
      image.src = url;
    });
  }
  function canvasBlob(canvas) { return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png', 0.96)); }
  async function preprocess(file) {
    const image = await loadImage(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = Math.max(1, Math.min(3, 2400 / Math.max(sourceWidth, sourceHeight, 1)));
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return file;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);
    const dataSet = context.getImageData(0, 0, width, height);
    const data = dataSet.data;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const mean = total / (data.length / 4);
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      let value = (gray - mean) * 1.55 + mean + 8;
      if (value > 236) value = 255;
      if (value < 38) value = 0;
      value = Math.max(0, Math.min(255, value));
      data[i] = value; data[i + 1] = value; data[i + 2] = value;
    }
    context.putImageData(dataSet, 0, 0);
    return (await canvasBlob(canvas)) || file;
  }
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SRC}"]`);
      if (existing) { existing.addEventListener('load', () => resolve(window.Tesseract)); existing.addEventListener('error', reject); return; }
      const script = document.createElement('script');
      script.src = SRC;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error('OCR 套件載入失敗'));
      document.head.appendChild(script);
    });
  }
  function applyText(text) {
    const cleaned = lines(text).join('\n') || norm(text);
    const customer = normalizedCard(parse(cleaned));
    if (!customer || !customer.name) { status('有讀到文字，但找不到公司名稱。請手動補文字後按「整理並填入」。', 'warn'); return false; }
    fill(customer);
    const raw = $('#ocr-raw-text');
    if (raw) raw.value = cleaned;
    status('已填入新增客戶表單，請關閉視窗後確認欄位。', 'ok');
    return true;
  }
  async function recognize(file) {
    if (!file) { status('請先選擇或拖入名片圖片。', 'warn'); return; }
    const preview = $('#ocr-preview');
    if (preview) { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
    const button = $('#ocr-run');
    if (button) button.disabled = true;
    progress(0);
    status('正在強化圖片清晰度...');
    try {
      const enhanced = await preprocess(file);
      const Tesseract = await loadTesseract();
      const lang = $('#ocr-language')?.value || 'chi_tra+eng';
      status('正在載入 OCR 模型，第一次會比較久...');
      const result = await Tesseract.recognize(enhanced, lang, {
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        tessedit_pageseg_mode: '6',
        logger(message) {
          if (message.progress) progress(Math.round(message.progress * 100));
          if (message.status) status(`辨識中：${message.status}`);
        },
      });
      const text = norm(result?.data?.text || '');
      if (!text) { status('沒有辨識到文字，請換一張更清楚、較正面的照片。', 'warn'); return; }
      applyText(text);
    } catch (error) {
      status(`辨識失敗：${error.message || error}`, 'warn');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function ensureStyle() {
    if ($(`#${STYLE}`)) return;
    const style = document.createElement('style');
    style.id = STYLE;
    style.textContent = `.ocr-card-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.ocr-modal-backdrop{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.48);padding:18px}.ocr-modal-backdrop.is-open{display:flex}.ocr-modal{width:min(900px,100%);max-height:min(760px,calc(100vh - 36px));overflow:auto;background:#fff;border:1px solid #dde1e7;border-radius:10px;box-shadow:0 24px 80px rgba(15,23,42,.28)}.ocr-modal-head{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:18px 20px;border-bottom:1px solid #e5e7eb}.ocr-modal-title{margin:0;font-size:20px;line-height:1.2}.ocr-modal-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.8fr);gap:18px;padding:20px}.ocr-dropzone{display:grid;place-items:center;min-height:190px;border:1px dashed #aeb6c2;border-radius:8px;background:#fafbfc;padding:18px;text-align:center}.ocr-dropzone.is-drag{border-color:#111827;background:#f0f3f7}.ocr-dropzone input{max-width:100%}.ocr-preview{display:none;width:100%;max-height:280px;object-fit:contain;border:1px solid #dde1e7;border-radius:8px;background:#fff;margin-top:12px}.ocr-modal .field{display:grid;gap:8px;margin-bottom:14px}.ocr-modal label{font-size:14px;font-weight:700;color:#30343b}.ocr-modal select,.ocr-modal textarea{width:100%;border:1px solid #c7ccd5;border-radius:8px;background:#fff;color:#16181d;font:inherit;font-size:15px;padding:11px 12px;outline:none}.ocr-modal textarea{min-height:190px;resize:vertical;line-height:1.55}.ocr-modal-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}.ocr-progress-wrap{display:none;height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden;margin-top:12px}.ocr-progress-bar{height:100%;width:0%;background:#111827;transition:width .16s ease}.ocr-status{color:#6b7280;font-size:14px;line-height:1.5}.ocr-status[data-mode=ok]{color:#0f766e;font-weight:700}.ocr-status[data-mode=warn]{color:#b45309;font-weight:700}.ocr-help{margin:0;color:#6b7280;font-size:13px;line-height:1.55}body.ocr-modal-open{overflow:hidden}@media(max-width:760px){.ocr-modal-backdrop{align-items:flex-start;padding:10px}.ocr-modal{max-height:calc(100vh - 20px)}.ocr-modal-head{align-items:flex-start;flex-direction:column}.ocr-modal-body{grid-template-columns:1fr;padding:16px}.ocr-modal .btn{width:100%}}`;
    document.head.appendChild(style);
  }
  function renderPanel(panel) {
    panel.className = 'card customer-card-import';
    panel.id = PANEL;
    panel.innerHTML = `<div class="card-header"><h2>名片資料匯入</h2><button class="btn" type="button" data-ocr-open>開啟名片識別</button></div><div class="card-body"><p class="sub" style="margin:0 0 12px">上傳或拖入名片照片，辨識後會直接填入下面的新增客戶欄位。</p><div class="ocr-card-actions"><button class="btn secondary" type="button" data-ocr-open>上傳名片照片</button><span class="sub" id="customer-card-import-status" aria-live="polite">填完後仍需要人工確認再按「建立」。</span></div></div>`;
    panel.querySelectorAll('[data-ocr-open]').forEach((button) => button.addEventListener('click', openModal));
  }
  function ensureModal() {
    if ($(`#${MODAL}`)) return;
    ensureStyle();
    const modal = document.createElement('div');
    modal.id = MODAL;
    modal.className = 'ocr-modal-backdrop';
    modal.innerHTML = `<div class="ocr-modal" role="dialog" aria-modal="true" aria-labelledby="ocr-modal-title"><div class="ocr-modal-head"><div><h2 class="ocr-modal-title" id="ocr-modal-title">名片識別</h2><p class="ocr-help">拖入名片圖片或選擇檔案，辨識完成後會直接填入新增客戶表單。</p></div><button class="btn secondary" type="button" data-ocr-close>關閉</button></div><div class="ocr-modal-body"><section><div class="field"><label for="ocr-language">辨識語言</label><select id="ocr-language"><option value="chi_tra+eng">繁中 + 英文</option><option value="eng">英文</option></select></div><div class="ocr-dropzone" id="ocr-dropzone"><div><strong>拖曳名片照片到這裡</strong><p class="ocr-help">支援 JPG、PNG、WEBP。也可以按下方選擇檔案。</p><input id="ocr-file" type="file" accept="image/*"></div></div><img class="ocr-preview" id="ocr-preview" alt="名片預覽"><div class="ocr-progress-wrap" id="ocr-progress-wrap"><div class="ocr-progress-bar" id="ocr-progress-bar"></div></div><div class="ocr-modal-actions"><button class="btn" type="button" id="ocr-run">開始辨識並填入</button><button class="btn secondary" type="button" id="ocr-sample">載入文字範例</button></div></section><section><div class="field"><label for="ocr-raw-text">OCR 原始文字</label><textarea id="ocr-raw-text" placeholder="也可以把其他 OCR 工具辨識出的文字貼在這裡。"></textarea></div><div class="ocr-modal-actions"><button class="btn secondary" type="button" id="ocr-apply-text">整理並填入</button></div><p class="ocr-status" id="ocr-modal-status" aria-live="polite">請先選擇或拖入名片圖片。</p></section></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    modal.querySelectorAll('[data-ocr-close]').forEach((button) => button.addEventListener('click', closeModal));
    const fileInput = $('#ocr-file', modal);
    const dropzone = $('#ocr-dropzone', modal);
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const preview = $('#ocr-preview');
      if (preview) { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
      status('圖片已選擇，可以開始辨識。', 'ok');
    });
    ['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add('is-drag'); }));
    ['dragleave', 'drop'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove('is-drag'); }));
    dropzone.addEventListener('drop', (event) => {
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      try { fileInput.files = event.dataTransfer.files; } catch (_) {}
      recognize(file);
    });
    $('#ocr-run', modal).addEventListener('click', () => recognize(fileInput.files && fileInput.files[0]));
    $('#ocr-apply-text', modal).addEventListener('click', () => applyText($('#ocr-raw-text').value));
    $('#ocr-sample', modal).addEventListener('click', () => {
      const sample = ['日盛傢俱工程有限公司', '負責人 王小明', 'TEL O2-2345-6789', '手機 0912-345-678', '台北市信義區松仁路100號8樓', '統一編號 12345678', 'sales@example.com', 'www.example.com.tw'].join('\n');
      $('#ocr-raw-text').value = sample;
      applyText(sample);
    });
  }
  function openModal() { ensureModal(); $(`#${MODAL}`).classList.add('is-open'); document.body.classList.add('ocr-modal-open'); status('請先選擇或拖入名片圖片。'); }
  function closeModal() { const modal = $(`#${MODAL}`); if (modal) modal.classList.remove('is-open'); document.body.classList.remove('ocr-modal-open'); }
  function cardParam() { const hash = window.location.hash || ''; const index = hash.indexOf('?'); return index === -1 ? '' : new URLSearchParams(hash.slice(index + 1)).get('card') || ''; }
  function ensurePanel() {
    if (!window.location.hash.startsWith('#/customers/new')) return;
    let panel = document.querySelector('.customer-card-import');
    if (!panel) {
      const form = document.querySelector('form[onsubmit^="saveCustomer"]');
      if (!form) return;
      const firstCard = form.querySelector('section.card');
      if (!firstCard) return;
      panel = document.createElement('section');
      form.insertBefore(panel, firstCard);
    }
    if (panel.dataset.ocrModalReady !== 'yes') { renderPanel(panel); panel.dataset.ocrModalReady = 'yes'; }
    ensureModal();
    const imported = normalizedCard(decode(cardParam()));
    if (imported && !panel.dataset.ocrCardApplied) {
      fill(imported);
      panel.dataset.ocrCardApplied = 'yes';
      const label = $('#customer-card-import-status');
      if (label) label.textContent = '已從名片辨識帶入資料，請確認後再儲存。';
    }
  }
  window.applyCustomerCardJson = () => { const raw = $('#ocr-raw-text'); if (raw && raw.value) applyText(raw.value); };
  window.BusinessCardOCRModal = { parseCardText: parse, normalizeCard: normalizedCard, fillForm: fill, openModal, closeModal };
  window.addEventListener('hashchange', () => setTimeout(ensurePanel, 0));
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
  window.addEventListener('DOMContentLoaded', () => { ensurePanel(); setTimeout(ensurePanel, 100); setTimeout(ensurePanel, 500); });
  const app = $('#app');
  if (app && window.MutationObserver) new MutationObserver(() => ensurePanel()).observe(app, { childList: true, subtree: true });
})();