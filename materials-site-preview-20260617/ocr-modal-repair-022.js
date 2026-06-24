(function () {
  const VERSION = "022";
  const BASE_LABEL = "\u540d\u7247 OCR \u532f\u5165";
  const VERSION_LABEL = `${BASE_LABEL}-(\u7576\u524d\u7248\u672c ${VERSION})`;
  const TEXT = {
    close: "\u95dc\u9589",
    drop: "\u62d6\u5165\u540d\u7247\u7167\u7247",
    choose: "\u9078\u64c7\u6a94\u6848",
    preview: "\u540d\u7247\u9810\u89bd",
    run: "\u958b\u59cb\u8fa8\u8b58",
    sample: "\u7bc4\u4f8b\u6e2c\u8a66",
    status: "\u9078\u64c7\u5716\u7247\u5f8c\u958b\u59cb\u8fa8\u8b58\u3002",
    raw: "\u8fa8\u8b58\u6587\u5b57",
    placeholder: "\u53ef\u624b\u52d5\u4fee\u6b63\u6587\u5b57\u5f8c\u518d\u6574\u7406\u586b\u5165",
    apply: "\u6574\u7406\u4e26\u586b\u5165\u8868\u55ae"
  };

  function closeModal() {
    const modal = document.getElementById("customer-card-ocr-modal");
    if (modal) modal.classList.remove("is-open");
    document.body.classList.remove("ocr-modal-open");
  }

  function repairModal() {
    const modal = document.getElementById("customer-card-ocr-modal");
    if (!modal) return;
    if (modal.dataset.ocrModalRepair === VERSION && modal.querySelector("#ocr-raw-text")) return;

    const wasOpen = modal.classList.contains("is-open");
    modal.className = "ocr-modal-backdrop";
    if (wasOpen) modal.classList.add("is-open");
    modal.dataset.ocrModalRepair = VERSION;
    modal.innerHTML = `
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

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-ocr-close]")) closeModal();
    });

    const input = document.getElementById("ocr-file");
    if (input) {
      input.addEventListener("change", () => {
        if (typeof window.recognizeSelectedCustomerCard === "function") {
          window.recognizeSelectedCustomerCard();
        }
      });
    }
  }

  function updateButtons() {
    document.querySelectorAll("[data-ocr-open], button").forEach((button) => {
      const text = (button.textContent || "").trim();
      if (text === BASE_LABEL || text.startsWith(`${BASE_LABEL}-(`)) {
        button.textContent = VERSION_LABEL;
      }
    });
  }

  function tick() {
    document.documentElement.dataset.ocrModalRepair = VERSION;
    updateButtons();
    repairModal();
  }

  document.addEventListener("click", () => setTimeout(tick, 0), true);
  if (window.MutationObserver) {
    new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
  }

  tick();
  setTimeout(tick, 300);
  setTimeout(tick, 1200);
  setTimeout(tick, 3000);
})();
