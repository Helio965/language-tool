import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Check,
  Compass,
  Cookie,
  Gauge,
  HeartHandshake,
  History,
  KeyRound,
  Layers,
  Lightbulb,
  MailCheck,
  MessagesSquare,
  Scale,
  ServerCog,
  SlidersHorizontal,
  Sparkles,
  Split,
  Target,
  Trash2,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { buildCorrection, checkGrammar, LESSONS, LEVEL_LABELS, type Correction } from '@english-ai/core';
import { AssistantAvatar } from '../../components/Brand';
import { Button } from '../../components/Button';
import { CorrectionCard } from '../../components/CorrectionCard';
import { ProgressBar, ProgressRing, StatTile } from '../../components/Display';
import { InlineAlert } from '../../components/States';
import { cx } from '../../utils/cx';
import styles from './Landing.module.css';
import {
  AI_CAPABILITIES,
  FACTS,
  LEARN_FEATURES,
  PERSONALIZATION,
  PROBLEMS,
  PROGRESS_METRICS,
  SECURITY_ITEMS,
  STEPS,
  TALK_FEATURES,
} from './landingContent';

export interface DemoAction {
  available: boolean;
  loading: boolean;
  error: string | null;
  start: () => void;
}

const ICONS: Record<string, LucideIcon> = {
  compass: Compass,
  heart: HeartHandshake,
  messages: MessagesSquare,
  lightbulb: Lightbulb,
  layers: Layers,
  sliders: SlidersHorizontal,
  calendar: CalendarCheck,
  user: UserPlus,
  target: Target,
  gauge: Gauge,
  split: Split,
  trending: TrendingUp,
  key: KeyRound,
  cookie: Cookie,
  mail: MailCheck,
  history: History,
  trash: Trash2,
  server: ServerCog,
  scale: Scale,
};

/** Correção gerada pelo verificador gramatical real do projeto (o mesmo do modo demonstração). */
function realCorrection(sentence: string): Correction | null {
  return buildCorrection(sentence, checkGrammar(sentence), 'pt', true);
}

const AGE_EXAMPLE = realCorrection('I have 25 years.');
const LEARN_EXAMPLE = realCorrection('She go to school every day.');
const TALK_EXAMPLE = realCorrection("He don't like coffee.");
const SAMPLE_LESSON = LESSONS.find((lesson) => lesson.id === 'verb-to-be') ?? LESSONS[0];

function SectionHeading({ id, kicker, title, intro }: { id: string; kicker: string; title: ReactNode; intro?: ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionKicker}>{kicker}</span>
      <h2 id={`${id}-title`} tabIndex={-1} className={styles.sectionTitle}>
        {title}
      </h2>
      {intro && <p className={styles.sectionIntro}>{intro}</p>}
    </div>
  );
}

