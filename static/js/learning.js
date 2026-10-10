import {
  $,
  $$,
  api,
  context,
  h,
  levels,
  load,
  render,
  card,
  link,
  button,
  action,
  showError,
  busy,
  correction,
  progress,
  dateLabel,
  highlighted,
} from "./common.js";
const typeLabels = {
  multiple_choice: "Múltipla escolha",
  select_word: "Selecione a palavra",
  fill_blank: "Complete a frase",
  translate: "Tradução",
  write: "Escreva sua resposta",
};

/* Runs the issued exercise list; the server grades and determines all totals. */
function runner(exercises, answeredIds, answer, finish, finishLabel) {
  const already = new Set(answeredIds || []),
    remaining = exercises.filter((item) => !already.has(item.id));
  let index = 0;
  if (!remaining.length) {
    render(
      `<section class="lesson-section"><h1 data-page-title tabindex="-1">Atividades respondidas</h1><p>Suas respostas estão salvas. Vamos registrar o resultado?</p><div id="exercise-error" hidden></div>${button(finishLabel, "exercise-next")}</section>`,
    );
    $("#exercise-next").addEventListener("click", (event) =>
      action(
        event.currentTarget,
        finish,
        "#exercise-error",
        "Registrando seu progresso…",
      ),
    );
    return;
  }
  function draw() {
    const exercise = remaining[index],
      options = ["multiple_choice", "select_word"].includes(exercise.type),
      blank = exercise.type === "fill_blank";
    let feedback = null,
      pending = false,
      key,
      attemptAnswer;
    const input = options
      ? `<fieldset class="choice-group"><legend>Opções</legend><div class="choice-options choice-two">${(exercise.options || []).map((option) => `<label class="choice-option"><input class="visually-hidden" type="radio" name="answer" value="${h(option)}"><span class="choice-title" lang="en">${h(option)}</span><span class="choice-indicator" aria-hidden="true"></span></label>`).join("")}</div></fieldset>`
      : blank
        ? `<label for="exercise-answer" class="field-label">Complete a lacuna</label><input id="exercise-answer" class="exercise-text-input" name="answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" required>`
        : `<label for="exercise-answer" class="visually-hidden">Sua resposta em inglês</label><textarea id="exercise-answer" class="exercise-textarea" name="answer" lang="en" rows="3" maxlength="400" placeholder="${exercise.type === "translate" ? "Digite a tradução em inglês…" : "Escreva sua frase em inglês…"}" required></textarea>`;
    render(
      `<section class="exercise-card"><div class="exercise-meta"><span class="caption">Exercício ${already.size + index + 1} de ${exercises.length}</span><span class="exercise-type">${typeLabels[exercise.type]}</span></div><h1 class="visually-hidden" data-page-title tabindex="-1">Exercícios</h1><form id="exercise-form" class="exercise-form"><h2 class="exercise-instruction">${h(exercise.instruction)}</h2><p class="exercise-prompt" lang="${exercise.type === "translate" ? "pt-BR" : "en"}">${h(exercise.prompt)}</p>${input}${exercise.hint ? `<p class="exercise-hint">Dica: ${h(exercise.hint)}</p>` : ""}<div id="exercise-error" hidden></div><button type="submit" class="button-button button-primary button-lg button-block" id="exercise-verify" disabled>Verificar</button></form><div id="exercise-feedback"></div></section>`,
    );
    const form = $("#exercise-form"),
      verify = $("#exercise-verify");
    form.addEventListener("input", () => {
      verify.disabled = !String(form.elements.answer.value).trim();
    });
    form.addEventListener("change", () => {
      verify.disabled = !String(form.elements.answer.value).trim();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = String(form.elements.answer.value).trim();
      if (!value || pending || feedback) return;
      pending = true;
      if (attemptAnswer !== value) {
        key = crypto.randomUUID();
        attemptAnswer = value;
      }
      busy(
        verify,
        true,
        exercise.type === "write" ? "Analisando sua frase…" : "Verificando…",
      );
      try {
        feedback = await answer(exercise, value, key);
        $$("input,textarea", form).forEach((input) => (input.disabled = true));
        verify.hidden = true;
        const explanation = feedback.correction
          ? correction(feedback.correction)
          : `${feedback.status !== "correct" && feedback.expectedAnswer ? `<dl class="exercise-compare"><div><dt>Sua resposta</dt><dd lang="en">${h(feedback.userAnswer)}</dd></div><div><dt>Forma recomendada</dt><dd lang="en"><mark class="marker">${h(feedback.expectedAnswer)}</mark></dd></div></dl>` : ""}<div class="exercise-why"><span class="caption">${feedback.status === "correct" ? "Por que está certo" : "Explicação"}</span><p>${h(feedback.explanation)}</p>${feedback.tip ? `<p>${h(feedback.tip)}</p>` : ""}${feedback.supportExplanation && feedback.supportExplanation !== feedback.explanation ? `<details><summary>Ver no outro idioma</summary><p>${h(feedback.supportExplanation)}</p></details>` : ""}</div>`;
        $("#exercise-feedback").innerHTML =
          `<div class="exercise-feedback exercise-feedback_${h(feedback.status)}" role="status" aria-live="polite"><div class="exercise-feedbackHead"><span aria-hidden="true">${feedback.status === "correct" ? "✓" : feedback.status === "almost" ? "◉" : "✕"}</span><strong>${h(feedback.title)}</strong></div>${feedback.aiFeedback ? `<p class="exercise-ai">${h(feedback.aiFeedback)}</p>` : ""}${explanation}${button(index === remaining.length - 1 ? finishLabel : "Continuar", "exercise-next")}</div>`;
        $("#exercise-next").focus();
        $("#exercise-next").addEventListener("click", (event) =>
          action(
            event.currentTarget,
            async () => {
              if (index < remaining.length - 1) {
                index++;
                draw();
              } else await finish();
            },
            "#exercise-error",
            "Registrando seu progresso…",
          ),
        );
      } catch (error) {
        showError(error, "#exercise-error");
      } finally {
        pending = false;
        busy(verify, false);
      }
    });
  }
  draw();
}

