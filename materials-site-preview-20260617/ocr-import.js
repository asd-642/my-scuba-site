(() => {
  const PANEL = 'customer-card-import-panel';
  const MODAL = 'customer-card-ocr-modal';
  const SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const $ = (s, r = document) => r.querySelector(s);
  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const lines = (t) => String(t || '').replace(/\r/g, '\n').split('\n').map(clean).filter(Boolean);
  const first = (t, r) => { const m = String(t || '').match(r); return m ? clean(m[1] || m[0]) : ''; };
  const get = (o, keys) => { for (const k of keys) { const v = clean(o && o[k]); if (v) return v; } return ''; };

  function phoneOf(ls, mobile) {
    const m = /(?:\+?886[-\s]?)?09\d{2}[-\s]?\d{3}[-\s]?\d{3}|(?:\+?886[-\s]?)?9\d{2}[-\s]?\d{3}[-\s]?\d{3}/;
    const p = /(?:\+?886[-\s]?)?0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}|\(\d{2,3}\)\s*\d{3,4}[-\s]?\d{3,4}/;
    for (const line of ls) { const hit = line.match(mobile ? m : p); if (hit) return clean(hit[0]); }
    return '';
  }

  function parse(text) {
    const ls = lines(text);
    const joined = ls.join('\n');
    const email = first(joined, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const websiteLine = ls.find((l) => !/@/.test(l) && /(?:https?:\/\/|www\.)/i.test(l)) || ls.find((l) => !/@/.test(l) && /[A-Z0-9-]+(?:\.[A-Z0-9-]+){1,}/i.test(l)) || '';
    const website = first(websiteLine, /(?:https?:\/\/)?(?:www\.)?[A-Z0-9-]+(?:\.[A-Z0-9-]+)+(?:\/[^\s]*)?/i);
    const tax = first(joined, /(?:統一編號|統編|Tax\s*ID|VAT)?\s*[:：]?\s*(\d{8})/i);
    const company = ls.find((l) => /(有限公司|股份有限公司|企業社|工程行|設計|建材|家具|傢俱|水果|行號|公司)/.test(l) && !/@/.test(l)) || ls[0] || '';
    const address = ls.find((l) => /(?:台|臺).{0,8}(?:市|縣).*(?:路|街|巷|弄|號|樓|室)/.test(l)) || ls.find((l) => /(地址|Add|Address)/i.test(l)) || '';
    const roleLine = ls.find((l) => /(負責人|聯絡人|業務|經理|總經理|董事長|店長|採購)/.test(l)) || '';
    const role = first(roleLine, /(負責人|聯絡人|業務|經理|總經理|董事長|店長|採購)/);
    let contact = clean(roleLine.replace(role, '').replace(/[:：]/g, ''));
    if (!contact || contact.length > 8) contact = first(joined, /(?:負責人|聯絡人|業務|經理|總經理|董事長|店長|採購)\s*[:：]?\s*([\u4e00-\u9fff]{2,4})/);
    const phone = phoneOf(ls, false);
    const mobile = phoneOf(ls, true);
    const notes = ls.filter((l) => l !== company && l !== address && l !== roleLine && l !== email && l !== website).slice(0, 8).join('\n');
    return { customer_name: company, company_name: company, phone, address: clean(address.replace(/^(地址|Add|Address)\s*[:：]?/i, '')), tax_id: tax, invoice_title: company, contact_name: contact, contact_role: role, contact_phone: mobile || phone, contact_email: email, website, notes, contacts: [{ name: contact, role, phone: mobile || phone, email, notes: '', primary: true }] };
  }

  function normalize(card) {
    if (!card || typeof card !== 'object') return null;
    const c = Array.isArray(card.contacts) && card.contacts.length ? card.contacts[0] : {};
    const company = get(card, ['customer_name', 'company_name', 'company', 'name', '公司名稱', '客戶名稱']);
    const website = get(card, ['website', 'url', 'site', '網址']);
    const notes = [get(card, ['notes', 'memo', 'remark', '備註']), website ? `網站：${website}` : ''].filter(Boolean).join('\n');
    return { name: company, phone: get(card, ['phone', 'company_phone', 'tel', 'telephone', '公司電話', '電話']), address: get(card, ['address', 'company_address', 'addr', '公司地址', '地址']), company_name: get(card, ['company_name', 'company', '公司名稱']) || company, tax_id: get(card, ['tax_id', 'vat', 'uniform_number', '統一編號']), invoice_title: get(card, ['invoice_title', 'invoice', '發票抬頭']) || get(card, ['company_name', 'company', '公司名稱']) || company, contacts: [{ name: get(card, ['contact_name', 'person', 'owner', 'manager', '負責人', '聯絡人']) || clean(c.name), role: get(card, ['contact_role', 'role', 'title', '職稱']) || clean(c.role), phone: get(card, ['contact_phone', 'mobile', 'cell', 'cellphone', '手機']) || clean(c.phone), email: get(card, ['contact_email', 'email', 'mail', '電子信箱']) || clean(c.email), notes: clean(c.notes), primary: true }], notes, is_active: card.is_active !== false };
  }

  function decodeCard() {
    const h = location.hash || '';
    const i = h.indexOf('?');
    const raw = i < 0 ? '' : new URLSearchParams(h.slice(i + 1)).get('card') || '';
    if (!raw) return null;
    try {
      const text = decodeURIComponent(raw).replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(text.padEnd(Math.ceil(text.length / 4) * 4, '='));
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) { return null; }
  }

  function setField(form, name, value) {
    const el = form && form.elements && form.elements[name];
    if (!el || value == null) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fill(customer) {
    const form = $('form[onsubmit^="saveCustomer"]');
    if (!form || !customer) return false;
    const c = customer.contacts && customer.contacts[0] ? customer.contacts[0] : {};
    setField(form, 'name', customer.name);
    setField(form, 'phone', customer.phone);
    setField(form, 'address', customer.address);
    setField(form, 'company_name', customer.company_name);
    setField(form, 'tax_id', customer.tax_id);
    setField(form, 'invoice_title', customer.invoice_title);
    setField(form, 'contact_name_0', c.name);
    setField(form, 'contact_role_0', c.role);
    setField(form, 'contact_phone_0', c.phone);
    setField(form, 'contact_email_0', c.email);
    setField(form, 'contact_notes_0', c.notes);
    setField(form, 'notes', customer.notes);
    if (form.elements.is_active) form.elements.is_active.checked = customer.is_active !== false;
    if (form.elements.contact_primary) form.elements.contact_primary.checked = true;
    return true;
  }

  function setStatus(text, mode = '') {
    const el = $('#ocr-modal-status');
    if (el) { el.textContent = text; el.dataset.mode = mode; }
  }
  function progress(n) {
    const wrap = $('#ocr-progress-wrap'), bar = $('#ocr-progress-bar');
    if (wrap && bar) { wrap.style.display = 'block'; bar.style.width = `${Math.max(0, Math.min(100, n))}%`; }
  }
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    return new Promise((resolve, reject) => {
      const old = document.querySelector(`script[src="${SRC}"]`);
      if (old) { old.addEventListener('load', () => resolve(window.Tesseract)); old.addEventListener('error', reject); return; }
      const s = document.createElement('script'); s.src = SRC; s.onload = () => resolve(window.Tesseract); s.onerror = () => reject(new Error('OCR 套件載入失敗')); document.head.appendChild(s);
    });
  }
  function applyText(text) {
    const raw = $('#ocr-raw-text');
    if (raw) raw.value = text;
    const ok = fill(normalize(parse(text)));
    setStatus(ok ? '已填入新增客戶表單，請關閉視窗後確認欄位。' : '無法整理欄位，請補文字後再試。', ok ? 'ok' : 'warn');
  }
  async function recognize(file) {
    if (!file) { setStatus('請先選擇或拖入名片圖片。', 'warn'); return; }
    const img = $('#ocr-preview');
    if (img) { img.src = URL.createObjectURL(file); img.style.display = 'block'; }
    const btn = $('#ocr-run');
    if (btn) btn.disabled = true;
    progress(0); setStatus('正在載入 OCR 模型，第一次會比較久...');
    try {
      const T = await loadTesseract();
      const lang = ($('#ocr-language') && $('#ocr-language').value) || 'chi_tra+eng';
      const result = await T.recognize(file, lang, { logger(m) { if (m.progress) progress(Math.round(m.progress * 100)); if (m.status) setStatus(`辨識中：${m.status}`); } });
      applyText(result && result.data ? result.data.text || '' : '');
    } catch (e) { setStatus(`辨識失敗：${e.message || e}`, 'warn'); }
    finally { if (btn) btn.disabled = false; }
  }

  function styles() {
    if ($('#customer-card-ocr-style')) return;
    const s = document.createElement('style');
    s.id = 'customer-card-ocr-style';
    s.textContent = '.ocr-card-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.ocr-modal-backdrop{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.48);padding:18px}.ocr-modal-backdrop.is-open{display:flex}.ocr-modal{width:min(900px,100%);max-height:min(760px,calc(100vh - 36px));overflow:auto;background:#fff;border:1px solid #dde1e7;border-radius:10px;box-shadow:0 24px 80px rgba(15,23,42,.28)}.ocr-modal-head{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:18px 20px;border-bottom:1px solid #e5e7eb}.ocr-modal-title{margin:0;font-size:20px}.ocr-modal-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.8fr);gap:18px;padding:20px}.ocr-dropzone{display:grid;place-items:center;min-height:190px;border:1px dashed #aeb6c2;border-radius:8px;background:#fafbfc;padding:18px;text-align:center}.ocr-dropzone.is-drag{border-color:#111827;background:#f0f3f7}.ocr-preview{display:none;width:100%;max-height:280px;object-fit:contain;border:1px solid #dde1e7;border-radius:8px;background:#fff;margin-top:12px}.ocr-modal .field{display:grid;gap:8px;margin-bottom:14px}.ocr-modal label{font-size:14px;font-weight:700;color:#30343b}.ocr-modal select,.ocr-modal textarea{width:100%;border:1px solid #c7ccd5;border-radius:8px;background:#fff;color:#16181d;font:inherit;font-size:15px;padding:11px 12px;outline:none}.ocr-modal textarea{min-height:190px;resize:vertical;line-height:1.55}.ocr-modal-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}.ocr-progress-wrap{display:none;height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden;margin-top:12px}.ocr-progress-bar{height:100%;width:0%;background:#111827;transition:width .16s ease}.ocr-status{color:#6b7280;font-size:14px;line-height:1.5}.ocr-status[data-mode=ok]{color:#0f766e;font-weight:700}.ocr-status[data-mode=warn]{color:#b45309;font-weight:700}.ocr-help{margin:0;color:#6b7280;font-size:13px;line-height:1.55}body.ocr-modal-open{overflow:hidden}@media(max-width:760px){.ocr-modal-backdrop{align-items:flex-start;padding:10px}.ocr-modal{max-height:calc(100vh - 20px)}.ocr-modal-head{align-items:flex-start;flex-direction:column}.ocr-modal-body{grid-template-columns:1fr;padding:16px}.ocr-modal .btn{width:100%}}';
    document.head.appendChild(s);
  }
  function openModal() { modal(); $(`#${MODAL}`).classList.add('is-open'); document.body.classList.add('ocr-modal-open'); setStatus('請先選擇或拖入名片圖片。'); }
  function closeModal() { const m = $(`#${MODAL}`); if (m) m.classList.remove('is-open'); document.body.classList.remove('ocr-modal-open'); }
  function modal() {
    if ($(`#${MODAL}`)) return;
    styles();
    const m = document.createElement('div');
    m.id = MODAL; m.className = 'ocr-modal-backdrop';
    m.innerHTML = `<div class="ocr-modal" role="dialog" aria-modal="true" aria-labelledby="ocr-modal-title"><div class="ocr-modal-head"><div><h2 class="ocr-modal-title" id="ocr-modal-title">名片識別</h2><p class="ocr-help">拖入名片圖片或選擇檔案，辨識完成後會直接填入新增客戶表單。</p></div><button class="btn secondary" type="button" data-ocr-close>關閉</button></div><div class="ocr-modal-body"><section><div class="field"><label for="ocr-language">辨識語言</label><select id="ocr-language"><option value="chi_tra+eng">繁中 + 英文</option><option value="eng">英文</option></select></div><div class="ocr-dropzone" id="ocr-dropzone"><div><strong>拖曳名片照片到這裡</strong><p class="ocr-help">支援 JPG、PNG、WEBP。也可以按下方選擇檔案。</p><input id="ocr-file" type="file" accept="image/*"></div></div><img class="ocr-preview" id="ocr-preview" alt="名片預覽"><div class="ocr-progress-wrap" id="ocr-progress-wrap"><div class="ocr-progress-bar" id="ocr-progress-bar"></div></div><div class="ocr-modal-actions"><button class="btn" type="button" id="ocr-run">開始辨識並填入</button><button class="btn secondary" type="button" id="ocr-sample">載入文字範例</button></div></section><section><div class="field"><label for="ocr-raw-text">OCR 原始文字</label><textarea id="ocr-raw-text" placeholder="也可以把其他 OCR 工具辨識出的文字貼在這裡。"></textarea></div><div class="ocr-modal-actions"><button class="btn secondary" type="button" id="ocr-apply-text">整理並填入</button></div><p class="ocr-status" id="ocr-modal-status" aria-live="polite">請先選擇或拖入名片圖片。</p></section></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(); });
    $('[data-ocr-close]', m).addEventListener('click', closeModal);
    const input = $('#ocr-file'), drop = $('#ocr-dropzone');
    input.addEventListener('change', () => { const f = input.files && input.files[0]; if (!f) return; const img = $('#ocr-preview'); img.src = URL.createObjectURL(f); img.style.display = 'block'; setStatus('圖片已選擇，可以開始辨識。', 'ok'); });
    ['dragenter','dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
    ['dragleave','drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
    drop.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) recognize(f); });
    $('#ocr-run').addEventListener('click', () => recognize(input.files && input.files[0]));
    $('#ocr-apply-text').addEventListener('click', () => applyText($('#ocr-raw-text').value));
    $('#ocr-sample').addEventListener('click', () => applyText(['日盛傢俱工程有限公司','負責人 王小明','TEL 02-2345-6789','手機 0912-345-678','台北市信義區松仁路100號8樓','統一編號 12345678','sales@example.com','www.example.com.tw'].join('\n')));
  }

  function ensurePanel() {
    if (!location.hash.startsWith('#/customers/new')) return;
    let panel = $('.customer-card-import');
    if (!panel) {
      const form = $('form[onsubmit^="saveCustomer"]'), firstCard = form && $('section.card', form);
      if (!form || !firstCard) return;
      panel = document.createElement('section'); form.insertBefore(panel, firstCard);
    }
    if (panel.dataset.ocrModalReady !== 'yes') {
      panel.className = 'card customer-card-import'; panel.id = PANEL;
      panel.innerHTML = `<div class="card-header"><h2>名片資料匯入</h2><button class="btn" type="button" data-ocr-open>開啟名片識別</button></div><div class="card-body"><p class="sub" style="margin:0 0 12px">上傳或拖入名片照片，辨識後會直接填入下面的新增客戶欄位。</p><div class="ocr-card-actions"><button class="btn secondary" type="button" data-ocr-open>上傳名片照片</button><span class="sub" id="customer-card-import-status" aria-live="polite">填完後仍需要人工確認再按「建立」。</span></div></div>`;
      panel.querySelectorAll('[data-ocr-open]').forEach((b) => b.addEventListener('click', openModal));
      panel.dataset.ocrModalReady = 'yes';
    }
    modal();
    const imported = normalize(decodeCard());
    if (imported && !panel.dataset.ocrCardApplied) { fill(imported); panel.dataset.ocrCardApplied = 'yes'; const s = $('#customer-card-import-status'); if (s) s.textContent = '已從名片辨識帶入資料，請確認後再儲存。'; }
  }
  window.BusinessCardOCRModal = { parseCardText: parse, normalizeCard: normalize, fillForm: fill, openModal, closeModal };
  addEventListener('hashchange', () => setTimeout(ensurePanel, 0));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  addEventListener('DOMContentLoaded', () => { ensurePanel(); setTimeout(ensurePanel, 100); setTimeout(ensurePanel, 500); });
  const app = $('#app'); if (app && window.MutationObserver) new MutationObserver(() => ensurePanel()).observe(app, { childList: true, subtree: true });
})();