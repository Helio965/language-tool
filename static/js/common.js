/* Browser presentation only; authentication, grading and persistence stay in Python. */
export const context = JSON.parse(
  document.getElementById("page-context").textContent,
);
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];
export const h = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
export const levels = {
  beginner: "Iniciante",
  basic: "Básico",
  intermediate: "Intermediário",
  advanced: "Avançado",
};
const userId = context.account?.user.id;
let csrf = $("meta[name=csrf-token]").content;
let ending = false;
export const channel =
  typeof BroadcastChannel === "function"
    ? new BroadcastChannel("english-ai:session")
    : null;

export class APIError extends Error {
  constructor(message, code = "INTERNAL", fields = {}) {
    super(message);
    this.code = code;
    this.fields = fields;
  }
}

export async function api(path, method = "GET", data, options = {}) {
  if (ending && !options.public)
    throw new APIError("Sua sessão terminou.", "UNAUTHENTICATED");
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(method !== "GET" ? { "X-CSRFToken": csrf } : {}),
        ...(userId && !options.public ? { "X-Session-User": userId } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
  } catch {
    throw new APIError(
      "Sem conexão com o servidor. Verifique sua internet e tente de novo.",
      "NETWORK",
    );
  }
  if (response.status === 204) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new APIError(
      result?.error?.message || "Não foi possível concluir. Tente novamente.",
      result?.error?.code,
      result?.error?.fields,
    );
    if (response.status === 401 && userId && !options.public) {
      ending = true;
      $("#conteudo").replaceChildren();
      location.replace(
        `/entrar?expired=1&next=${encodeURIComponent(location.pathname + location.search)}`,
      );
    }
    throw error;
  }
  return result;
}