async function lesson() {
  const id = encodeURIComponent(context.resourceId);
  let data = await api(`/lessons/${id}`),
    stage = 0,
    startedAt = Date.now(),
    alternatives = 0,
    extras = 0;
  $("#lesson-title").textContent = data.title;
  document.title = `${data.title} · English AI`;
  const setStage = (next, progressValue = next) => {
    stage = next;
    $("#lesson-progress").value = progressValue;
    $$("[data-stage-index]").forEach((node) => {
      node.classList.toggle(
        "lesson-current",
        Number(node.dataset.stageIndex) === stage,
      );
      node.classList.toggle(
        "lesson-done",
        Number(node.dataset.stageIndex) < stage,
      );
      node.setAttribute(
        "aria-current",
        Number(node.dataset.stageIndex) === stage ? "step" : "false",
      );
    });
  };
  const navigate = (next) => {
    setStage(next);
    draw();
  };
  function example(item) {
    return `<li class="lesson-example"><p class="lesson-exampleEn" lang="en">${highlighted(item.en, item.highlight ? [{ to: item.highlight }] : [], "to")}</p><p class="lesson-examplePt">${h(item.pt)}</p></li>`;
  }
  async function finish() {
    const result = await api(`/lessons/${id}/complete`, "POST", {
      timeSpentSeconds: Math.max(
        1,
        Math.round((Date.now() - startedAt) / 1000),
      ),
    });
    setStage(5, 6);
    render(
      `<section class="lesson-section"><span class="caption">Aula concluída</span><h1 data-page-title tabindex="-1">${result.score >= 80 ? "Mandou bem!" : result.score >= 50 ? "Bom trabalho!" : "Aula concluída — vamos reforçar?"}</h1><p>${result.correct} de ${result.total} · ${result.score}% de acertos · ${Math.max(1, Math.round(result.timeSpentSeconds / 60))} min de estudo</p>${result.levelUp ? card(`<strong>Seu nível estimado agora é ${h(result.levelUp.label)}!</strong><p>Você concluiu as aulas do nível com bom desempenho.</p>`, "display-card_ink") : ""}${card(`<h2>Resumo da aula</h2><ul class="lesson-objectives">${result.takeaways.map((item) => `<li>✓ ${h(item)}</li>`).join("")}</ul>${result.newWords.length ? `<p class="lesson-newWords"><strong>Palavras novas no seu vocabulário:</strong> ${result.newWords.map((word) => `<mark class="marker" lang="en">${h(word.word)}</mark>`).join(" ")}</p>` : ""}`)}<div id="lesson-error" hidden></div><div class="lesson-summaryActions">${button("Praticar isso na conversa", "lesson-practice", "accent")}${result.reviewSuggested ? link("Revisar agora", "/revisao", "secondary") : ""}${result.nextLesson ? link(`Próxima: ${result.nextLesson.title}`, `/aprender/aula/${encodeURIComponent(result.nextLesson.id)}`, "secondary") : ""}${link("Voltar à trilha", "/aprender", "ghost")}</div></section>`,
    );
    $("#lesson-practice").addEventListener("click", (event) =>
      action(
        event.currentTarget,
        async () => {
          const conversation = await api("/conversations", "POST", {
            topicId: result.practiceTopicId || data.practiceTopicId,
          });
          location.assign(`/conversar/${encodeURIComponent(conversation.id)}`);
        },
        "#lesson-error",
        "Lumi está preparando a conversa…",
      ),
    );
  }
  function draw() {
    if (stage === 0) {
      render(
        `<section class="lesson-section"><span class="display-modeBadge display-mode_learn">Modo Aprender · ${h(levels[data.level])}</span><h1 class="lesson-title" data-page-title tabindex="-1">${h(data.title)}</h1><p class="lesson-topic" lang="en">${h(data.topic)}</p>${card(`<h2>Nesta aula você vai</h2><ul class="lesson-objectives">${data.objectives.map((item) => `<li>✓ ${h(item)}</li>`).join("")}</ul><p class="lesson-meta">${data.estimatedMinutes} minutos · ${data.exercises.length} exercícios · ${data.vocabulary.length} palavras novas</p>`)}${data.aboveLevel ? '<p class="states-inline states-inline_info">Esta aula está acima do seu nível estimado. Tudo bem explorar — as explicações ajudam no caminho.</p>' : ""}<div id="lesson-error" hidden></div>${button(data.status === "in_progress" ? "Continuar aula" : data.status === "completed" ? "Refazer aula" : "Começar aula", "lesson-start", "accent")}</section>`,
      );
      $("#lesson-start").addEventListener("click", (event) =>
        action(
          event.currentTarget,
          async () => {
            await api(`/lessons/${id}/start`, "POST");
            data = await api(`/lessons/${id}`);
            startedAt = Date.now();
            navigate(1);
          },
          "#lesson-error",
          "Preparando…",
        ),
      );
    }
    if (stage === 1) {
      render(
        `<section class="lesson-section"><h1 class="lesson-stepTitle" data-page-title tabindex="-1">Entendendo: ${h(data.topic)}</h1>${card(data.explanation.map((item) => `<p class="source-language">${h(item.primary)}</p>${data.supportLanguageAvailable ? `<details><summary>Ver em ${data.language === "pt" ? "inglês" : "português"}</summary><p>${h(item.support)}</p></details>` : ""}`).join(""), "lesson-explanation")}${data.table ? `<div class="lesson-tableWrap"><table class="lesson-table"><caption>${h(data.table.caption)}</caption><thead><tr>${data.table.headers.map((value) => `<th scope="col">${h(value)}</th>`).join("")}</tr></thead><tbody>${data.table.rows.map((row) => `<tr>${row.map((value, index) => `<${index ? "td" : 'th scope="row"'}>${h(value)}</${index ? "td" : "th"}>`).join("")}</tr>`).join("")}</tbody></table></div>` : ""}<div id="lesson-extra" class="stack" aria-live="polite"></div><div id="lesson-error" hidden></div><div class="lesson-rowActions">${button("Explicar de outro jeito", "lesson-explain", "secondary")}${button("Ver exemplos", "lesson-next")}</div></section>`,
      );
      $("#lesson-explain").addEventListener("click", (event) =>
        action(
          event.currentTarget,
          async () => {
            const result = await api(`/lessons/${id}/explain`, "POST", {
              attempt: alternatives++,
            });
            $("#lesson-extra").insertAdjacentHTML(
              "beforeend",
              card(
                `<span class="caption">Lumi · outra forma de explicar</span><p>${h(result.text)}</p>`,
              ),
            );
          },
          "#lesson-error",
          "Preparando explicação…",
        ),
      );
      $("#lesson-next").addEventListener("click", () => navigate(2));
    }
    if (stage === 2) {
      render(
        `<section class="lesson-section"><h1 class="lesson-stepTitle" data-page-title tabindex="-1">Exemplos</h1><ul class="lesson-examples" id="lesson-examples" aria-live="polite">${data.examples.map(example).join("")}</ul><div id="lesson-error" hidden></div><div class="lesson-rowActions">${button("Me dê outro exemplo", "lesson-example", "secondary")}${button("Continuar", "lesson-next")}</div></section>`,
      );
      $("#lesson-example").addEventListener("click", (event) =>
        action(
          event.currentTarget,
          async () => {
            const next = await api(`/lessons/${id}/example`, "POST", {
              attempt: extras++,
            });
            $("#lesson-examples").insertAdjacentHTML(
              "beforeend",
              example(next),
            );
          },
          "#lesson-error",
          "Criando exemplo…",
        ),
      );
      $("#lesson-next").addEventListener("click", () => navigate(3));
    }
    if (stage === 3) {
      render(
        `<section class="lesson-section"><h1 class="lesson-stepTitle" data-page-title tabindex="-1">Vocabulário da aula</h1><p class="muted">Estas palavras entram no seu vocabulário quando você concluir a aula.</p><ul class="lesson-words">${data.vocabulary.map((word) => `<li class="lesson-word"><span class="lesson-wordHead"><strong lang="en"><mark class="marker">${h(word.word)}</mark></strong><span>${h(word.translation)}</span></span><span class="lesson-wordExample" lang="en">${h(word.examples[0]?.en)}</span></li>`).join("")}</ul>${button("Ir para os exercícios", "lesson-next")}</section>`,
      );
      $("#lesson-next").addEventListener("click", () => navigate(4));
    }
    if (stage === 4)
      runner(
        data.exercises,
        data.answeredExerciseIds,
        (exercise, value, key) =>
          api(
            `/lessons/${id}/exercises/${encodeURIComponent(exercise.id)}/answer`,
            "POST",
            { answer: value },
            { key },
          ),
        finish,
        "Ver resumo da aula",
      );
  }
  draw();
}

