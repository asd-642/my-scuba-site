document.title = "建材報價單系統-941025的001版";

const baseRenderAuth001 = renderAuth;
renderAuth = function () {
  return baseRenderAuth001().replace(/建材報價單系統(?!-941025的001版)/g, "建材報價單系統-941025的001版");
};

const baseRenderShell001 = renderShell;
renderShell = function (content, path) {
  return baseRenderShell001(content, path).replace(/報價單系統<\/span>/g, "報價單系統-941025的001版</span>");
};
