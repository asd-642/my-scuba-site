function renderQuoteDetail(quoteId) {
  const liveQuote = quoteById(quoteId);
  if (!liveQuote) return `<div class="empty">找不到報價單</div>`;
  const documentContext = quoteDocumentContext(liveQuote);
  const quote = {
    ...documentContext.quote,
    status: liveQuote.status,
    revision_no: liveQuote.revision_no,
    owner_id: liveQuote.owner_id,
    next_follow_up: liveQuote.next_follow_up,
    lost_reason: liveQuote.lost_reason,
  };
  const customer = documentContext.customer;
  const tpl = documentContext.template;
  const company = documentContext.company;
  const totals = documentContext.totals;
  const primary = customer?.contacts?.find((c) => c.primary) || customer?.contacts?.[0];
  const owner = accountById(liveQuote.owner_id);
  const locked = quoteIsLocked(liveQuote);
  const pendingApproval = liveQuote.status === "pending_approval";
  const editAction = liveQuote.is_superseded
    ? `<span class="badge">已有後續修訂版</span>`
    : locked
      ? `<button class="btn" type="button" onclick="createQuoteRevision('${h(liveQuote.id)}')">建立修訂版</button>`
    : pendingApproval
      ? ""
      : `<a class="btn" href="${link(`/quotes/${liveQuote.id}/edit`)}">編輯</a>`;
  const internalDetailAction = canEditMaterialPrices() ? `<a class="btn outline" href="${link(`/quotes/${liveQuote.id}/print?type=detail`)}">內部成本明細</a>` : "";
  const headerActions = `<div class="toolbar"><a class="btn outline" href="${link(`/quotes/${liveQuote.id}/print?type=traditional`)}">傳統報價單</a>${internalDetailAction}${editAction}</div>`;
  const statusActions = liveQuote.status === "draft"
    ? `<button class="btn outline sm" onclick="setQuoteStatus('${liveQuote.id}','pending_approval')">送主管核准</button>`
    : liveQuote.status === "pending_approval" && canApproveQuotes()
      ? `<button class="btn sm" onclick="setQuoteStatus('${liveQuote.id}','sent')">核准並標為已寄出</button><button class="btn outline sm" onclick="setQuoteStatus('${liveQuote.id}','draft')">退回草稿</button>`
      : liveQuote.status === "sent"
        ? `<button class="btn outline sm" onclick="setQuoteStatus('${liveQuote.id}','won')">標為成交</button><button class="btn outline sm" onclick="setQuoteStatus('${liveQuote.id}','lost')">標為未成交</button>`
        : "";
  return `
    ${pageHead(`${quote.quote_no} · ${quoteRevisionLabel(liveQuote)}`, documentContext.frozen ? "已封存的報價文件" : "報價單明細", headerActions)}
    ${documentContext.frozen ? `<div class="hint green quote-snapshot-notice">此畫面使用寄出當時的客戶、公司、條款與價格快照，後續設定不會改變本文件。</div>` : ""}
    ${statusActions ? `<div class="toolbar"><span class="muted">快速更新狀態:</span>${statusActions}</div>` : ""}
    <div class="grid cards-3" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:16px">
      <section class="card"><div class="card-header"><h2>客戶與案場</h2></div><div class="card-body">${h(customer?.name || "")}<br>${h(customer?.company_name || "")}<br><span class="muted">統編 ${h(customer?.tax_id || "")}</span><br>${h(customer?.phone || "")}<br>${h(customer?.address || "")}<br><br><span class="muted">主要聯絡人</span><br>${primary ? `${h(primary.name)} (${h(primary.role)})<br>${h(primary.phone)}` : "—"}<br><br><span class="muted">案場</span><br>${h(quote.project_name || "—")}<br>${h(quote.project_address || customer?.address || "")}${quote.project_contact ? `<br>${h(quote.project_contact)}` : ""}</div></section>
      <section class="card"><div class="card-header"><h2>報價資訊</h2></div><div class="card-body">${calcLine("狀態", QUOTE_STATUS_LABEL[quote.status])}${calcLine("版次", quoteRevisionLabel(liveQuote))}${calcLine("報價日期", quote.quote_date)}${calcLine("有效期限", quote.valid_until || "—")}${calcLine("負責人", owner?.name || "—")}${calcLine("下次追蹤", liveQuote.next_follow_up || "—")}${calcLine("使用版本", tpl?.name || "—")}${liveQuote.lost_reason ? calcLine("未成交原因", liveQuote.lost_reason) : ""}</div></section>
      <section class="card"><div class="card-header"><h2>金額</h2></div><div class="card-body">${calcLine("工程小計", money(totals.subtotal))}${totals.discount ? calcLine("折讓", `− ${money(totals.discount)}`) : ""}${calcLine(`稅額 (${quote.tax_rate}%)`, `+ ${money(totals.tax)}`)}${calcLine("合計", money(totals.total))}</div></section>
    </div>
    <section class="card"><div class="card-header"><h2>工程項目 (${quote.sections.length} 項)</h2></div><div class="card-body"><div class="table-wrap"><table><thead><tr><th>#</th><th>工程項目 / 規格</th><th>數量</th><th>單位</th><th>單價</th><th>合計</th></tr></thead><tbody>${quote.sections.map((section, index) => `<tr><td>${index + 1}</td><td><strong>${h(section.name)}</strong><div class="sub">${h(section.spec)}</div></td><td>${h(section.area_qty)}</td><td>${h(section.unit)}</td><td>${money(totals.sections[index].unitCost)}</td><td>${money(totals.sections[index].sectionTotal)}</td></tr>`).join("")}<tr><td colspan="5"><strong>工程小計</strong></td><td class="amount">${money(totals.subtotal)}</td></tr></tbody></table></div></div></section>
    <section class="card" style="margin-top:16px"><div class="card-header"><h2>報價單明細</h2></div><div class="card-body list-card">${quote.sections.map((section, index) => `<div class="row-card"><span><strong>${index + 1}. ${h(section.name)}</strong><br><span class="muted">單價 ${money(totals.sections[index].unitCost)} × ${h(section.area_qty)} ${h(section.unit)} = ${money(totals.sections[index].sectionTotal)}</span></span></div>`).join("")}</div></section>
    <section class="card" style="margin-top:16px"><div class="card-header"><h2>注意事項</h2></div><div class="card-body"><div style="white-space:pre-line;line-height:1.7">${h(quote.extra_notes || tpl?.notes || company.defaultTerms)}</div></div></section>
    <section class="card" style="margin-top:16px"><div class="card-header"><h2>付款條件</h2></div><div class="card-body">${(tpl?.payments || []).map((p) => p.pct ? `<div class="row-card"><span>${h(p.pct)}% ${h(p.text)}</span><span class="amount">${money(totals.total * n(p.pct) / 100)} 元整</span></div>` : `<p>${h(p.text)}</p>`).join("")}</div></section>
  `;
}

