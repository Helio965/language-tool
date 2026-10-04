import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppShell, type RouteHandle } from '../layouts/AppShell';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { WelcomePage } from '../features/auth/WelcomePage';
import { ChatPage } from '../features/conversation/ChatPage';
import { ConversationHubPage } from '../features/conversation/ConversationHubPage';
import { HomePage } from '../features/home/HomePage';
import { LearnPage } from '../features/learning/LearnPage';
import { LessonPage } from '../features/learning/LessonPage';
import { NotFoundPage } from '../features/legal/NotFoundPage';
import { TermsPage } from '../features/legal/TermsPage';
import { OnboardingPage } from '../features/onboarding/OnboardingPage';
import { PlacementPage } from '../features/placement/PlacementPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { ReviewSessionPage } from '../features/review/ReviewSessionPage';
import { PreferencesPage } from '../features/settings/PreferencesPage';
import { PrivacyPage } from '../features/settings/PrivacyPage';
import { VocabularyPage } from '../features/vocabulary/VocabularyPage';
import { PublicOnly, RequireAuth, RequireStep } from './guards';

const immersive = (mode?: RouteHandle['mode']): RouteHandle => ({ immersive: true, ...(mode ? { mode } : {}) });

/**
 * Mapa de rotas (ver docs/USER-FLOWS.md):
 * públicas → configuração inicial → nivelamento → app (Início, Aprender, Conversar, Progresso, Perfil).
 */
export const routes: RouteObject[] = [
  { path: '/', element: <PublicOnly><WelcomePage /></PublicOnly> },
  { path: '/entrar', element: <PublicOnly><LoginPage /></PublicOnly> },
  { path: '/cadastro', element: <PublicOnly><RegisterPage /></PublicOnly> },
  { path: '/recuperar-senha', element: <PublicOnly><ForgotPasswordPage /></PublicOnly> },
  { path: '/termos-e-privacidade', element: <TermsPage /> },
  {
    path: '/configuracao',
    element: <RequireAuth><RequireStep step="onboarding"><OnboardingPage /></RequireStep></RequireAuth>,
  },
  {
    path: '/nivelamento',
    element: <RequireAuth><RequireStep step="placement"><PlacementPage /></RequireStep></RequireAuth>,
  },
  {
    element: (
      <RequireAuth>
        <RequireStep step="ready">
          <AppShell />
        </RequireStep>
      </RequireAuth>
    ),
    children: [
      { path: '/inicio', element: <HomePage /> },
      { path: '/aprender', element: <LearnPage />, handle: { mode: 'learn' } satisfies RouteHandle },
      { path: '/aprender/aula/:lessonId', element: <LessonPage />, handle: immersive('learn') },
      { path: '/conversar', element: <ConversationHubPage />, handle: { mode: 'talk' } satisfies RouteHandle },
      { path: '/conversar/:conversationId', element: <ChatPage />, handle: immersive('talk') },
      { path: '/vocabulario', element: <VocabularyPage /> },
      { path: '/revisao', element: <ReviewPage /> },
      { path: '/revisao/:reviewId', element: <ReviewSessionPage />, handle: immersive('learn') },
      { path: '/progresso', element: <ProgressPage /> },
      { path: '/perfil', element: <ProfilePage /> },
      { path: '/perfil/editar', element: <OnboardingPage mode="edit" />, handle: immersive() },
      { path: '/perfil/nivelamento', element: <PlacementPage retake />, handle: immersive() },
      { path: '/preferencias', element: <PreferencesPage /> },
      { path: '/privacidade', element: <PrivacyPage /> },
      { path: '/app', element: <Navigate to="/inicio" replace /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
