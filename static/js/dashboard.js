import {
  $,
  api,
  card,
  context,
  h,
  levels,
  link,
  load,
  render,
  empty,
  progress,
  stat,
  dateLabel,
  minuteLabel,
} from "./common.js";
const lessonLink = (item, label = item.title) =>
  link(
    label,
    `/aprender/aula/${encodeURIComponent(item.id || item.lessonId)}`,
    "secondary",
  );
function home(data) {
  const lesson = data.continueLesson,
    hour = new Date().getHours(),
    greeting =
      hour < 5
        ? "Boa noite"
        : hour < 12
          ? "Bom dia"
          : hour < 18
            ? "Boa tarde"
            : "Boa noite";
  $("[data-page-title]").textContent = `${greeting}, ${data.firstName}!`;
  const next = lesson
    ? card(
        `<span class="home-nextLabel">${lesson.status === "in_progress" ? "Continuar de onde parei" : data.hasActivity ? "Próxima aula recomendada" : "Comece por aqui"}</span><h2 class="home-nextTitle">${h(lesson.title)}</h2><p class="home-nextMeta" lang="en">${h(lesson.topic)} · ${lesson.estimatedMinutes} min · ${lesson.exerciseCount} exercícios</p><p class="muted">${h(lesson.summary)}</p>${link(lesson.status === "in_progress" ? "Continuar aula" : "Começar aula", `/aprender/aula/${encodeURIComponent(lesson.id)}`, "accent")}`,
        "home-next",
      )
    : card(
        `<h2>Você concluiu todas as aulas disponíveis!</h2><p>Continue praticando na conversa e revisando o que aprendeu.</p>${link("Conversar agora", "/conversar", "accent")}`,
      );
  render(
    `<div class="home-page"><p><span class="display-levelBadge">Nível estimado: ${h(data.levelLabel)}</span> ${data.goalLabel ? `<span class="choice-chip">Objetivo: ${h(data.goalLabel)}</span>` : ""}</p><div class="home-grid"><div class="home-mainCol">${next}${data.reviewCount ? `<a href="/revisao" class="home-review"><span class="home-reviewText"><strong>Você tem ${data.reviewCount} conteúdos para revisar</strong><span>${h(data.reviewDue[0]?.reasonText)}</span></span></a>` : ""}<section><h2>Escolha como estudar</h2><div class="home-modes"><a href="/aprender" class="home-mode home-learn"><strong>Aprender</strong><span>Aulas, exercícios e explicações no seu nível.</span></a><a href="/conversar" class="home-mode home-talk"><strong>Conversar</strong><span>Pratique com Lumi sem medo de errar.</span></a></div></section></div><aside class="home-sideCol" aria-label="Resumo do dia">${card(`<h2 class="home-sideTitle">Meta de hoje</h2><strong>${data.todayMinutes} de ${data.dailyGoalMinutes} minutos</strong>${progress(data.todayMinutes / data.dailyGoalMinutes, "Meta de hoje", "success")}<p class="home-streak">${data.streakDays ? `${data.streakDays} dias seguidos de estudo` : "Estude hoje para começar uma sequência"}</p>`)}${data.hasActivity ? card(`<h2 class="home-sideTitle">Seu progresso</h2><div class="home-miniStats"><div><strong>${data.lessonsCompleted}</strong><span>aulas concluídas</span></div><div><strong>${data.accuracy ?? "—"}${data.accuracy !== null ? "%" : ""}</strong><span>de acertos</span></div></div>${link("Ver progresso completo", "/progresso", "ghost")}`) : ""}${data.recentWords.length ? card(`<h2 class="home-sideTitle">Palavras recentes</h2><ul class="home-words">${data.recentWords.map((word) => `<li><a href="/vocabulario?palavra=${encodeURIComponent(word.id)}" lang="en"><mark class="marker">${h(word.word)}</mark></a><span>${h(word.translation)}</span></li>`).join("")}</ul>${link("Abrir vocabulário", "/vocabulario", "ghost")}`) : ""}${data.lastConversation ? `<a class="home-lastChat" href="/conversar/${encodeURIComponent(data.lastConversation.id)}">Última conversa: ${h(data.lastConversation.title)} · ${dateLabel(data.lastConversation.updatedAt)}</a>` : ""}</aside></div></div>`,
  );
}
function learn(items) {
  render(
    `<div class="learn-layout"><div class="learn-trail">${Object.entries(levels)
      .map(([level, label]) => {
        const group = items.filter((item) => item.level === level);
        return group.length
          ? `<section class="learn-group"><header class="learn-groupHead"><h2>${label}</h2><span>${group.filter((item) => item.status === "completed").length} de ${group.length} concluídas</span></header>${group[0].aboveLevel ? '<p class="learn-groupNote">Recomendado depois de avançar no seu nível atual — fique à vontade para explorar.</p>' : ""}<ol class="learn-path">${group.map((item) => `<li class="learn-item ${item.recommended ? "learn-recommended" : ""} ${item.status === "completed" ? "learn-completed" : ""}"><span class="learn-dot">${item.status === "completed" ? "✓" : item.order}</span><a class="learn-lessonCard" href="/aprender/aula/${encodeURIComponent(item.id)}"><span class="learn-lessonText"><strong>${h(item.title)}</strong><span class="learn-lessonMeta">${h(item.topic)} · ${item.estimatedMinutes} min</span>${item.recommended ? `<span class="learn-lessonSummary">${h(item.summary)}</span>` : ""}</span><span class="choice-chip">${item.status === "completed" ? `Concluída · ${item.score}%` : item.status === "in_progress" ? "Em andamento" : item.recommended ? "Recomendada" : "Disponível"}</span></a></li>`).join("")}</ol></section>`
          : "";
      })
      .join(
        "",
      )}</div><aside class="learn-side">${card(`<h2>Nível estimado: ${h(levels[context.account.profile.estimatedLevel])}</h2><p>Conclua as aulas do seu nível com bom desempenho para avançar.</p>`)}${link("Revisão", "/revisao", "secondary")}${link("Vocabulário", "/vocabulario", "secondary")}</aside></div>`,
  );
}
function reviews(data) {
  const reviewCard = (item) =>
    `<li class="review-card"><div class="review-text"><h2>${h(item.title)}</h2><p>${h(item.reasonText)}</p><span class="review-meta">~${item.estimatedMinutes} min</span></div>${link("Revisar", `/revisao/${encodeURIComponent(item.id)}`)}</li>`;
  render(
    `${data.due.length ? `<p>Você tem ${data.due.length} conteúdos para revisar.</p><ul class="review-list">${data.due.map(reviewCard).join("")}</ul>` : empty("Tudo em dia!", "Novas revisões aparecem conforme você estuda — quando um tema gera dúvidas ou alguns dias depois de uma aula.", "/aprender", "Continuar estudando")}${data.upcoming.length ? `<section class="review-upcoming"><h2>Próximas revisões</h2><ul class="review-upcomingList">${data.upcoming.map((item) => `<li><span>${h(item.title)}</span><span>${dateLabel(item.dueAt)}</span></li>`).join("")}</ul></section>` : ""}${data.completedCount ? `<p class="review-completed">${data.completedCount} revisões concluídas até agora.</p>` : ""}`,
  );
}
function overview(data) {
  if (!data.hasActivity) {
    render(
      empty(
        "Nada por aqui ainda",
        "Seu progresso aparecerá aqui assim que você começar sua primeira aula.",
        "/aprender",
        "Começar minha primeira aula",
      ),
    );
    return;
  }
  const totals = data.totals,
    level = data.level,
    maxMinutes = Math.max(10, ...data.week.map((day) => day.minutes));
  render(
    `<div class="progress-grid">${level ? card(`<span class="progress-levelLabel">Nível estimado</span><h2 class="progress-levelName">${h(level.label)}</h2>${progress(level.percent / 100, `Aulas concluídas do nível ${level.label}`, "success")}<p>${level.completedInLevel} de ${level.totalInLevel} aulas do nível ${h(level.label)} concluídas${level.nextLabel ? ` · próximo: ${h(level.nextLabel)}` : ""}</p><p class="progress-levelNote">Estimativa pedagógica que evolui com seus estudos — não é certificação oficial.</p>`, "display-card_ink progress-levelCard") : ""}<section class="progress-statsSection"><h2>Resumo</h2><div class="stats-grid">${stat("Aulas concluídas", totals.lessonsCompleted)}${stat("Exercícios", totals.exercisesDone)}${stat("Taxa de acertos", totals.accuracy === null ? "—" : `${totals.accuracy}%`)}${stat("Palavras estudadas", totals.wordsStudied, `${totals.wordsLearned} aprendidas`)}${stat("Tempo de estudo", minuteLabel(totals.studyMinutes), `${totals.studyDays} dias de estudo`)}${stat("Sequência", `${totals.streakDays} dias`, `${totals.conversations} conversas`)}</div></section>${card(`<h2 class="progress-cardTitle">Últimos 7 dias</h2><ol class="progress-bars" aria-label="Minutos de estudo por dia">${data.week.map((day, index) => `<li class="${index === 6 ? "progress-today" : ""}"><span class="progress-barValue">${day.minutes}</span><span class="progress-barTrack"><span class="progress-bar ${day.active ? "progress-barActive" : ""}" data-height="${Math.max(day.active ? 8 : 3, (day.minutes / maxMinutes) * 100)}"></span></span><span class="progress-barDay">${index === 6 ? "Hoje" : h(day.weekday)}</span><span class="visually-hidden">${h(day.weekday)}: ${day.minutes} minutos</span></li>`).join("")}</ol>`, "progress-week")}<section class="progress-reviewSection"><h2>Precisa revisar</h2>${data.needsReview.length ? `<ul class="progress-reviewList">${data.needsReview.map((item) => `<li><strong>${h(item.title)}</strong><span>${h(item.reasonText)}</span><a href="/revisao/${encodeURIComponent(item.id)}">Revisar</a></li>`).join("")}</ul>` : '<p class="muted">Tudo em dia! Novas revisões aparecem conforme você estuda.</p>'}</section>${data.skills.length ? card(`<h2 class="progress-cardTitle">Desempenho por tema</h2><ul class="progress-skillList">${data.skills.map((skill) => `<li><div class="progress-skillHead"><span>${h(skill.label)}</span><strong>${skill.accuracy}%</strong></div>${progress(skill.accuracy / 100, `${skill.label}: ${skill.accuracy}% em ${skill.attempts} exercícios`, skill.accuracy >= 70 ? "success" : skill.accuracy >= 40 ? "learn" : "talk")}</li>`).join("")}</ul>`, "progress-skills") : ""}${data.recurringErrors.length ? card(`<h2>Erros recorrentes</h2><ul class="progress-errorList">${data.recurringErrors.map((error) => `<li><span>${h(error.label)} · ${error.count} ocorrências</span>${error.lessonId ? link("Rever aula", `/aprender/aula/${encodeURIComponent(error.lessonId)}`, "ghost") : ""}</li>`).join("")}</ul>`, "progress-errors") : ""}${data.recentLessons.length ? card(`<h2>Aulas recentes</h2><ul class="progress-recentList">${data.recentLessons.map((item) => `<li>${lessonLink(item)}<span>${item.score}% · ${dateLabel(item.completedAt)}</span></li>`).join("")}</ul>`, "progress-recent") : ""}</div>`,
  );
}
export function init() {
  const routes = {
      home: ["/home", home],
      learn: ["/lessons", learn],
      reviews: ["/reviews", reviews],
      progress: ["/progress", overview],
    },
    [path, view] = routes[context.page];
  load(async () => view(await api(path)));
}
