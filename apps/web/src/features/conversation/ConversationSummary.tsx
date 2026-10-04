import { ArrowRight, BarChart3, BookOpen, MessagesSquare, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ConversationFeedbackView } from '@english-ai/core';
import { Button } from '../../components/Button';
import { CorrectionCard } from '../../components/CorrectionCard';
import { Card, StatTile } from '../../components/Display';
import { InlineAlert } from '../../components/States';
import styles from './ConversationSummary.module.css';

/** Feedback ao encerrar: as correções aparecem aqui, sem ter interrompido a conversa. */
export function ConversationSummary({ summary }: { summary: ConversationFeedbackView }) {
  const clean = summary.cleanMessages;
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className={`${styles.wrap} reveal`}>
      <header className={styles.head}>
        <span className="caption">Feedback da conversa</span>
        <h1 ref={titleRef} data-page-title tabIndex={-1}>
          {summary.corrections.length === 0 ? 'Conversa impecável!' : 'Boa conversa! Veja o que praticar'}
        </h1>
      </header>

      <div className={styles.stats}>
        <StatTile icon={<MessagesSquare />} label="Suas mensagens" value={summary.userMessages} />
        <StatTile icon={<Sparkles />} label="Sem nenhum ajuste" value={clean} hint={summary.userMessages ? `${Math.round((clean / summary.userMessages) * 100)}% das mensagens` : undefined} />
        <StatTile icon={<BarChart3 />} label="Duração" value={`${summary.durationMinutes} min`} />
      </div>

      {summary.contentDeleted && (
        <InlineAlert tone="info">
          <ShieldCheck aria-hidden="true" className={styles.inlineIcon} /> O conteúdo desta conversa foi apagado, conforme sua preferência de histórico.
          Mantivemos apenas os números acima para o seu progresso.
        </InlineAlert>
      )}

      <section aria-labelledby="practice-title" className={styles.section}>
        <h2 id="practice-title">Pontos para praticar</h2>
        {summary.corrections.length === 0 ? (
          <Card tone="flat">
            <p>Nenhuma correção nesta conversa. Continue assim — que tal um assunto um pouco mais desafiador?</p>
          </Card>
        ) : (
          <ul className={styles.list}>
            {summary.corrections.map((correction) => (
              <li key={`${correction.ruleId}-${correction.original}`}>
                <CorrectionCard correction={correction} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.suggestedLessons.length > 0 && (
        <section aria-labelledby="lessons-title" className={styles.section}>
          <h2 id="lessons-title">Aulas que ajudam</h2>
          <ul className={styles.lessons}>
            {summary.suggestedLessons.map((lesson) => (
              <li key={lesson.lessonId}>
                <Button to={`/aprender/aula/${lesson.lessonId}`} variant="secondary" icon={<BookOpen aria-hidden="true" />} iconEnd={<ArrowRight aria-hidden="true" />}>
                  {lesson.title}
                </Button>
              </li>
            ))}
          </ul>
          <p className="muted">Temas que apareceram mais de uma vez também entram na sua revisão.</p>
        </section>
      )}

      <div className={styles.actions}>
        <Button to="/conversar" variant="accent" size="lg" icon={<MessagesSquare aria-hidden="true" />}>
          Nova conversa
        </Button>
        <Button to="/progresso" variant="secondary" size="lg" iconEnd={<ArrowRight aria-hidden="true" />}>
          Ver meu progresso
        </Button>
      </div>
    </div>
  );
}