async function review() {
  const id = encodeURIComponent(context.resourceId),
    session = await api(`/reviews/${id}/session`, "POST"),
    startedAt = Date.now();
  $("#review-title").textContent = `Revisão · ${session.review.title}`;
  async function finish() {
    const result = await api(`/reviews/${id}/complete`, "POST", {
      timeSpentSeconds: Math.max(
        1,
        Math.round((Date.now() - startedAt) / 1000),
      ),
    });
    render(
      `<span class="caption">Revisão concluída</span><h1 data-page-title tabindex="-1">${result.score}% de acertos</h1><p>${result.correct} de ${result.total} corretas</p>${card(`<p>${h(result.message)}</p>${result.nextReviewAt ? `<p>Próxima revisão: ${dateLabel(result.nextReviewAt)}</p>` : ""}`)}<div class="reviewsession-actions">${link("Voltar à revisão", "/revisao")}${link("Ver progresso", "/progresso", "secondary")}</div>`,
    );
  }
  runner(
    session.exercises,
    session.answeredExerciseIds,
    (exercise, value, key) =>
      api(
        `/reviews/${id}/answers`,
        "POST",
        { exerciseId: exercise.id, answer: value },
        { key },
      ),
    finish,
    "Ver resultado",
  );
  $("#feature-content").insertAdjacentHTML(
    "afterbegin",
    `<p class="reviewsession-reason"><strong>Por que revisar:</strong> ${h(session.review.reasonText)}</p>`,
  );
}
export function init() {
  load(context.page === "lesson" ? lesson : review);
}
