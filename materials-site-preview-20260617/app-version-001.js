document.title = "建材報價單系統-941025的001版";

renderAuth = function () {
  const isLogin = ui.authMode === "login";
  return `
    <main class="auth-page">
      <section class="auth-card">
        <h1>建材報價單系統-941025的001版</h1>
        <p>${isLogin ? "請登入帳號" : "建立新帳號"}</p>
        <form onsubmit="${isLogin ? "numericLogin123(event)" : "numericRegister123(event)"}">
          <div class="field">
            <label>帳號</label>
            <input class="input" name="email" type="text" inputmode="numeric" pattern="[0-9]*" aria-label="帳號" value="${isLogin ? DEMO_EMAIL : ""}" oninput="this.value=this.value.replace(/\\D/g,'')" required>
          </div>
          <div class="field" style="margin-top:14px">
            <label>密碼</label>
            <input class="input" name="password" type="password" inputmode="numeric" pattern="[0-9]*" aria-label="密碼" value="${isLogin ? DEMO_PASSWORD : ""}" oninput="this.value=this.value.replace(/\\D/g,'')" required>
          </div>
          <button class="btn" style="width:100%; margin-top:20px" type="submit">${isLogin ? "登入" : "註冊"}</button>
        </form>
        <button class="btn secondary" style="width:100%; margin-top:12px" onclick="toggleAuthMode()">
          ${isLogin ? "還沒有帳號?註冊" : "已有帳號?登入"}
        </button>
      </section>
    </main>
    ${renderToast()}
  `;
};

const baseRenderShell001 = renderShell;
renderShell = function (content, path) {
  return baseRenderShell001(content, path).replace(/報價單系統<\/span>/g, "報價單系統-941025的001版</span>");
};

function onlyDigits001(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeAuthForm001(event) {
  event.preventDefault();
  const account = event.currentTarget.elements.email;
  const password = event.currentTarget.elements.password;
  account.value = onlyDigits001(account.value);
  password.value = onlyDigits001(password.value);
  if (!account.value || !password.value) {
    setToast("帳號和密碼只能輸入數字");
    return false;
  }
  return true;
}

window.numericLogin123 = function (event) {
  if (normalizeAuthForm001(event)) window.login(event);
};

window.numericRegister123 = function (event) {
  if (normalizeAuthForm001(event)) window.register(event);
};
