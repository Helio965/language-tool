import {
  createAppServices,
  createDocumentStore,
  createStaticCatalog,
  MemoryStorage,
  MockAIService,
  Pbkdf2PasswordHasher,
  type AIService,
  type AppServices,
} from '../src';

export interface TestApp {
  services: AppServices;
  clock: { now: Date; advanceDays(days: number): void; advanceMinutes(minutes: number): void };
}

export function createTestApp(options: { ai?: AIService } = {}): TestApp {
  const catalog = createStaticCatalog();
  const clock = {
    now: new Date('2026-03-02T12:00:00.000Z'),
    advanceDays(days: number) {
      this.now = new Date(this.now.getTime() + days * 86_400_000);
    },
    advanceMinutes(minutes: number) {
      this.now = new Date(this.now.getTime() + minutes * 60_000);
    },
  };
  let counter = 0;
  const services = createAppServices({
    store: createDocumentStore(new MemoryStorage()),
    catalog,
    ai: options.ai ?? new MockAIService(catalog),
    passwordHasher: new Pbkdf2PasswordHasher(1_000),
    now: () => clock.now,
    generateId: () => `id-${++counter}`,
  });
  return { services, clock };
}

export const VALID_REGISTRATION = {
  name: 'Alex Souza',
  email: 'alex@example.com',
  password: 'segura123',
  passwordConfirmation: 'segura123',
  acceptedTerms: true,
};
