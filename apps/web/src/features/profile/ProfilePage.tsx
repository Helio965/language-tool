import { BarChart3, ChevronRight, GraduationCap, Library, LogOut, PencilLine, RefreshCcw, Settings, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  GOAL_LABELS,
  INTEREST_AREA_LABELS,
  PERCEIVED_LEVEL_LABELS,
  PRIOR_EXPERIENCE_LABELS,
} from '@english-ai/core';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Controls';
import { Card, LevelBadge, PageHeader } from '../../components/Display';
import { ActionError } from '../../app/QueryErrorState';
import { useAccount, useSession } from '../../app/session';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from './ProfilePage.module.css';

/** Perfil: dados de aprendizagem (UC03), acesso ao progresso (UC05 da Análise), preferências e privacidade. */
export function ProfilePage() {
  useDocumentTitle('Perfil');
  const account = useAccount();
  const { logout, api } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<unknown>(null);
  const { user, profile } = account;
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  /** Logout intencional: as guardas levam ao login quando a sessão termina. */
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await logout();
    } catch (error) {
      // O servidor não confirmou a saída: a pessoa continua conectada e pode tentar de novo.
      setSignOutError(error);
      setSigningOut(false);
    }
  }

  return (
    <div className="reveal">
      <PageHeader title="Perfil" />
      <div className={styles.grid}>
        <Card className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {initials}
          </span>
          <div>
            <h2 className={styles.name}>{user.name}</h2>
            <p className="muted">{user.email}</p>
            <div className={styles.badges}>
              <LevelBadge level={profile.estimatedLevel} />
            </div>
          </div>
        </Card>

        <Card aria-labelledby="learning-title">
          <div className={styles.cardHead}>
            <h2 id="learning-title" className={styles.cardTitle}>
              Seu aprendizado
            </h2>
            <Button to="/perfil/editar" variant="ghost" size="sm" icon={<PencilLine aria-hidden="true" />}>
              Editar
            </Button>
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Objetivo</dt>
              <dd>{profile.goal ? GOAL_LABELS[profile.goal] : '—'}</dd>
            </div>
            <div>
              <dt>Como você se descreveu</dt>
              <dd>{PERCEIVED_LEVEL_LABELS[profile.perceivedLevel]}</dd>
            </div>
            <div>
              <dt>Experiência anterior</dt>
              <dd>{profile.priorExperience ? PRIOR_EXPERIENCE_LABELS[profile.priorExperience] : '—'}</dd>
            </div>
            <div>
              <dt>Interesses</dt>
              <dd className={styles.chips}>
                {profile.conversationInterest && <Chip tone="talk">Conversação</Chip>}
                {profile.professionalInterest && <Chip tone="learn">Uso profissional</Chip>}
                {profile.interestAreas.map((area) => (
                  <Chip key={area}>{INTEREST_AREA_LABELS[area]}</Chip>
                ))}
                {!profile.conversationInterest && !profile.professionalInterest && profile.interestAreas.length === 0 && '—'}
              </dd>
            </div>
            <div>
              <dt>Nivelamento</dt>
              <dd>
                {profile.placementScore !== null ? `${profile.placementScore}% de acertos` : 'Começou do zero'}
                {' · '}
                <Link to="/perfil/nivelamento">Refazer</Link>
              </dd>
            </div>
          </dl>
        </Card>

        <nav aria-label="Atalhos do perfil" className={styles.links}>
          <ProfileLink to="/progresso" icon={<BarChart3 />} title="Seu progresso" text="Indicadores e evolução estimada" />
          <ProfileLink to="/vocabulario" icon={<Library />} title="Vocabulário" text="Palavras estudadas" />
          <ProfileLink to="/revisao" icon={<RefreshCcw />} title="Revisão" text="O que vale reforçar" />
          <ProfileLink to="/preferencias" icon={<Settings />} title="Preferências" text="Explicações, correções, conversa e metas" />
          <ProfileLink to="/privacidade" icon={<ShieldCheck />} title="Privacidade e dados" text="Histórico, dados coletados e exclusão" />
          <ProfileLink to="/perfil/nivelamento" icon={<GraduationCap />} title="Refazer nivelamento" text="Atualizar o nível estimado" />
        </nav>

        <div className={styles.footer}>
          <ActionError error={signOutError} />
          <Button variant="secondary" icon={<LogOut aria-hidden="true" />} onClick={signOut} loading={signingOut} loadingLabel="Saindo…">
            Sair da conta
          </Button>
          <p className={styles.about}>
            English AI · Projeto acadêmico — MVP em desenvolvimento ·{' '}
            {api.mode === 'demo' ? 'Modo demonstração (dados apenas neste navegador)' : `IA: ${account.aiProvider === 'mock' ? 'modo demonstração' : account.aiProvider}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfileLink({ to, icon, title, text }: { to: string; icon: ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className={styles.link}>
      <span className={styles.linkIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.linkText}>
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <ChevronRight aria-hidden="true" className={styles.chevron} />
    </Link>
  );
}
