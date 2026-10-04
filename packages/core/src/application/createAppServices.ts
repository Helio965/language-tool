import { createContext } from './context';
import type { AppDependencies } from './ports';
import { createAuthService } from './services/authService';
import { createConversationService } from './services/conversationService';
import { createLearningService } from './services/learningService';
import { createPlacementService } from './services/placementService';
import { createProfileService } from './services/profileService';
import { createProgressService } from './services/progressService';
import { createReviewService } from './services/reviewService';
import { createVocabularyService } from './services/vocabularyService';

/** Compõe todos os casos de uso a partir das dependências (injeção manual, sem framework). */
export function createAppServices(deps: AppDependencies) {
  const ctx = createContext(deps);
  const learning = createLearningService(ctx);
  const review = createReviewService(ctx, learning);
  const vocabulary = createVocabularyService(ctx);
  const conversation = createConversationService(ctx);
  return {
    auth: createAuthService(ctx),
    profile: createProfileService(ctx),
    placement: createPlacementService(ctx),
    learning,
    conversation,
    vocabulary,
    review,
    progress: createProgressService(ctx, { learning, review, vocabulary, conversation }),
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
