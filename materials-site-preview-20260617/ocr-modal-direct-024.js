(function () {
  const VERSION = "024";
  const MODAL_ID = "customer-card-ocr-modal";
  const STYLE_ID = "customer-card-ocr-direct-style-024";
  const BASE_LABEL = "\u540d\u7247 OCR \u532f\u5165";
  const VERSION_LABEL = `${BASE_LABEL}-(\u7576\u524d\u7248\u672c ${VERSION})`;
  const TEXT = {
    close: "\u95dc\u9589",
    drop: "\u62d6\u5165\u540d\u7247\u7167\u7247",
    preview: "\u540d\u7247\u9810\u89bd",
    run: "\u958b\u59cb\u8fa8\u8b58",
    sample: "\u7bc4\u4f8b\u6e2c\u8a66",
    status: "\u9078\u64c7\u5716\u7247\u5f8c\u958b\u59cb\u8fa8\u8b58\u3002",
    raw: "\u8fa8\u8b58\u6587\u5b57",
    placeholder: "\u53ef\u624b\u52d5\u4fee\u6b63\u6587\u5b57\u5f8c\u518d\u6574\u7406\u586b\u5165",
    apply: "\u6574\u7406\u4e26\u586b\u5165\u8868\u55ae"
  };

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID}.ocr-modal-backdrop{position:fixed!important;inset:0!important;z-index:99999!important;display:none!important;align-items:center!important;justify-content:center!important;background:rgba(2,6,23,.62)!important;padding:18px!important}
      #${MODAL_ID}.ocr-modal-backdrop.is-open{display:flex!important}
      #${MODAL_ID} .ocr-modal{box-sizing:border-box!important;width:min(900px,calc(100vw - 36px))!important;max-height:calc(100vh - 36px)!important;overflow:auto!important;background:#fff!important;color:#111827!important;border:1px solid #d7dde7!important;border-radius:10px!important;box-shadow:0 24px 80px rgba(0,0,0,.35)!important}
      #${MODAL_ID} .ocr-modal-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding:18px 20px!important;border-bottom:1px solid #e5e7eb!important}
      #${MODAL_ID} .ocr-modal-title{margin:0!important;font-size:20px!important;line-height:1.25!important;color:#111827!important}
      #${MODAL_ID} .ocr-modal-body{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(280px,.85fr)!important;gap:18px!important;padding:20px!important}
      #${MODAL_ID} .ocr-dropzone{display:grid!important;place-items:center!important;min-height:190px!important;border:1px dashed #94a3b8!important;border-radius:8px!important;background:#f8fafc!important;text-align:center!important;padding:18px!important;color:#111827!important}
      #${MODAL_ID} .ocr-dropzone.is-drag{border-color:#111827!important;background:#eef2ff!important}
      #${MODAL_ID} .ocr-preview{display:none;width:100%!important;max-height:260px!important;object-fit:contain!important;border:1px solid #e5e7eb!important;border-radius:8px!important;margin-top:12px!important;background:#fff!important}
      #${MODAL_ID} .ocr-progress-wrap{display:none;height:10px!important;border-radius:999px!important;background:#e5e7eb!important;overflow:hidden!important;margin-top:12px!important}
      #${MODAL_ID} .ocr-progress-bar{height:100%!important;width:0%;background:#111827!important}
      #${MODAL_ID} .ocr-modal-actions{display:flex!important;flex-wrap:wrap!important;gap:10px!important;margin-top:12px!important}
      #${MODAL_ID} .ocr-status{font-size:13px!important;color:#047857!important;margin:12px 0 0!important}
      #${MODAL_ID} .field{display:grid!important;gap:8px!important;margin-bottom:14px!important}
      #${MODAL_ID} label{font-size:14px!important;font-weight:700!important;color:#30343b!important}
      #${MODAL_ID} textarea{box-sizing:border-box!important;width:100%!important;min-height:220px!important;resize:vertical!important;border:1px solid #c7ccd5!important;border-radius:8px!important;background:#fff!important;color:#16181d!important;font:inherit!important;font-size:15px!important;line-height:1.55!important;padding:11px 12px!important}
      body.ocr-modal-open{overflow:hidden!important}
      @media(max-width:760px){#${MODAL_ID}.ocr-modal-backdrop{align-items:flex-start!important;padding:10px!important}#${MODAL_ID} .ocr-modal{max-height:calc(100vh - 20px)!important;width:100%!important}#${MODAL_ID} .ocr-modal-head{align-items:flex-start!important;flex-direction:column!important}#${MODAL_ID} .ocr-modal-body{grid-template-columns:1fr!important;padding:16px!important}#${MODAL_ID} .ocr-modal .btn{width:100%!important}}
    `;
    document.head.appendChild(style);
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.remove("is-open");
    document.body.classList.remove("ocr-modal-open");
  }

  function recognizeCurrentFile() {
    if (typeof window.recognizeSelectedCustomerCard === "function") {
      window.recognizeSelectedCustomerCard();
    }
  }

  function modalHtml() {
    return `
      <div class="ocr-modal" role="dialog" aria-modal="true" aria-label="${VERSION_LABEL}">
        <div class="ocr-modal-head">
          <h2 class="ocr-modal-title">${VERSION_LABEL}</h2>
          <button class="btn outline sm" type="button" data-ocr-close>${TEXT.close}</button>
        </div>
        <div class="ocr-modal-body">
          <div>
            <div class="ocr-dropzone" id="ocr-dropzone">
              <div>
                <strong>${TEXT.drop}</strong>
                <div style="margin-top:10px"><input id="ocr-file" type="file" accept="image/*"></div>
              </div>
            </div>
            <img id="ocr-preview" class="ocr-preview" alt="${TEXT.preview}">
            <div id="ocr-progress-wrap" class="ocr-progress-wrap"><div id="ocr-progress-bar" class="ocr-progress-bar"></div></div>
            <div class="ocr-modal-actions">
              <button class="btn" id="ocr-run" type="button" onclick="recognizeSelectedCustomerCard()">${TEXT.run}</button>
              <button class="btn outline" type="button" onclick="loadCustomerCardSample()">${TEXT.sample}</button>
            </div>
            <p id="ocr-modal-status" class="ocr-status" aria-live="polite">${TEXT.status}</p>
          </div>
          <div>
            <div class="field">
              <label for="ocr-raw-text">${TEXT.raw}</label>
              <textarea id="ocr-raw-text" placeholder="${TEXT.placeholder}"></textarea>
            </div>
            <button class="btn secondary" type="button" onclick="applyCustomerCardText()">${TEXT.apply}</button>
          </div>
        </div>
      </div>
    `;
  }

  function bindModal(modal) {
    modal.onclick = (event) => {
      if (event.target === modal || event.target.closest("[data-ocr-close]")) closeModal();
    };

    const input = document.getElementById("ocr-file");
    const dropzone = document.getElementById("ocr-dropzone");
    if (input) input.onchange = recognizeCurrentFile;
    if (dropzone && input) {
      ["dragenter", "dragover"].forEach((type) => {
        dropzone.addEventListener(type, (event) => {
          event.preventDefault();
          dropzone.classList.add("is-drag");
        });
      });
      ["dragleave", "drop"].forEach((type) => {
        dropzone.addEventListener(type, (event) => {
          event.preventDefault();
          dropzone.classList.remove("is-drag");
        });
      });
      dropzone.addEventListener("drop", (event) => {
        const files = event.dataTransfer && event.dataTransfer.files;
        if (files && files[0]) {
          input.files = files;
          recognizeCurrentFile();
        }
      });
    }
  }

  function openDirectModal() {
    ensureStyles();
    let modal = document.getElementById(MODAL_ID);
    if (!modal) {
      modal = document.createElement("div");
      modal.id = MODAL_ID;
      document.body.appendChild(modal);
    }
    modal.className = "ocr-modal-backdrop is-open";
    modal.dataset.ocrModalRepair = VERSION;
    modal.innerHTML = modalHtml();
    bindModal(modal);
    document.body.classList.add("ocr-modal-open");
  }

  function isOcrTrigger(target) {
    const trigger = target && target.closest && target.closest("[data-ocr-open], button, a");
    if (!trigger) return false;
    const text = (trigger.textContent || "").trim();
    const aria = (trigger.getAttribute("aria-label") || "").trim();
    return trigger.hasAttribute("data-ocr-open") || text.startsWith(BASE_LABEL) || aria.startsWith(BASE_LABEL);
  }

  function updateButtons() {
    document.documentElement.dataset.ocrModalRepair = VERSION;
    document.documentElement.dataset.ocrDirectModal = VERSION;
    document.querySelectorAll("[data-ocr-open], button").forEach((button) => {
      const text = (button.textContent || "").trim();
      if (text !== VERSION_LABEL && (text === BASE_LABEL || text.startsWith(`${BASE_LABEL}-(`))) {
        button.textContent = VERSION_LABEL;
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (!isOcrTrigger(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDirectModal();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  updateButtons();
  setTimeout(updateButtons, 300);
  setTimeout(updateButtons, 1200);
  setTimeout(updateButtons, 3000);
  setInterval(updateButtons, 1000);
})();
