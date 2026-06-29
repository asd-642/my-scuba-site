document.title = "建材報價單系統-941025的001版";

renderAuth = function () {
  return `
    <main class="auth-page">
      <section class="auth-card">
        <h1>建材報價單系統-941025的001版</h1>
        <p>請登入帳號</p>
        <form onsubmit="login(event)">
          <div class="field">
            <label>帳號</label>
            <input class="input" name="email" type="text" aria-label="帳號" value="${DEMO_EMAIL}" required>
          </div>
          <div class="field" style="margin-top:14px">
            <label>密碼</label>
            <input class="input" name="password" type="password" aria-label="密碼" value="${DEMO_PASSWORD}" required>
          </div>
          <button class="btn" style="width:100%; margin-top:20px" type="submit">登入</button>
        </form>
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