function FeatureList({ items }: { items: ReadonlyArray<{ title: string; text: string }> }) {
  return (
    <ul className={styles.featureList}>
      {items.map((item) => (
        <li key={item.title}>
          <Check aria-hidden="true" />
          <span>
            <strong>{item.title}.</strong> {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DemoButton({ demo, label, variant = 'ghost' }: { demo: DemoAction; label: string; variant?: 'ghost' | 'secondary' }) {
  if (!demo.available) return null;
  return (
    <Button variant={variant} size="lg" onClick={demo.start} loading={demo.loading} loadingLabel="Preparando demonstração…">
      {label}
    </Button>
  );
}

export function HeroSection({ demo }: { demo: DemoAction }) {
  return (
    <section id="inicio" className={styles.hero} aria-labelledby="inicio-title">
      <div className={cx(styles.heroText, 'reveal')}>
        <span className={styles.kicker}>
          <Sparkles aria-hidden="true" /> Inglês com inteligência artificial
        </span>
        <h1 id="inicio-title" tabIndex={-1} className={styles.heroTitle}>
          Aprenda inglês no seu ritmo, com uma IA que <span className="marker">realmente explica</span>.
        </h1>
        <p className={styles.heroLead}>
          A plataforma reúne aulas estruturadas, exercícios, conversação e feedback personalizado em uma experiência adaptada
          ao seu nível — com explicações em português quando você precisa.
        </p>
        <div className={styles.heroActions}>
          <Button to="/cadastro" size="lg" iconEnd={<ArrowRight aria-hidden="true" />}>
            Começar gratuitamente
          </Button>
          <Button to="/entrar" size="lg" variant="secondary">
            Já tenho conta
          </Button>
        </div>
        {demo.available && (
          <div className={styles.heroDemo}>
            <DemoButton demo={demo} label="Explorar demonstração com dados de exemplo" />
            <p className={styles.smallNote}>Modo demonstração: os dados ficam apenas neste navegador e a IA é simulada.</p>
            {demo.error && <InlineAlert>{demo.error}</InlineAlert>}
          </div>
        )}
        <ul className={styles.heroFacts} aria-label="O que já está disponível">
          <li>
            <strong>{FACTS.lessons}</strong> aulas por nível
          </li>
          <li>
            <strong>{FACTS.exercises}</strong> exercícios
          </li>
          <li>
            <strong>{FACTS.topics}</strong> temas de conversa
          </li>
        </ul>
      </div>

      <div className={styles.heroPreview} aria-label="Prévia do aplicativo (exemplo ilustrativo)" role="group">
        {SAMPLE_LESSON && (
          <div className={cx(styles.previewCard, styles.previewLesson)}>
            <span className={styles.previewLabel}>
              <BookOpen aria-hidden="true" /> Aprender · {LEVEL_LABELS[SAMPLE_LESSON.level]}
            </span>
            <strong className={styles.previewTitle}>{SAMPLE_LESSON.title}</strong>
            <ProgressBar value={0.6} label="Progresso da aula (exemplo)" tone="learn" size="sm" />
            <span className={styles.previewHint}>Continuar de onde parei</span>
          </div>
        )}
        <div className={cx(styles.previewCard, styles.previewChat)}>
          <span className={styles.previewLabel}>
            <MessagesSquare aria-hidden="true" /> Conversar
          </span>
          <p className={styles.bubbleUser} lang="en">
            I have 25 years.
          </p>
          <p className={styles.bubbleNote}>
            <span>More natural</span>
            <strong lang="en">
              I&apos;m <mark className="marker">25 years old</mark>.
            </strong>
          </p>
          <div className={styles.bubbleAi}>
            <AssistantAvatar size={28} />
            <span lang="en">Oh, so you&apos;re 25! What do you do?</span>
          </div>
          <span className={styles.previewHint}>{FACTS.assistant}, a assistente de IA, mantém a conversa fluindo.</span>
        </div>
      </div>
    </section>
  );
}

export function ProblemSection() {
  return (
    <section id="problema" className={cx(styles.section, styles.sectionTinted)} aria-labelledby="problema-title">
      <SectionHeading
        id="problema"
        kicker="O desafio"
        title="Estudar inglês sozinho costuma travar nos mesmos pontos"
        intro="Dificuldades comuns de quem aprende por conta própria — e o que o English AI faz em cada caso."
      />
      <ul className={styles.problemGrid}>
        {PROBLEMS.map((problem) => {
          const Icon = ICONS[problem.icon] ?? Compass;
          return (
            <li key={problem.title} className={styles.problemCard}>
              <span className={styles.iconBadge}>
                <Icon aria-hidden="true" />
              </span>
              <h3>{problem.title}</h3>
              <p>{problem.answer}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className={styles.section} aria-labelledby="como-funciona-title">
      <SectionHeading
        id="como-funciona"
        kicker="Como funciona"
        title="Do cadastro à primeira aula em poucos minutos"
        intro="Cinco passos, sempre na mesma ordem. Você pode parar e continuar depois de onde estava."
      />
      <ol className={styles.steps}>
        {STEPS.map((step, index) => {
          const Icon = ICONS[step.icon] ?? Compass;
          return (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={styles.stepIcon}>
                <Icon aria-hidden="true" />
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function LearnSection() {
  return (
    <section id="aprender" className={cx(styles.section, styles.modeSection)} data-mode="learn" aria-labelledby="aprender-title">
      <div className={styles.split}>
        <div>
          <SectionHeading
            id="aprender"
            kicker="Modo Aprender"
            title="Aulas curtas, com explicação, prática e revisão"
            intro="Cada aula segue o mesmo caminho: entender, ver exemplos, praticar e receber a correção explicada."
          />
          <FeatureList items={LEARN_FEATURES} />
          <p className={styles.smallNote}>
            Conteúdo atual: {FACTS.lessonsByLevel.map((item) => `${item.count} ${item.count === 1 ? 'aula' : 'aulas'} ${item.label}`).join(' · ')}
            , {FACTS.words} palavras de vocabulário. A trilha intermediária e avançada está em expansão.
          </p>
        </div>
        <div className={styles.visual} role="group" aria-label="Exemplo de exercício corrigido">
          <div className={styles.exercise}>
            <span className={styles.previewLabel}>Exercício · escrita livre</span>
            <p className={styles.exercisePrompt}>Escreva uma frase sobre a rotina de alguém.</p>
            <p className={styles.exerciseAnswer} lang="en">
              She go to school every day.
            </p>
          </div>
          {LEARN_EXAMPLE && <CorrectionCard correction={LEARN_EXAMPLE} />}
        </div>
      </div>
    </section>
  );
}

export function TalkSection() {
  return (
    <section id="conversar" className={cx(styles.section, styles.modeSection)} data-mode="talk" aria-labelledby="conversar-title">
      <div className={cx(styles.split, styles.splitReverse)}>
        <div>
          <SectionHeading
            id="conversar"
            kicker="Modo Conversação"
            title="Pratique conversando, sem medo de errar"
            intro="Escolha um tema e converse por escrita com a IA. Ela adapta o vocabulário ao seu nível e explica as correções."
          />
          <div className={styles.principle}>
            <strong>Naturalidade &gt; correção excessiva</strong>
            <p>
              A conversa continua fluindo. A IA corrige o que atrapalha o entendimento ou se repete, e deixa os detalhes para
              o resumo no final.
            </p>
          </div>
          <FeatureList items={TALK_FEATURES} />
        </div>
        <div className={cx(styles.visual, styles.chat)} role="group" aria-label="Exemplo de conversa com correção">
          <div className={styles.bubbleAi}>
            <AssistantAvatar size={28} />
            <span lang="en">What does your brother like to drink?</span>
          </div>
          <p className={styles.bubbleUser} lang="en">
            He don&apos;t like coffee. He prefers tea.
          </p>
          {TALK_EXAMPLE && <CorrectionCard correction={TALK_EXAMPLE} variant="chat" />}
          <div className={styles.bubbleAi}>
            <AssistantAvatar size={28} />
            <span lang="en">Tea is a great choice! Does he drink it every day?</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AiSection() {
  return (
    <section id="ia" className={cx(styles.section, styles.sectionTinted)} aria-labelledby="ia-title">
      <SectionHeading
        id="ia"
        kicker="Inteligência artificial"
        title="Mais que um chatbot: uma IA que ensina"
        intro="A IA trabalha a serviço da aula: explica, adapta, corrige e acompanha — sempre deixando claro que é uma IA."
      />
      <div className={styles.split}>
        <ul className={styles.capabilities}>
          {AI_CAPABILITIES.map((item) => (
            <li key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
        <div className={styles.visual} role="group" aria-label="Exemplo de correção explicada">
          {AGE_EXAMPLE && <CorrectionCard correction={AGE_EXAMPLE} />}
          <p className={styles.honesty}>
            A IA pode errar e as correções são sugestões. No modo demonstração, as respostas seguem roteiros e{' '}
            {FACTS.grammarRules} regras de erros comuns; com um provedor de IA configurado, a conversa fica livre.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ProgressSection() {
  return (
    <section id="progresso" className={styles.section} aria-labelledby="progresso-title">
      <div className={cx(styles.split, styles.splitReverse)}>
        <div>
          <SectionHeading
            id="progresso"
            kicker="Progresso"
            title="Veja sua evolução com clareza"
            intro="A tela de Progresso reúne o que você estudou, o que acertou e o que vale revisar."
          />
          <ul className={styles.metricList}>
            {PROGRESS_METRICS.map((metric) => (
              <li key={metric}>
                <Check aria-hidden="true" /> {metric}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.visual} role="group" aria-label="Exemplo ilustrativo da tela de Progresso">
          <div className={styles.progressPreview}>
            <span className={styles.exampleTag}>Exemplo ilustrativo</span>
            <div className={styles.progressTop}>
              <ProgressRing value={0.7} label="Meta de hoje: 7 de 10 minutos (exemplo)" size={84}>
                7/10
              </ProgressRing>
              <div className={styles.progressLevel}>
                <span className={styles.previewLabel}>Nível estimado · Básico</span>
                <ProgressBar value={0.4} label="Avanço no nível (exemplo)" tone="learn" showValue />
              </div>
            </div>
            <div className={styles.statGrid}>
              <StatTile label="Aulas concluídas" value="4" />
              <StatTile label="Taxa de acerto" value="82%" />
              <StatTile label="Palavras estudadas" value="23" />
              <StatTile label="Sequência" value="3 dias" />
            </div>
          </div>
          <p className={styles.smallNote}>Os números da sua conta aparecem depois que você começa a estudar.</p>
        </div>
      </div>
    </section>
  );
}

export function PersonalizationSection() {
  return (
    <section id="personalizacao" className={cx(styles.section, styles.sectionTinted)} aria-labelledby="personalizacao-title">
      <SectionHeading
        id="personalizacao"
        kicker="Personalização"
        title="Uma experiência que considera você"
        intro="Sem mágica: regras claras do sistema, combinadas com as preferências que você escolhe."
      />
      <ul className={styles.personalGrid}>
        {PERSONALIZATION.map((item) => (
          <li key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SecuritySection() {
  return (
    <section id="seguranca" className={styles.section} aria-labelledby="seguranca-title">
      <SectionHeading
        id="seguranca"
        kicker="Privacidade e segurança"
        title="Seus dados protegidos e sob o seu controle"
        intro="Segurança pensada desde o início, com a coleta mínima necessária para o aprendizado."
      />
      <ul className={styles.securityGrid}>
        {SECURITY_ITEMS.map((item) => {
          const Icon = ICONS[item.icon] ?? KeyRound;
          return (
            <li key={item.title}>
              <span className={styles.iconBadge}>
                <Icon aria-hidden="true" />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className={styles.smallNote}>
        Projeto acadêmico: o texto de privacidade é informativo e não substitui uma revisão jurídica.{' '}
        <Link to="/termos-e-privacidade">Ler termos e privacidade</Link>.
      </p>
    </section>
  );
}

export function FinalCta({ demo }: { demo: DemoAction }) {
  return (
    <section className={styles.cta} aria-labelledby="cta-title">
      <h2 id="cta-title" className={styles.ctaTitle}>
        Seu próximo passo no inglês <span className="marker">pode começar agora</span>.
      </h2>
      <p>Crie sua conta, faça o nivelamento e comece pela primeira aula ou por uma conversa.</p>
      <div className={styles.ctaActions}>
        <Button to="/cadastro" size="lg" className={styles.ctaPrimary} iconEnd={<ArrowRight aria-hidden="true" />}>
          Criar conta
        </Button>
        <Button to="/entrar" size="lg" variant="secondary">
          Entrar
        </Button>
        <DemoButton demo={demo} label="Testar a demonstração" variant="secondary" />
      </div>
    </section>
  );
}
