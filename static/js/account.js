import {
  $,
  $$,
  api,
  context,
  action,
  logout,
  showError,
  clearError,
  toast,
  dialog,
  busy,
  channel,
  h,
  hydrate,
} from "./common.js";
export function init() {
  if (context.page === "profile")
    $("#logout-button").addEventListener("click", (event) =>
      action(event.currentTarget, logout, "#profile-error", "Saindo…"),
    );
  if (context.page === "preferences") {
    const form = $("#preferences-form"),
      versions = {};
    let queue = Promise.resolve(),
      saved = { ...context.account.preferences };
    const restore = (name) => {
      $$(`[name=${name}]`, form).forEach((field) => {
        if (field.type === "checkbox") field.checked = saved[name];
        else field.checked = String(saved[name]) === field.value;
      });
      hydrate();
    };
    form.addEventListener("change", (event) => {
      const input = event.target,
        name = input.name;
      if (!name) return;
      const value =
        input.type === "checkbox"
          ? input.checked
          : name === "dailyGoalMinutes"
            ? Number(input.value)
            : input.value;
      const version = (versions[name] = (versions[name] || 0) + 1);
      queue = queue.then(async () => {
        try {
          saved = await api("/me/preferences", "PATCH", { [name]: value });
          if (versions[name] === version) {
            restore(name);
            clearError("#preferences-error");
            toast("Preferência salva.");
          }
        } catch (error) {
          if (versions[name] === version) {
            restore(name);
            showError(error, "#preferences-error");
          }
        }
      });
    });
  }
  if (context.page === "privacy") {
    $("#clear-history").addEventListener("click", () =>
      dialog(
        "Apagar o histórico de conversas?",
        '<p>O conteúdo de todas as conversas será apagado. Essa ação não pode ser desfeita.</p><div id="history-error" hidden></div>',
        [
          ["Cancelar", (_button, modal) => modal.close()],
          [
            "Apagar histórico",
            (button) =>
              action(
                button,
                async () => {
                  const result = await api("/conversations", "DELETE");
                  $("#ui-dialog").close();
                  toast(
                    result.deleted
                      ? `${result.deleted} conversas apagadas.`
                      : "Não havia conversas para apagar.",
                  );
                },
                "#history-error",
                "Apagando…",
              ),
            "danger",
          ],
        ],
      ),
    );
    $("#delete-account").addEventListener("click", () => {
      dialog(
        "Excluir sua conta?",
        '<form id="delete-form" class="ui-dialog-form"><p>Para confirmar, digite sua senha. Todos os seus dados serão removidos permanentemente.</p><label for="delete-password">Senha</label><input id="delete-password" class="exercise-text-input" type="password" autocomplete="current-password" required><div id="delete-error" hidden></div><button class="button-button button-danger" type="submit" id="delete-submit">Excluir definitivamente</button></form>',
        [["Cancelar", (_button, modal) => modal.close()]],
      );
      $("#delete-form").addEventListener("submit", (event) => {
        event.preventDefault();
        action(
          $("#delete-submit"),
          async () => {
            try {
              await api("/me", "DELETE", {
                password: $("#delete-password").value,
              });
              channel?.postMessage({ reason: "deleted" });
              location.replace("/?deleted=1");
            } catch (error) {
              $("#delete-password").value = "";
              throw error;
            }
          },
          "#delete-error",
          "Excluindo…",
        );
      });
    });
  }
}
