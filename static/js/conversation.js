import {
  $,
  $$,
  api,
  context,
  h,
  load,
  render,
  card,
  link,
  button,
  action,
  showError,
  busy,
  correction,
  avatar,
  dialog,
  stat,
  empty,
  dateLabel,
} from "./common.js";
const aiMode = context.account.ai?.mode;
const simulated =
  aiMode === "demo" || ["mock", "demo"].includes(context.account.aiProvider);
const notice =
  aiMode === "unconfigured"
    ? '<p class="states-inline states-inline_info disabled-notice">A IA externa ainda não está configurada. As respostas da conversação ficam disponíveis após configurar o provedor.</p>'
    : simulated
      ? '<p class="states-inline states-inline_info disabled-notice">Modo demonstração de IA: as respostas são simuladas e seguem roteiros. Não são geradas por uma IA real.</p>'
      : "";

async function hub() {
  const [topics, conversations] = await Promise.all([
    api("/conversation-topics"),
    api("/conversations"),
  ]);
  let pending = false;
  render(
    `${notice}<div class="hub-settingsRow"><a class="hub-setting" href="/preferencias">Correções: <strong>${{ light: "Leve", balanced: "Equilibrada", detailed: "Detalhada" }[context.account.preferences.correctionIntensity]}</strong></a><a class="hub-setting" href="/preferencias">Histórico: <strong>${context.account.preferences.saveConversationHistory ? "salvo" : "não salvo"}</strong></a></div><div id="conversation-error" hidden></div><section class="hub-section"><h2>Sobre o que vamos conversar?</h2><ul class="hub-topics">${topics.map((topic) => `<li><button type="button" class="hub-topic" data-topic="${h(topic.id)}" id="topic-${h(topic.id)}"><span class="hub-topicIcon">${avatar()}</span><span class="hub-topicText"><span class="hub-topicTitle">${h(topic.title)}${topic.recommended ? '<span class="choice-chip choice-chip_marker">Para você</span>' : ""}</span><span class="hub-topicEn" lang="en">${h(topic.titleEn)}</span><span class="hub-topicDescription">${h(topic.description)}</span>${topic.aboveLevel ? '<span class="hub-topicNote">Um pouco acima do seu nível — ótimo para se desafiar.</span>' : ""}</span><span aria-hidden="true">→</span></button></li>`).join("")}</ul></section><section class="hub-section"><h2>Conversas recentes</h2>${!context.account.preferences.saveConversationHistory ? '<p class="states-inline states-inline_info">O histórico está desativado: o conteúdo das conversas é apagado ao encerrar.</p>' : ""}${conversations.length ? `<ul class="hub-history">${conversations.map((item) => `<li><a class="hub-historyItem" href="/conversar/${encodeURIComponent(item.id)}">${avatar()}<span class="hub-historyText"><strong>${h(item.title)}</strong><span lang="en">${h(item.preview)}</span></span><span class="hub-historyMeta">${dateLabel(item.updatedAt)}<span class="choice-chip">${item.endedAt ? "Encerrada" : "Em andamento"}</span></span></a></li>`).join("")}</ul>` : empty("Nenhuma conversa ainda", "Suas conversas salvas aparecerão aqui para você revisar quando quiser.", "", "")}</section>`,
  );
  $$("[data-topic]").forEach((item) =>
    item.addEventListener("click", async () => {
      if (pending) return;
      pending = true;
      $$("[data-topic]")
        .filter((node) => node !== item)
        .forEach((node) => (node.disabled = true));
      await action(
        item,
        async () => {
          const conversation = await api("/conversations", "POST", {
            topicId: item.dataset.topic,
          });
          location.assign(`/conversar/${encodeURIComponent(conversation.id)}`);
        },
        "#conversation-error",
        "Lumi está preparando a conversa…",
      );
      pending = false;
      $$("[data-topic]").forEach((node) => (node.disabled = false));
    }),
  );
}
function message(item) {
  if (item.role === "assistant") {
    const origin =
      {
        demo: "Resposta simulada · roteiro da demonstração",
        authored: "Abertura pedagógica revisada",
        live: "Resposta gerada por IA externa",
      }[item.ai?.mode] || "Origem desta resposta não registrada";
    return `<div class="chat-row">${avatar()}<div class="chat-aiColumn"><p class="chat-notice">${h(origin)}</p><div class="chat-bubble chat-aiBubble"><span class="visually-hidden">Lumi disse: </span><span lang="en">${h(item.content)}</span></div>${item.translation ? `<details><summary class="chat-translate">Ver tradução</summary><p class="chat-translation">${h(item.translation)}</p></details>` : ""}</div></div>`;
  }
  return `<div class="chat-row chat-userRow"><div class="chat-userColumn"><div class="chat-bubble chat-userBubble" lang="en"><span class="visually-hidden">Você disse: </span>${h(item.content)}</div>${(item.notices || []).map((notice) => `<p class="chat-notice">${h(notice)}</p>`).join("")}${(item.corrections || []).map((item) => correction(item, true)).join("")}</div></div>`;
}
function summary(data) {
  const available = data.feedbackAvailable !== false;
  $("#conversation-end").hidden = true;
  render(
    `<div class="summary-wrap"><header class="summary-head"><span class="caption">Resumo da conversa</span><h1 data-page-title tabindex="-1">${!available ? "Conversa encerrada" : data.corrections.length ? "Boa conversa! Veja o que praticar" : "Boa conversa! Continue praticando"}</h1></header><div class="summary-stats">${stat("Suas mensagens", data.userMessages)}${stat(available ? "Sem ajustes identificados" : "Avaliação das mensagens", available ? (data.cleanMessages ?? "—") : "—")}${stat("Duração", `${data.durationMinutes} min`)}</div>${data.contentDeleted ? '<p class="states-inline states-inline_info">O conteúdo desta conversa foi apagado. Mantivemos apenas números para o progresso.</p>' : ""}<section class="summary-section"><h2>${available ? "Pontos para praticar" : "Feedback indisponível"}</h2>${!available ? card("<p>As mensagens e suas correções foram apagadas. Não é possível avaliar o conteúdo desta conversa.</p>") : data.corrections.length ? `<ul class="summary-list">${data.corrections.map((item) => `<li>${correction(item)}</li>`).join("")}</ul>` : card("<p>Não identificamos correções nesta conversa. Continue praticando!</p>")}</section>${available && data.suggestedLessons.length ? `<section class="summary-section"><h2>Aulas que ajudam</h2><div class="stack">${data.suggestedLessons.map((item) => link(item.title, `/aprender/aula/${encodeURIComponent(item.lessonId)}`, "secondary")).join("")}</div></section>` : ""}<div class="summary-actions">${link("Nova conversa", "/conversar", "accent")}${link("Ver meu progresso", "/progresso", "secondary")}</div></div>`,
  );
}
async function chat() {
  const id = encodeURIComponent(context.resourceId),
    data = await api(`/conversations/${id}`);
  let messages = data.messages,
    pending = false,
    retry = null;
  $("#chat-title").textContent = `Lumi · ${data.title}`;
  const end = $("#conversation-end");
  end.hidden = !data.endedAt && !data.messageCount;
  end.textContent = data.endedAt
    ? data.contentDeleted
      ? "Ver resumo"
      : "Ver feedback"
    : "Encerrar";
  render(
    `<div class="chat-layout"><section class="chat-chat" aria-label="Conversa"><h1 class="visually-hidden" data-page-title tabindex="-1">Conversa sobre ${h(data.title)}</h1>${notice}<p class="chat-intro"><span class="display-modeBadge display-mode_talk">Modo Conversação</span> Escreva em inglês. Errou? Tudo bem — é assim que se aprende.</p><div id="chat-log" class="chat-messages" role="log" aria-live="polite" aria-relevant="additions">${messages.map(message).join("")}</div><div id="chat-error" hidden></div>${data.endedAt ? card(`<p>${data.contentDeleted ? "O conteúdo desta conversa foi apagado. Abra o resumo para ver os números registrados." : "Esta conversa foi encerrada. Veja o feedback ou comece uma nova."}</p>${link("Nova conversa", "/conversar", "accent")}`, "display-card_talk") : `<form id="chat-form" class="chat-composer"><label for="chat-input" class="visually-hidden">Sua mensagem em inglês</label><textarea id="chat-input" class="chat-input" name="text" lang="en" rows="1" maxlength="600" placeholder="Escreva em inglês…"></textarea><button type="submit" class="chat-send" id="chat-send" aria-label="Enviar mensagem" disabled>↑</button></form>`}<p class="chat-privacy">Lumi é uma IA e pode errar. Não compartilhe documentos, telefone ou senhas — removemos os dados pessoais mais óbvios.</p></section><aside class="chat-panel" aria-label="Feedback da conversa">${card(`<h2 class="chat-panelTitle">Feedback da conversa</h2><dl class="chat-panelStats"><div><dt>Suas mensagens</dt><dd id="chat-message-count">${messages.filter((item) => item.role === "user").length}</dd></div><div><dt>Correções mostradas</dt><dd id="chat-correction-count">${messages.reduce((sum, item) => sum + (item.corrections || []).length, 0)}</dd></div><div><dt>Guardadas para o final</dt><dd id="chat-deferred-count">${messages.reduce((sum, item) => sum + (item.deferredCorrections || []).length, 0)}</dd></div></dl><p class="chat-panelText">Modo de correção: ${{ light: "Leve", balanced: "Equilibrada", detailed: "Detalhada" }[context.account.preferences.correctionIntensity]}.</p><p class="chat-panelText">Naturalidade acima da correção excessiva. Alguns pontos aparecem no resumo final.</p>`)}</aside></div>`,
  );
  const form = $("#chat-form"),
    input = $("#chat-input"),
    send = $("#chat-send");
  input?.addEventListener(
    "input",
    () => (send.disabled = pending || !input.value.trim()),
  );
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || pending) return;
    // Keep the same request identity if its response was lost. A successful send
    // clears it, so intentionally sending the same text again remains possible.
    if (!retry || retry.text !== text)
      retry = { text, key: crypto.randomUUID() };
    pending = true;
    input.value = "";
    input.disabled = true;
    send.disabled = true;
    $("#chat-error").hidden = true;
    const pendingNode = document.createElement("div");
    pendingNode.id = "chat-pending";
    pendingNode.innerHTML = `<div class="chat-row chat-userRow"><div class="chat-bubble chat-userBubble chat-sending" lang="en">${h(text)}</div></div><div class="chat-row">${avatar()}<div class="chat-bubble chat-aiBubble" role="status">Lumi está preparando uma resposta…</div></div>`;
    $("#chat-log").append(pendingNode);
    pendingNode.scrollIntoView({ block: "end" });
    try {
      const result = await api(
        `/conversations/${id}/messages`,
        "POST",
        { text },
        { key: retry.key },
      );
      retry = null;
      messages.push(result.userMessage, result.assistantMessage);
      pendingNode.remove();
      $("#chat-log").insertAdjacentHTML(
        "beforeend",
        message(result.userMessage) + message(result.assistantMessage),
      );
      end.hidden = false;
      $("#chat-message-count").textContent = messages.filter(
        (item) => item.role === "user",
      ).length;
      $("#chat-correction-count").textContent = messages.reduce(
        (sum, item) => sum + (item.corrections || []).length,
        0,
      );
      $("#chat-deferred-count").textContent = messages.reduce(
        (sum, item) => sum + (item.deferredCorrections || []).length,
        0,
      );
    } catch (error) {
      pendingNode.remove();
      input.value = text;
      showError(error, "#chat-error");
    } finally {
      pending = false;
      input.disabled = false;
      send.disabled = !input.value.trim();
      input.focus();
    }
  });
  async function endConversation(item) {
    await action(
      item,
      async () => {
        const result = await api(`/conversations/${id}/end`, "POST");
        $("#ui-dialog").close();
        summary(result);
      },
      "#chat-end-error",
      "Preparando feedback…",
    );
  }
  end.addEventListener("click", () => {
    if (data.endedAt) {
      load(async () => summary(await api(`/conversations/${id}/end`, "POST")));
      return;
    }
    dialog(
      "Encerrar a conversa?",
      `<p>Vamos reunir as correções e os pontos para praticar.</p>${!context.account.preferences.saveConversationHistory ? "<p>Como o histórico está desativado, o conteúdo será apagado ao encerrar.</p>" : ""}<div id="chat-end-error" hidden></div>`,
      [
        ["Continuar conversando", (_button, modal) => modal.close()],
        ["Encerrar e ver feedback", endConversation, "accent"],
      ],
    );
  });
  input?.focus();
}
export function init() {
  load(context.page === "chat" ? chat : hub);
}
