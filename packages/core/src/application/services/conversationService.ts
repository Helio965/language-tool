/**
 * Modo Conversação — UC09 (Conversar com IA), RF12–RF15, RN04 (correção contextual), RN07 (privacidade).
 */
import { buildCorrection } from '../../ai/grammar/checker';
import type { GrammarIssue } from '../../ai/grammar/types';
import { decideConversationCorrections } from '../../ai/correctionPolicy';
import { policyFor } from '../../ai/levelPolicy';
import { LESSON_PRACTICE_PREFIX } from '../../content/topics';
import type { Conversation, Correction, Message } from '../../domain/entities';
import { AppError } from '../../domain/errors';
import { levelIndex } from '../../domain/levels';
import { privacyNotice, redactSensitiveData } from '../../domain/privacy';
import type { InterestArea } from '../../domain/profile';
import { SKILL_LESSON, type SkillTag } from '../../domain/skills';
import { validateMessage } from '../../domain/validation';
import { addDays } from '../../domain/review';
import { loadLearner, loadProfile, requireUser, type ServiceContext } from '../context';
import type {
  ConversationFeedbackView,
  ConversationSummaryView,
  ConversationView,
  SendMessageResult,
  TopicView,
} from '../views';

const GOAL_AREAS: Record<string, InterestArea[]> = {
  basics: ['everyday'],
  conversation: ['everyday', 'entertainment'],
  work: ['business'],
  travel: ['travel', 'food'],
  technology: ['technology'],
};

const EPHEMERAL_HOURS = 24;
const MAX_RECOMMENDED_TOPICS = 3;

function preview(messages: Message[]): string {
  const last = messages.at(-1);
  if (!last) return '';
  return last.content.length > 80 ? `${last.content.slice(0, 77)}…` : last.content;
}

function summaryView(conversation: Conversation, messages: Message[]): ConversationSummaryView {
  return {
    id: conversation.id,
    topicId: conversation.topicId,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    endedAt: conversation.endedAt,
    messageCount: conversation.userMessageCount,
    preview: preview(messages),
    retention: conversation.retention,
  };
}

