window.renderAuth = function () {
  const isLogin = ui.authMode === "login";
  return `
    <main class="auth-page">
      <section class="auth-card">
        <h1>建材報價單系統</h1>
        <p>${isLogin ? "請登入帳號" : "建立新帳號"}</p>
        <form onsubmit="${isLogin ? "login(event)" : "register(event)"}">
          <div class="field">
            <label>帳號</label>
            <input class="input" name="email" type="text" aria-label="帳號" value="${isLogin ? DEMO_EMAIL : ""}" required>
          </div>
          <div class="field" style="margin-top:14px">
            <label>密碼</label>
            <input class="input" name="password" type="password" aria-label="密碼" value="${isLogin ? DEMO_PASSWORD : ""}" required>
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
