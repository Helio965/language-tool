import {
  $,
  $$,
  context,
  api,
  signedIn,
  busy,
  fieldsError,
  h,
  link,
  render,
  channel,
} from "./common.js";
export async function init() {
  const form = $("#auth-form"),
    message = $("#form-message"),
    submit = $("#auth-submit");
  let pending = false;
  const params = new URLSearchParams(location.search);
  if (params.get("expired")) {
    message.hidden = false;
    message.className = "states-inline states-inline_info";
    message.textContent = "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (params.get("signed_out")) {
    message.hidden = false;
    message.className = "states-inline states-inline_info";
    message.textContent = "Você saiu da sua conta.";
  }
  if (context.page === "reset") {
    form.hidden = true;
    let verifying = false;
    const verify = async () => {
      if (verifying) return;
      verifying = true;
      message.hidden = false;
      message.className = "states-inline states-inline_info";
      message.textContent = "Verificando o link…";
      form.hidden = true;
      try {
        const { status } = await api(
          "/auth/password-reset/verify",
          "POST",
          { token: context.token },
          { public: true },
        );
        if (status !== "valid") {
          render(
            `<h1 data-page-title tabindex="-1">${{ expired: "Este link venceu", used: "Este link já foi usado", invalid: "Link inválido" }[status] || "Link inválido"}</h1><p>Peça um novo link para redefinir sua senha com segurança.</p>${link("Pedir um novo link", "/recuperar-senha")}${link("Voltar para o login", "/entrar", "secondary")}`,
            $("#auth-content"),
          );
          return;
        }
        message.hidden = true;
        form.hidden = false;
        $("[data-page-title]")?.focus({ preventScroll: true });
      } catch (error) {
        message.hidden = false;
        message.className = "states-inline states-inline_error";
        message.innerHTML = `<p role="alert">${h(error.message)}</p><button type="button" class="button-button button-secondary" id="reset-verify-retry">Tentar novamente</button>`;
        $("#reset-verify-retry").addEventListener("click", verify);
        $("#reset-verify-retry").focus();
      } finally {
        verifying = false;
      }
    };
    await verify();
    if (!form.isConnected) return;
  }
  $("#password")?.addEventListener("input", () => {
    const value = $("#password").value;
    const checks = {
      length: value.length >= 8,
      letter: /[A-Za-zÀ-ÿ]/.test(value),
      number: /\d/.test(value),
    };
    $$("#password-checks li").forEach((item) => {
      item.dataset.ok = String(checks[item.dataset.check]);
      item.textContent =
        (checks[item.dataset.check] ? "✓ " : "○ ") + item.textContent.slice(2);
    });
  });
  form.addEventListener("input", (event) => {
    event.target.removeAttribute("aria-invalid");
    const error = document.getElementById(`${event.target.name}-error`);
    if (error) error.hidden = true;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;
    pending = true;
    busy(
      submit,
      true,
      {
        login: "Entrando…",
        register: "Criando sua conta…",
        forgot: "Enviando…",
        reset: "Salvando…",
      }[context.page],
    );
    message.hidden = true;
    const data = Object.fromEntries(new FormData(form));
    if (context.page === "register")
      data.acceptedTerms = form.elements.acceptedTerms.checked;
    try {
      if (context.page === "login" || context.page === "register")
        signedIn(
          await api(`/auth/${context.page}`, "POST", data, { public: true }),
        );
      if (context.page === "forgot") {
        const result = await api(
          "/auth/password-reset",
          "POST",
          { email: data.email },
          { public: true },
        );
        render(
          `<h1 data-page-title tabindex="-1">Recuperar senha</h1><div class="states-inline states-inline_success" role="status">${h(result.message)}</div><p>Confira a caixa de entrada e a pasta de spam. O link vale por ${h(result.expiresInMinutes)} minutos e só pode ser usado uma vez.</p>${result.deliveryConfigured === false ? '<p class="states-inline states-inline_info">O envio de e-mail precisa ser configurado para entregar o link de recuperação.</p>' : ""}<div class="row-actions">${link("Voltar para o login", "/entrar", "secondary")}${link("Usar outro e-mail", "/recuperar-senha", "ghost")}</div>`,
          $("#auth-content"),
        );
      }
      if (context.page === "reset") {
        const result = await api(
          "/auth/password-reset/confirm",
          "POST",
          { token: context.token, ...data },
          { public: true },
        );
        if (result.sessionEnded) channel?.postMessage({ reason: "signed_out" });
        render(
          `<h1 data-page-title tabindex="-1">Senha redefinida com sucesso.</h1><p>Agora é só entrar com a senha nova. Por segurança, as sessões antigas foram encerradas.</p>${link("Entrar", "/entrar")}`,
          $("#auth-content"),
        );
      }
    } catch (error) {
      fieldsError(error, form, message);
      if (error.code === "EMAIL_IN_USE")
        message.insertAdjacentHTML(
          "beforeend",
          ` <a href="/entrar">Entrar com este e-mail</a>`,
        );
      if (context.page === "login" && form.elements.password)
        form.elements.password.value = "";
    } finally {
      pending = false;
      busy(submit, false);
    }
  });
}
