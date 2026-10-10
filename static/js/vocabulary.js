import {
  $,
  api,
  context,
  h,
  card,
  button,
  link,
  load,
  render,
  empty,
  dialog,
  action,
  toast,
  levels,
  dateLabel,
} from "./common.js";
export function init() {
  let overview,
    filter = "all",
    search = "";
  async function open(id) {
    try {
      const word = await api(`/vocabulary/${encodeURIComponent(id)}`);
      dialog(
        word.word,
        `<div class="word-details"><p class="vocabulary-detailTranslation">${h(word.translation)}</p><p class="vocabulary-detailMeta">${h(word.partOfSpeech)} · nível ${h(levels[word.level])} · ${h(word.topic)}</p><div><span class="caption">Significado</span><p lang="en">${h(word.meaning)}</p></div>${word.examples.map((example) => `<div class="vocabulary-example"><p lang="en"><strong>${h(example.en)}</strong></p><p class="muted">${h(example.pt)}</p></div>`).join("")}<p>${word.status === null ? "Ainda não está no seu vocabulário." : word.status === "learned" ? "Aprendida." : `Próxima revisão: ${dateLabel(word.nextReviewAt)}`}</p>${word.lessonId ? link(`Da aula: ${word.lessonTitle}`, `/aprender/aula/${encodeURIComponent(word.lessonId)}`, "ghost") : ""}<div id="word-error" hidden></div></div>`,
        [
          [
            word.status === "learned"
              ? "Quero revisar de novo"
              : word.status === "learning"
                ? "Já aprendi"
                : "Adicionar ao meu vocabulário",
            (button) =>
              action(
                button,
                async () => {
                  await api(
                    `/vocabulary/${encodeURIComponent(word.id)}/status`,
                    "PUT",
                    {
                      status:
                        word.status === "learning" ? "learned" : "learning",
                    },
                  );
                  overview = await api("/vocabulary");
                  $("#ui-dialog").close();
                  draw();
                  toast("Vocabulário atualizado.");
                },
                "#word-error",
                "Salvando…",
              ),
            "primary",
          ],
        ],
      );
    } catch (error) {
      toast(error.message);
    }
  }
  function row(word) {
    return `<li><button type="button" class="vocabulary-row" data-word="${h(word.id)}"><span class="vocabulary-word" lang="en">${h(word.word)}</span><span class="vocabulary-translation">${h(word.translation)}</span><span class="vocabulary-rowMeta"><span class="choice-chip">${word.status === "learned" ? "Aprendida" : word.due ? "Revisar" : word.status === null ? "Nova" : "Estudando"}</span></span></button></li>`;
  }
  function rows() {
    const visible = overview.studied.filter(
      (word) =>
        (filter === "all" ||
          (filter === "due" && word.due) ||
          (filter === "learned" && word.status === "learned")) &&
        `${word.word} ${word.translation}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    );
    $("#word-list").innerHTML = visible.length
      ? visible.map(row).join("")
      : "<li>Nenhuma palavra encontrada com esse filtro.</li>";
  }
  function draw() {
    render(
      `<div class="vocabulary-counts"><span><strong>${overview.counts.studied}</strong> estudadas</span><span><strong>${overview.counts.due}</strong> para revisar</span><span><strong>${overview.counts.learned}</strong> aprendidas</span></div>${
        overview.studied.length
          ? `<div class="vocabulary-toolbar"><div class="field-field"><label for="word-search">Buscar palavra</label><input id="word-search" class="exercise-text-input" type="search" value="${h(search)}" placeholder="Ex.: kitchen ou cozinha"></div><div class="vocabulary-filters" role="group" aria-label="Filtrar palavras">${[
              ["all", "Todas"],
              ["due", "Para revisar"],
              ["learned", "Aprendidas"],
            ]
              .map(
                ([value, label]) =>
                  `<button type="button" class="choice-chip choice-chipButton" data-filter="${value}" aria-pressed="${filter === value}">${label}</button>`,
              )
              .join(
                "",
              )}</div></div><ul id="word-list" class="vocabulary-list" aria-label="Palavras estudadas"></ul>${overview.counts.due ? link("Revisar palavras", "/revisao", "secondary") : ""}`
          : empty(
              "Seu vocabulário começa na primeira aula",
              "As palavras das aulas concluídas aparecerão aqui, prontas para revisar.",
            )
      }${overview.suggestions.length ? `<section class="vocabulary-suggestions"><h2>Sugestões para o seu nível</h2><ul class="vocabulary-list">${overview.suggestions.map(row).join("")}</ul></section>` : ""}`,
    );
    if ($("#word-list")) rows();
    $("#word-search")?.addEventListener("input", (event) => {
      search = event.target.value;
      rows();
    });
  }
  $("#feature-content").addEventListener("click", (event) => {
    const word = event.target.closest("[data-word]");
    if (word) open(word.dataset.word);
    const selected = event.target.closest("[data-filter]");
    if (selected) {
      filter = selected.dataset.filter;
      draw();
    }
  });
  load(async () => {
    overview = await api("/vocabulary");
    draw();
    const selected = new URLSearchParams(location.search).get("palavra");
    if (selected) await open(selected);
  });
}
