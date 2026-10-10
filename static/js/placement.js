import {
  $,
  api,
  context,
  action,
  button,
  card,
  h,
  levels,
  render,
  link,
} from "./common.js";
export function init() {
  let step,
    index = 0,
    answers = {},
    pending = false;
  async function result(data) {
    render(
      `<div class="placement-stack"><span class="caption">Resultado do nivelamento</span>${card(`<span>Seu nível estimado</span><h1 data-page-title tabindex="-1">${h(data.levelLabel || levels[data.level])}</h1><p>${h(data.levelDescription)}</p>${!data.skipped ? `<p>Você acertou ${data.correct} de ${data.answered} atividades.</p>` : ""}`, "display-card_ink")}<p>${h(data.comparison)}</p><p class="placement-disclaimer">Este resultado é uma estimativa pedagógica para personalizar seus estudos — não é uma certificação oficial de proficiência.</p>${link(context.editing ? "Voltar ao perfil" : "Ir para o início", context.editing ? "/perfil" : "/inicio")}</div>`,
    );
  }
  function question() {
    const current = step.questions[index];
    $("#placement-progress").value = (step.stageNumber - 1) * 4 + index;
    render(
      `<div class="placement-stack"><span class="caption">Etapa ${step.stageNumber} de até ${step.totalStages} · Atividade ${index + 1} de ${step.questions.length}</span><p>${h(current.instruction)}</p>${current.passage ? `<blockquote lang="en" class="placement-passage">${h(current.passage)}</blockquote>` : ""}<h1 data-page-title tabindex="-1" lang="en">${h(current.prompt)}</h1><form id="placement-form"><fieldset class="choice-group"><legend>Escolha uma resposta</legend><div class="choice-options choice-two">${current.options.map((option) => `<label class="choice-option"><input class="visually-hidden" type="radio" name="answer" value="${h(option)}"><span class="choice-title" lang="en">${h(option)}</span><span class="choice-indicator" aria-hidden="true"></span></label>`).join("")}</div></fieldset><div id="placement-error" hidden></div><button class="button-button button-primary button-lg button-block" id="placement-next" type="submit" disabled>${index < step.questions.length - 1 ? "Próxima" : "Concluir etapa"}</button></form></div>`,
    );
    const form = $("#placement-form");
    form.addEventListener(
      "change",
      () => ($("#placement-next").disabled = false),
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending) return;
      const value = form.elements.answer.value;
      if (!value) return;
      answers[current.id] = value;
      if (index < step.questions.length - 1) {
        index++;
        question();
        return;
      }
      pending = true;
      await action(
        $("#placement-next"),
        async () => {
          const next = await api("/placement/answers", "POST", { answers });
          if (next.status === "done") await result(next.result);
          else {
            step = next;
            index = 0;
            question();
          }
        },
        "#placement-error",
        "Analisando…",
      );
      pending = false;
    });
  }
  const run = async (kind) => {
    if (pending) return;
    pending = true;
    const start = $("#placement-start"),
      skip = $("#placement-skip"),
      selected = kind === "start" ? start : skip,
      other = kind === "start" ? skip : start;
    other.disabled = true;
    await action(
      selected,
      async () => {
        const response = await api(`/placement/${kind}`, "POST");
        if (kind === "skip") return result(response);
        step = response;
        index = 0;
        answers = {};
        question();
      },
      "#placement-error",
      "Preparando…",
    );
    pending = false;
    if (other.isConnected) other.disabled = false;
  };
  $("#placement-start").addEventListener("click", () => run("start"));
  $("#placement-skip").addEventListener("click", () => run("skip"));
}