export function nextPath(account) {
  return {
    onboarding: "/configuracao",
    placement: "/nivelamento",
    ready: "/inicio",
  }[account.nextStep];
}
export function safeReturn(value) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\x00-\x20]/.test(value)
  )
    return null;
  if (
    /^\/(entrar|cadastro|recuperar-senha|redefinir-senha)(\/|\?|$)/.test(value)
  )
    return null;
  try {
    return new URL(value, location.origin).origin === location.origin
      ? value
      : null;
  } catch {
    return null;
  }
}
export function signedIn(account) {
  channel?.postMessage({ reason: "login" });
  const next = safeReturn(new URLSearchParams(location.search).get("next"));
  location.replace(
    account.nextStep === "ready" && next ? next : nextPath(account),
  );
}
export async function logout() {
  await api("/auth/logout", "POST");
  ending = true;
  channel?.postMessage({ reason: "signed_out" });
  location.replace("/entrar?signed_out=1");
}
export function toast(message) {
  $("#toast").innerHTML =
    `<div class="overlay-toast overlay-toast_success">${h(message)}</div>`;
  setTimeout(() => $("#toast").replaceChildren(), 4000);
}
export function errorView(error) {
  return `<div class="states-inline states-inline_error" role="alert">${h(error.message)}</div>`;
}
export function showError(error, target) {
  const node = typeof target === "string" ? $(target) : target;
  if (!node || error.code === "UNAUTHENTICATED") return;
  node.hidden = false;
  node.innerHTML = errorView(error);
}
export function clearError(target) {
  const node = typeof target === "string" ? $(target) : target;
  if (node) {
    node.hidden = true;
    node.replaceChildren();
  }
}
export function busy(button, pending, label = "Aguarde…") {
  if (!button) return;
  if (pending) {
    button.dataset.label = button.textContent;
    button.textContent = label;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
export async function action(button, work, target, label) {
  if (button?.disabled) return;
  busy(button, true, label);
  clearError(target);
  try {
    return await work();
  } catch (error) {
    showError(error, target);
  } finally {
    busy(button, false);
  }
}
export function fieldsError(error, form, target) {
  showError(error, target);
  let first;
  for (const [name, message] of Object.entries(error.fields || {})) {
    const input = form.elements.namedItem(name),
      box = document.getElementById(`${name}-error`);
    if (input?.setAttribute) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", `${name}-error`);
      first ||= input;
    }
    if (box) {
      box.textContent = message;
      box.hidden = false;
    }
  }
  first?.focus();
}
export const link = (label, href, variant = "primary") =>
  `<a class="button-button button-${variant}" href="${h(href)}">${h(label)}</a>`;
export const button = (label, id, variant = "primary") =>
  `<button type="button" class="button-button button-${variant}" id="${h(id)}">${h(label)}</button>`;
export const card = (content, classes = "") =>
  `<section class="display-card ${classes}">${content}</section>`;
export const empty = (
  title,
  message,
  href = "/aprender",
  label = "Ir para as aulas",
) =>
  `<section class="states-empty"><h2>${h(title)}</h2><p class="muted">${h(message)}</p>${href ? link(label, href, "accent") : ""}</section>`;
export function progress(value, label, tone = "learn") {
  const percent = Math.max(
    0,
    Math.min(100, Math.round(Number(value) * 100) || 0),
  );
  return `<div class="display-progress display-progress_sm" role="progressbar" aria-label="${h(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span class="display-progressFill display-fill_${tone}" data-progress="${percent}"></span></div>`;
}
export function stat(label, value, hint = "") {
  return `<div class="display-stat"><span class="display-statLabel">${h(label)}</span><strong class="display-statValue">${h(value)}</strong><span class="display-statHint">${h(hint)}</span></div>`;
}
export function dateLabel(iso) {
  return iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    : "";
}
export function minuteLabel(minutes) {
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)}h ${minutes % 60 || ""}${minutes % 60 ? "min" : ""}`;
}
export function highlighted(text, changes, key) {
  const terms = (changes || [])
    .map((item) => item[key])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return h(text);
  const escaped = terms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return String(text)
    .split(pattern)
    .map((piece) =>
      terms.some((term) => term.toLowerCase() === piece.toLowerCase())
        ? `<mark class="${key === "from" ? "correction-removed" : "marker"}">${h(piece)}</mark>`
        : h(piece),
    )
    .join("");
}
export function correction(data, chat = false) {
  return `<div class="correction-${chat ? "chat" : "card"}"><div class="correction-row"><span class="caption">${chat ? "You said" : "Sua frase"}</span><p class="correction-original" lang="en">${highlighted(data.original, data.changes, "from")}</p></div><div class="correction-row"><span class="caption">${chat ? "More natural" : "Forma recomendada"}</span><p class="correction-suggestion" lang="en">${highlighted(data.suggestion, data.changes, "to")}</p></div>${chat ? "<details><summary>Por quê?</summary>" : '<div class="correction-row"><span class="caption">Explicação</span>'}<p class="source-language">${h(data.explanation)}</p>${data.tip ? `<p class="correction-tip">${h(data.tip)}</p>` : ""}${chat ? "</details>" : "</div>"}</div>`;
}
export const avatar = () =>
  '<span class="brand-avatar" aria-hidden="true"><svg viewBox="0 0 40 40" width="32" height="32"><rect x="2" y="3" width="36" height="30" rx="11" fill="var(--talk)"/><path d="M10 31v7l7-6z" fill="var(--talk)"/><path d="M20 9.5c.9 4.4 2.6 6.1 7 7-4.4.9-6.1 2.6-7 7-.9-4.4-2.6-6.1-7-7 4.4-.9 6.1-2.6 7-7z" fill="#fff"/></svg></span>';
export function hydrate() {
  $$("[data-progress]").forEach((node) => {
    node.style.width = `${Math.max(0, Math.min(100, Number(node.dataset.progress) || 0))}%`;
  });
  $$("[data-height]").forEach((node) => {
    node.style.height = `${Math.max(0, Math.min(100, Number(node.dataset.height) || 0))}%`;
  });
  $$(".choice-option,.choice-segment").forEach((node) =>
    node.classList.toggle("choice-selected", Boolean($("input:checked", node))),
  );
}
export function render(content, root = $("#feature-content")) {
  root.innerHTML = content;
  hydrate();
  $("[data-page-title]", root)?.focus({ preventScroll: true });
}
export async function load(work, root = $("#feature-content")) {
  try {
    await work();
  } catch (error) {
    if (error.code === "UNAUTHENTICATED") return;
    const retry = !["NOT_FOUND", "FORBIDDEN", "VALIDATION"].includes(
      error.code,
    );
    root.innerHTML = `${errorView(error)}<div class="row-actions">${retry ? button("Tentar de novo", "page-retry", "secondary") : ""}${link("Voltar ao início", "/inicio", "secondary")}</div>`;
    $("#page-retry")?.addEventListener("click", () => load(work, root));
  }
}
export function dialog(title, content, actions = []) {
  const modal = $("#ui-dialog");
  $("#ui-dialog-title").textContent = title;
  $("#ui-dialog-body").innerHTML = content;
  $("#ui-dialog-actions").replaceChildren();
  for (const [label, work, variant = "secondary"] of actions) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `button-button button-${variant}`;
    item.textContent = label;
    item.addEventListener("click", () => work(item, modal));
    $("#ui-dialog-actions").append(item);
  }
  if (!modal.open) modal.showModal();
  return modal;
}
export function initCommon() {
  hydrate();
  $("[data-page-title]")?.focus({ preventScroll: true });
  $$("[data-password-toggle]").forEach((toggle) =>
    toggle.addEventListener("click", () => {
      const field = document.getElementById(toggle.dataset.passwordToggle),
        show = field.type === "password";
      field.type = show ? "text" : "password";
      toggle.setAttribute(
        "aria-label",
        show ? "Ocultar senha" : "Mostrar senha",
      );
      toggle.setAttribute("aria-pressed", String(show));
    }),
  );
  document.addEventListener("change", hydrate);
  $("[data-dialog-close]").addEventListener("click", () =>
    $("#ui-dialog").close(),
  );
  $("#ui-dialog").addEventListener("click", (event) => {
    if (event.target === $("#ui-dialog")) $("#ui-dialog").close();
  });
  $$("[data-signout-confirm]").forEach((item) =>
    item.addEventListener("click", () =>
      dialog(
        "Sair da conta?",
        '<p>Sua conta está salva. Ao entrar de novo, você continua a etapa pendente.</p><div id="logout-error" hidden></div>',
        [
          ["Continuar aqui", (_button, modal) => modal.close()],
          [
            "Sair da conta",
            (button) => action(button, logout, "#logout-error", "Saindo…"),
            "primary",
          ],
        ],
      ),
    ),
  );
  const landingMenu = $("#landing-menu-button");
  landingMenu?.addEventListener("click", () => {
    const open = landingMenu.getAttribute("aria-expanded") !== "true";
    landingMenu.setAttribute("aria-expanded", String(open));
    $("#landing-nav").classList.toggle("landing-navOpen", open);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && landingMenu) {
      landingMenu.setAttribute("aria-expanded", "false");
      $("#landing-nav").classList.remove("landing-navOpen");
      landingMenu.focus();
    }
  });
  $$("[data-section-link]").forEach((item) =>
    item.addEventListener("click", (event) => {
      const target = $(item.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      landingMenu?.setAttribute("aria-expanded", "false");
      $("#landing-nav")?.classList.remove("landing-navOpen");
      history.replaceState(null, "", item.getAttribute("href"));
      target.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      $("h1,h2", target)?.focus({ preventScroll: true });
    }),
  );
  if (context.page === "landing" && location.hash) {
    try {
      $("h1,h2", $(location.hash))?.focus({ preventScroll: true });
    } catch {}
  }
  if (userId) {
    const verify = async () => {
      try {
        const result = await api("/auth/session", "GET", undefined, {
          public: true,
        });
        if (!result.account || result.account.user.id !== userId) {
          $("#conteudo").replaceChildren();
          location.replace(
            result.account ? nextPath(result.account) : "/entrar?expired=1",
          );
        }
      } catch {
        /* Existing page remains readable if offline; private mutations still verify server session. */
      }
    };
    channel &&
      (channel.onmessage = (event) => {
        if (["signed_out", "deleted"].includes(event.data?.reason)) {
          $("#conteudo").replaceChildren();
          location.replace(
            event.data.reason === "deleted" ? "/" : "/entrar?signed_out=1",
          );
        } else verify();
      });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) verify();
    });
    window.addEventListener("focus", verify);
  }
}