export function createConversationService(ctx: ServiceContext) {
  async function requireOwned(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await ctx.store.conversations.get(conversationId);
    // Mesmo erro para "não existe" e "pertence a outra pessoa": não revela a existência do recurso.
    if (!conversation || conversation.userId !== userId) throw new AppError('NOT_FOUND', 'Conversa não encontrada.');
    return conversation;
  }

  function newMessage(conversationId: string, role: Message['role'], content: string, extra: Partial<Message> = {}): Message {
    return {
      id: ctx.id(),
      conversationId,
      role,
      content,
      translation: null,
      corrections: [],
      deferredCorrections: [],
      notices: [],
      createdAt: ctx.now().toISOString(),
      ...extra,
    };
  }

  async function deleteContent(conversation: Conversation): Promise<Conversation> {
    await ctx.store.messages.deleteByConversation(conversation.id);
    const updated: Conversation = {
      ...conversation,
      context: { ...conversation.context, facts: {} },
      contentDeletedAt: ctx.now().toISOString(),
    };
    await ctx.store.conversations.save(updated);
    return updated;
  }

  return {
    /** Assuntos com até 3 recomendações: interesses do perfil pesam mais que o objetivo. */
    async listTopics(userId: string): Promise<TopicView[]> {
      const profile = await loadProfile(ctx, userId);
      const level = profile.estimatedLevel ?? 'beginner';
      const interests = new Set<InterestArea>(profile.interestAreas);
      const goalAreas = new Set<InterestArea>(profile.goal ? (GOAL_AREAS[profile.goal] ?? []) : []);
      const topics = ctx.catalog.topics();
      const score = (areas: readonly InterestArea[]) =>
        areas.reduce((sum, area) => sum + (interests.has(area) ? 2 : 0) + (goalAreas.has(area) ? 1 : 0), 0);
      const recommended = new Set(
        topics
          .filter((topic) => topic.id !== 'free' && score(topic.areas) > 0)
          .sort((a, b) => score(b.areas) - score(a.areas))
          .slice(0, MAX_RECOMMENDED_TOPICS)
          .map((topic) => topic.id),
      );
      return topics
        .map((topic) => ({
          ...topic,
          recommended: recommended.has(topic.id),
          aboveLevel: levelIndex(topic.recommendedFrom) > levelIndex(level),
        }))
        .sort((a, b) => Number(b.recommended) - Number(a.recommended));
    },

    /** Histórico: apenas conversas salvas e com conteúdo disponível. */
    async list(userId: string): Promise<ConversationSummaryView[]> {
      await requireUser(ctx, userId);
      const conversations = (await ctx.store.conversations.listByUser(userId))
        .filter((conversation) => conversation.retention === 'saved' && !conversation.contentDeletedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return Promise.all(
        conversations.map(async (conversation) => summaryView(conversation, await ctx.store.messages.listByConversation(conversation.id))),
      );
    },

    async start(userId: string, topicId: string): Promise<ConversationView> {
      const { learner, preferences, profile } = await loadLearner(ctx, userId);
      const topic = ctx.catalog.topic(topicId);
      if (!topic) throw new AppError('NOT_FOUND', 'Assunto não encontrado.');
      const lesson = topicId.startsWith(LESSON_PRACTICE_PREFIX) ? ctx.catalog.lesson(topicId.slice(LESSON_PRACTICE_PREFIX.length)) : undefined;
      const opening = await ctx.ai.startConversation({ learner, topic, ...(lesson ? { lessonOpener: lesson.practice.opener } : {}) });
      const now = ctx.now();
      const saved = preferences.saveConversationHistory;
      const conversation: Conversation = {
        id: ctx.id(),
        userId,
        topicId,
        title: topic.title,
        levelAtStart: profile.estimatedLevel ?? 'beginner',
        context: opening.context,
        retention: saved ? 'saved' : 'ephemeral',
        expiresAt: addDays(now, saved ? ctx.retentionDays : EPHEMERAL_HOURS / 24).toISOString(),
        userMessageCount: 0,
        correctedSkills: [],
        contentDeletedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        endedAt: null,
      };
      await ctx.store.conversations.save(conversation);
      const first = newMessage(conversation.id, 'assistant', opening.reply, { translation: opening.translation });
      await ctx.store.messages.add(first);
      return { ...summaryView(conversation, [first]), level: conversation.levelAtStart, messages: [first] };
    },

    async get(userId: string, conversationId: string): Promise<ConversationView> {
      const conversation = await requireOwned(userId, conversationId);
      const messages = await ctx.store.messages.listByConversation(conversationId);
      return { ...summaryView(conversation, messages), level: conversation.levelAtStart, messages };
    },

    async send(userId: string, conversationId: string, rawText: string): Promise<SendMessageResult> {
      const conversation = await requireOwned(userId, conversationId);
      if (conversation.endedAt) throw new AppError('CONVERSATION_ENDED', 'Esta conversa já foi encerrada.');
      const validation = validateMessage(String(rawText ?? ''));
      if (validation) throw new AppError('VALIDATION', validation, { text: validation });

      const { learner, preferences } = await loadLearner(ctx, userId);
      const topic = ctx.catalog.topic(conversation.topicId);
      if (!topic) throw new AppError('NOT_FOUND', 'Assunto não encontrado.');

      // Minimização de dados: remove dados pessoais óbvios antes de salvar e de enviar à IA.
      const { text, redactedKinds } = redactSensitiveData(String(rawText).trim());
      const history = (await ctx.store.messages.listByConversation(conversationId))
        .slice(-ctx.maxHistory)
        .map((message) => ({ role: message.role, content: message.content }));

      const turn = await ctx.ai.conversation({ learner, topic, context: conversation.context, history, userMessage: text });
      const decision = decideConversationCorrections({
        issues: turn.issues,
        intensity: preferences.correctionIntensity,
        level: learner.level,
        turnsSinceInlineCorrection: conversation.context.turnsSinceInlineCorrection,
      });
      const includeTip = policyFor(learner.level).includeTipByDefault || preferences.correctionIntensity === 'detailed';
      const toCorrections = (issues: GrammarIssue[]): Correction[] => {
        const correction = buildCorrection(text, issues, learner.explanationLanguage, includeTip);
        return correction ? [correction] : [];
      };

      const notice = privacyNotice(redactedKinds);
      const userMessage = newMessage(conversationId, 'user', text, {
        corrections: toCorrections(decision.inline),
        deferredCorrections: toCorrections(decision.deferred),
        notices: notice ? [notice] : [],
      });
      await ctx.store.messages.add(userMessage);
      const assistantMessage = newMessage(conversationId, 'assistant', turn.reply, { translation: turn.translation });
      await ctx.store.messages.add(assistantMessage);

      const corrected = [...decision.inline, ...decision.deferred].map((issue) => issue.skillTag);
      await ctx.store.conversations.save({
        ...conversation,
        context: {
          ...turn.context,
          turnsSinceInlineCorrection: decision.inline.length ? 0 : conversation.context.turnsSinceInlineCorrection + 1,
        },
        userMessageCount: conversation.userMessageCount + 1,
        correctedSkills: [...conversation.correctedSkills, ...corrected].slice(-50),
        updatedAt: ctx.now().toISOString(),
      });
      return { userMessage, assistantMessage };
    },

    /** Encerra a conversa e devolve o feedback consolidado (correções sem interromper o fluxo). */
    async end(userId: string, conversationId: string): Promise<ConversationFeedbackView> {
      let conversation = await requireOwned(userId, conversationId);
      const messages = await ctx.store.messages.listByConversation(conversationId);
      const userMessages = messages.filter((message) => message.role === 'user');
      const corrections = userMessages.flatMap((message) => [...message.corrections, ...message.deferredCorrections]);
      const now = ctx.now();

      if (!conversation.endedAt) {
        conversation = { ...conversation, endedAt: now.toISOString(), updatedAt: now.toISOString() };
        await ctx.store.conversations.save(conversation);
        // Temas corrigidos com frequência viram itens de revisão (Conversa → Progresso → Revisão).
        const counts = new Map<SkillTag, number>();
        for (const correction of corrections) {
          if (correction.severity !== 'naturalness') counts.set(correction.skillTag, (counts.get(correction.skillTag) ?? 0) + 1);
        }
        const reviews = await ctx.store.reviews.listByUser(userId);
        for (const [skillTag, count] of counts) {
          const pending = reviews.some((review) => review.status === 'pending' && review.kind === 'skill' && review.refId === skillTag);
          if (count >= 2 && !pending) {
            await ctx.store.reviews.save({
              id: ctx.id(),
              userId,
              kind: 'skill',
              refId: skillTag,
              reason: 'conversation',
              status: 'pending',
              dueAt: now.toISOString(),
              intervalStep: 0,
              timesReviewed: 0,
              lastScore: null,
              timeSpentSeconds: 0,
              lastReviewedAt: null,
              createdAt: now.toISOString(),
            });
          }
        }
      }

      const unique = corrections.filter(
        (correction, index) => corrections.findIndex((other) => other.suggestion === correction.suggestion) === index,
      );
      const suggestedLessons = [...new Set(unique.map((correction) => correction.skillTag))]
        .map((skillTag) => {
          const lessonId = SKILL_LESSON[skillTag];
          const lesson = lessonId ? ctx.catalog.lesson(lessonId) : undefined;
          return lesson ? { lessonId: lesson.id, title: lesson.title, skillTag } : null;
        })
        .filter((item) => item !== null)
        .slice(0, 3);

      const first = messages[0]?.createdAt ?? conversation.createdAt;
      const last = messages.at(-1)?.createdAt ?? conversation.updatedAt;
      const durationMinutes = Math.max(1, Math.round((Date.parse(last) - Date.parse(first)) / 60000));

      let contentDeleted = Boolean(conversation.contentDeletedAt);
      if (conversation.retention === 'ephemeral' && !contentDeleted) {
        await deleteContent(conversation);
        contentDeleted = true;
      }

      return {
        conversationId,
        title: conversation.title,
        userMessages: userMessages.length,
        durationMinutes,
        cleanMessages: userMessages.filter((message) => !message.corrections.length && !message.deferredCorrections.length).length,
        corrections: unique.slice(0, 6),
        suggestedLessons,
        contentDeleted,
      };
    },

    async remove(userId: string, conversationId: string): Promise<void> {
      const conversation = await requireOwned(userId, conversationId);
      await deleteContent(conversation);
    },

    /** "Apagar todo o histórico de conversas" (RN07). */
    async removeAll(userId: string): Promise<number> {
      await requireUser(ctx, userId);
      const conversations = (await ctx.store.conversations.listByUser(userId)).filter((conversation) => !conversation.contentDeletedAt);
      for (const conversation of conversations) await deleteContent(conversation);
      return conversations.length;
    },

    /** Política de retenção: apaga o conteúdo de conversas expiradas, mantendo apenas metadados. */
    async purgeExpired(): Promise<number> {
      const expired = await ctx.store.conversations.listExpired(ctx.now().toISOString());
      for (const conversation of expired) await deleteContent(conversation);
      return expired.length;
    },
  };
}

export type ConversationService = ReturnType<typeof createConversationService>;