function renderPrintPage(quoteId, type) {
  const quote = quoteById(quoteId);
  if (!quote) return `<main class="print-page"><div class="empty">找不到報價單</div></main>`;
  if (type === "detail" && !canEditMaterialPrices()) return `<main class="print-page"><div class="empty">目前帳號沒有查看內部成本明細的權限</div></main>`;
  return type === "detail" ? renderPrintDetail(quote) : renderPrintTraditional(quote);
}

function renderPrintTraditional(liveQuote) {
  const documentContext = quoteDocumentContext(liveQuote);
  const quote = documentContext.quote;
  const customer = documentContext.customer;
  const tpl = documentContext.template;
  const totals = documentContext.totals;
  const company = documentContext.company;
  return `<main class="print-page">
    <div class="print-actions"><button class="btn" onclick="window.print()">列印 / 存成 PDF</button></div>
    <section class="print-sheet">
      ${["sent", "won"].includes(liveQuote.status) ? "" : `<div class="print-watermark">${h(QUOTE_STATUS_LABEL[liveQuote.status] || "草稿")}</div>`}
      <div class="print-banner"><div class="print-logo">來</div><div><h2 style="margin:0">${h(company.name)}</h2><div>電話: ${h(company.phone)}　傳真: ${h(company.fax)}</div><div>地址: ${h(company.address)}</div></div></div>
      <h1 class="print-title">報 價 單</h1>
      <div class="print-doc-meta"><span>報價單號: ${h(quote.quote_no)}</span><span>版次: ${h(quoteRevisionLabel(liveQuote))}</span><span>報價日期: ${h(quote.quote_date)}</span><span>有效期限: ${h(quote.valid_until || "—")}</span></div>
      <div class="print-meta"><div>客戶名稱: ${h(customer?.company_name || customer?.name || "")}</div><div>公司電話: ${h(customer?.phone || "")}</div><div>工程名稱: ${h(quote.project_name || "")}</div><div>案場地址: ${h(quote.project_address || customer?.address || "")}</div>${quote.project_contact ? `<div>案場聯絡人: ${h(quote.project_contact)}</div>` : ""}</div>
      <table><thead><tr><th>項次</th><th>品名</th><th>規格</th><th>數量</th><th>單位</th><th>單價</th><th>合計</th><th>備註</th></tr></thead><tbody>${quote.sections.map((section, index) => `<tr><td>${index + 1}</td><td>${h(section.name)}</td><td>${h(section.spec)}</td><td>${h(section.area_qty)}</td><td>${h(section.unit)}</td><td>${money(totals.sections[index].unitCost)}</td><td>${money(totals.sections[index].sectionTotal)}</td><td></td></tr>`).join("")}${Array.from({ length: 4 }, () => `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("")}</tbody></table>
      <div class="print-terms">${h(quote.extra_notes || tpl?.notes || company.defaultTerms)}</div>
      <h3>付款條件</h3>
      ${(tpl?.payments || []).map((p) => p.pct ? `<div class="calc-line"><span>${h(p.pct)}% ${h(p.text)}</span><strong>${money(totals.total * n(p.pct) / 100)} 元整</strong></div>` : `<p>${h(p.text)}</p>`).join("")}
      <table style="margin-top:16px;min-width:0"><tbody><tr><td>小計</td><td>${money(totals.subtotal)}</td></tr>${totals.discount ? `<tr><td>折讓</td><td>− ${money(totals.discount)}</td></tr>` : ""}<tr><td>稅金</td><td>${money(totals.tax)}</td></tr><tr><td><strong>總計</strong></td><td><strong>${money(totals.total)}</strong></td></tr></tbody></table>
      <div class="print-sign"><div>廠商簽章:<div class="stamp">來來建材</div></div><div>客戶簽章:<br><br>公司章或發票章蓋章處 / 公司負責人親簽</div><div>主管簽核:<br><br>${h(company.managerName)}</div><div>製表人:<br><br>${h(company.preparerName)}</div></div>
    </section>
  </main>`;
}

function renderPrintDetail(liveQuote) {
  const documentContext = quoteDocumentContext(liveQuote);
  const quote = documentContext.quote;
  const customer = documentContext.customer;
  const totals = documentContext.totals;
  const company = documentContext.company;
  return `<main class="print-page">
    <div class="print-actions"><button class="btn" onclick="window.print()">列印 / 存成 PDF</button></div>
    <section class="print-sheet">
      <h1>報價單明細 — ${h(quote.quote_no)}</h1>
      <p class="muted">(內部成本明細)　${h(company.name)}　客戶: ${h(customer?.company_name || "")}　日期: ${h(quote.quote_date)}　版次: ${h(quoteRevisionLabel(liveQuote))}</p>
      ${quote.sections.map((section, index) => {
        const sectionComputed = totals.sections[index];
        return `<h2>${index + 1}. ${h(section.name)}</h2><p>單價 ${money(sectionComputed.unitCost)} × ${h(section.area_qty)} ${h(section.unit)} = ${money(sectionComputed.sectionTotal)}</p>
        <h3>材料明細 (每${h(section.unit)})</h3>
        <table><thead><tr><th>#</th><th>品名 / 規格</th><th>計價 / 公式</th><th>計價量</th><th>報價單價</th><th>成本</th><th>材料小計</th></tr></thead><tbody>${section.items.map((item, itemIndex) => {
          const computed = sectionComputed.itemsComputed[itemIndex];
          return `<tr><td>${itemIndex + 1}</td><td><strong>${h(item.name)}</strong><div class="sub">${[item.thickness, item.width, item.length].filter(Boolean).join(" × ")} cm</div></td><td>${h(pricingLabel(item.pricing_type, true))}<div class="sub">${h(item.formula_version || "legacy-v1")} / ${h(item.unit)}</div></td><td>${computed.baseQty.toFixed(3)} ${h(item.unit)}${computed.wasteQty ? ` +${h(item.waste_pct)}% = ${computed.priceableQty.toFixed(3)}` : ""}</td><td>${money(item.unit_price)}</td><td>${computed.hasCostPrice ? money(computed.materialCostSubtotal) : "未建立"}</td><td>${money(computed.materialSubtotal)}</td></tr>`;
        }).join("")}<tr><td colspan="6"><strong>材料小計 (每${h(section.unit)})</strong></td><td>${money(sectionComputed.materialSubtotal)}</td></tr></tbody></table>
        <h3>工錢明細 (每${h(section.unit)})</h3>
        <table><thead><tr><th>項目</th><th>單位</th><th>數量</th><th>單價</th><th>小計</th></tr></thead><tbody>${sectionComputed.laborDist.items.map((item) => `<tr><td>${h(item.name)}</td><td>${h(item.unit)}</td><td>1</td><td>—</td><td>${money(item.amount)}</td></tr>`).join("")}<tr><td colspan="4"><strong>工錢小計 (每${h(section.unit)})</strong></td><td>${money(sectionComputed.laborSubtotal)}</td></tr></tbody></table>`;
      }).join("")}
    </section>
  </main>`;
}

function renderSettings() {
  if (!canEditCompanySettings()) return renderAccessDenied();
  const c = state.company;
  return `
    ${pageHead("公司設定", "報價單抬頭、頁尾條款與 Logo / 印章 / QR Code 圖檔")}
    <form class="grid" onsubmit="saveSettings(event)">
      <section class="card"><div class="card-header"><h2>公司資訊</h2></div><div class="card-body form-grid">
        ${field("公司名稱", "name", c.name, false, "例:來來建材有限公司")}
        ${field("英文名 / 商標字樣", "englishName", c.englishName, false, "例:COME BUY")}
        ${field("統一編號", "taxId", c.taxId)}
        ${numberField("預設稅率 %", "defaultTaxRate", c.defaultTaxRate, false, "新報價單會自動帶入;5 = 加 5% 營業稅,0 = 免稅")}
        ${field("Email", "email", c.email)}
        ${field("電話", "phone", c.phone, false, "例:(03)275-0188")}
        ${field("傳真", "fax", c.fax, false, "例:(03)491-1768")}
        ${field("地址", "address", c.address, false, "例:桃園市中壢區中央西路二段30號13樓")}
      </div></section>
      <section class="card"><div class="card-header"><h2>報價單頁尾 / 條款</h2></div><div class="card-body form-grid">
        ${field("主管簽核", "managerName", c.managerName)}
        ${field("製表人 (預設)", "preparerName", c.preparerName)}
        ${field("表單編碼", "formCode", c.formCode, false, "例:A20210401-B02")}
        <div class="field span-2"><label>匯款 / 銀行資訊</label><textarea class="textarea" name="bankInfo" placeholder="例:第一銀行 內壢分行 帳號:280-10-830821 戶名:來來建材有限公司">${h(c.bankInfo)}</textarea><small>會印在報價單備註區</small></div>
        <div class="field span-2"><label>標準合約條款 (備註)</label><textarea class="textarea" name="defaultTerms">${h(c.defaultTerms)}</textarea><small>傳統報價單底部的標準條款,每行一條</small></div>
      </div></section>
      <section class="card"><div class="card-header"><h2>圖檔</h2></div><div class="card-body grid cards-3" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        ${imageBox("公司 Logo", "顯示在報價單左上抬頭")}
        ${imageBox("公司印章", "顯示在廠商簽章欄")}
        ${imageBox("QR Code", "顯示在報價單右上")}
      </div><div class="card-footer"><a class="btn outline" href="${link("/dashboard")}">返回</a><button class="btn" type="submit">儲存</button></div></section>
      <section class="card"><div class="card-header"><h2>資料備份與還原</h2></div><div class="card-body">
        <div class="hint amber">目前仍使用本機資料儲存。請定期下載完整備份；接上中央資料庫後，這裡會改為伺服器備份狀態。</div>
        <div class="backup-actions">
          <button class="btn" type="button" onclick="exportDataBackup()">下載完整備份</button>
          <label class="btn outline" for="data-backup-file">選擇備份檔還原</label>
          <input id="data-backup-file" class="sr-only" type="file" accept="application/json,.json" onchange="importDataBackup(event)">
        </div>
        <p class="sub">備份包含客戶、名片、材料、公式版本、報價、帳號雜湊、公司設定與工作日誌，不包含登入中的瀏覽器狀態。</p>
      </div></section>
    </form>
  `;
}

function renderPersonalSettings() {
  const account = currentUser();
  if (!account) return renderAccessDenied();
  return `
    ${pageHead("個人設定", "個人名稱與頭像")}
    <form class="grid" onsubmit="savePersonalSettings(event)">
      <section class="card">
        <div class="card-header"><h2>個人資料</h2></div>
        <div class="card-body personal-settings">
          <div class="personal-avatar-preview personal-avatar-toolbar">
            <div class="personal-avatar-main">
              ${renderAvatar(account, "personal-avatar")}
              <div>
                <strong>${h(account.name)}</strong>
                <p class="muted">這會顯示在左下角頭像區。</p>
              </div>
            </div>
            <div>
              <button class="btn outline sm" type="button" onclick="openPersonalModal('avatar')">頭像圖片</button>
              <button class="btn outline sm" type="button" onclick="openPersonalModal('password')">更改密碼</button>
            </div>
          </div>
          <div class="form-grid">
            ${field("顯示名稱", "name", account.name, true)}
          </div>
        </div>
        <div class="card-footer">
          <a class="btn outline" href="${link("/dashboard")}">返回</a>
          <button class="btn" type="submit">儲存</button>
        </div>
      </section>
    </form>
    ${renderPersonalModal(account)}
  `;
}

function renderPersonalModal(account) {
  if (ui.personalModal === "avatar") return renderAvatarUploadModal(account);
  if (ui.personalModal === "password") return renderPasswordModal();
  return "";
}

function renderAvatarUploadModal(account) {
  return `
    <div class="permission-backdrop" onclick="closePersonalModal()" role="presentation">
      <form class="permission-modal personal-modal" onsubmit="saveAvatarImage(event)" onclick="event.stopPropagation()">
        <div class="permission-head">
          <div>
            <h2>頭像圖片</h2>
            <p>拖入或選擇圖片，儲存後會套用到左下角頭像。</p>
          </div>
          <button class="icon-btn" type="button" onclick="closePersonalModal()" aria-label="關閉">×</button>
        </div>
        <div class="card-body">
          <label class="avatar-dropzone" ondragover="handleAvatarDragOver(event)" ondragleave="handleAvatarDragLeave(event)" ondrop="handleAvatarDrop(event)">
            ${renderAvatar(account, "personal-avatar")}
            <strong>拖移圖片到這裡</strong>
            <span class="muted" data-avatar-file-name>或點擊選擇檔案</span>
            <input name="avatarFile" type="file" accept="image/*" onchange="handleAvatarFilePick(event)">
            <input type="hidden" name="avatarImage" value="${h(account.avatarImage)}">
          </label>
        </div>
        <div class="card-footer">
          <button class="btn outline" type="button" onclick="closePersonalModal()">取消</button>
          <button class="btn" type="submit">儲存頭像</button>
        </div>
      </form>
    </div>
  `;
}

function renderPasswordModal() {
  return `
    <div class="permission-backdrop" onclick="closePersonalModal()" role="presentation">
      <form class="permission-modal personal-modal" onsubmit="changePersonalPassword(event)" onclick="event.stopPropagation()">
        <div class="permission-head">
          <div>
            <h2>更改密碼</h2>
            <p>請先輸入舊密碼，再輸入新的密碼。</p>
          </div>
          <button class="icon-btn" type="button" onclick="closePersonalModal()" aria-label="關閉">×</button>
        </div>
        <div class="card-body">
          <div class="field">
            <label>舊密碼</label>
            <input class="input" name="oldPassword" type="password" inputmode="numeric" pattern="[0-9]{3,20}" maxlength="20" autocomplete="current-password" required>
          </div>
          <div class="field" style="margin-top:14px">
            <label>新密碼</label>
            <input class="input" name="newPassword" type="password" inputmode="numeric" pattern="[0-9]{3,20}" maxlength="20" autocomplete="new-password" required>
          </div>
          <div class="field" style="margin-top:14px">
            <label>確認新密碼</label>
            <input class="input" name="confirmPassword" type="password" inputmode="numeric" pattern="[0-9]{3,20}" maxlength="20" autocomplete="new-password" required>
          </div>
        </div>
        <div class="card-footer">
          <button class="btn outline" type="button" onclick="closePersonalModal()">取消</button>
          <button class="btn" type="submit">儲存密碼</button>
        </div>
      </form>
    </div>
  `;
}

function imageBox(title, desc) {
  return `<div class="card"><div class="card-body" style="text-align:center"><div class="${title.includes("印章") ? "stamp" : "print-logo"}" style="margin:0 auto 12px">${title.includes("Logo") ? "來" : title.includes("印章") ? "來來" : "無"}</div><button type="button" class="btn outline sm">${h(title)}</button><p class="sub">${h(desc)}</p></div></div>`;
}

function renderToast() {
  return ui.toast ? `<div class="toast">${h(ui.toast)}</div>` : "";
}
