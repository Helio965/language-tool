import { $, $$, context, api, busy, showError, hydrate } from "./common.js";
export function init() {
  const form = $("#profile-form"),
    next = $("#onboarding-next"),
    back = $("#onboarding-back");
  let stage = 0,
    pending = false;
  const valid = () =>
    stage === 0
      ? Boolean(form.elements.goal.value)
      : stage === 1
        ? Boolean(
            form.elements.perceivedLevel.value &&
            form.elements.priorExperience.value,
          )
        : true;
  const update = () => {
    $$("[data-onboarding-step]").forEach(
      (node) => (node.hidden = Number(node.dataset.onboardingStep) !== stage),
    );
    back.hidden = stage === 0;
    $("#onboarding-stage-label").textContent =
      `Passo ${stage + 1} de 3 · ${["Objetivo", "Experiência", "Interesses"][stage]}`;
    $("#onboarding-progress").value = stage + 1;
    next.textContent =
      stage === 2
        ? context.editing
          ? "Salvar alterações"
          : "Salvar e fazer o nivelamento"
        : "Continuar";
    next.disabled = !valid();
    $("#interest-count").textContent =
      `${$$("input[name=interestAreas]:checked", form).length} de 3 selecionadas`;
    hydrate();
  };
  form.addEventListener("change", (event) => {
    if (
      event.target.name === "interestAreas" &&
      $$("input[name=interestAreas]:checked", form).length > 3
    ) {
      event.target.checked = false;
      $("#interest-count").textContent = "Selecione até 3 áreas de interesse.";
      return;
    }
    update();
  });
  back.addEventListener("click", () => {
    if (pending) return;
    stage--;
    update();
    $("[data-onboarding-step]:not([hidden]) h1").focus();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending || !valid()) return;
    if (stage < 2) {
      stage++;
      update();
      $("[data-onboarding-step]:not([hidden]) h1").focus();
      return;
    }
    pending = true;
    busy(next, true, "Salvando…");
    try {
      await api("/me/profile", "PUT", {
        goal: form.elements.goal.value,
        perceivedLevel: form.elements.perceivedLevel.value,
        priorExperience: form.elements.priorExperience.value,
        conversationInterest: form.elements.conversationInterest.checked,
        professionalInterest: form.elements.professionalInterest.checked,
        interestAreas: $$("input[name=interestAreas]:checked", form).map(
          (item) => item.value,
        ),
      });
      location.replace(context.editing ? "/perfil" : "/nivelamento");
    } catch (error) {
      showError(error, "#profile-error");
    } finally {
      pending = false;
      busy(next, false);
      update();
    }
  });
  update();
}
