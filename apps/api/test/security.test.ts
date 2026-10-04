import { describe, expect, it } from 'vitest';
import { createStaticCatalog } from '@english-ai/core';
import { createAIService } from '../src/ai/createAIService';
import { loadConfig } from '../src/config/env';
import { createLogger, redact } from '../src/logger';
import { ScryptPasswordHasher } from '../src/security/passwordHasher';
import { SessionTokens } from '../src/security/sessionTokens';

describe('segurança', () => {
  it('gera hash scrypt com salt aleatório e verifica corretamente', async () => {
    const hasher = new ScryptPasswordHasher();
    const first = await hasher.hash('segura123');
    const second = await hasher.hash('segura123');
    expect(first).not.toBe(second);
    expect(first.startsWith('scrypt$')).toBe(true);
    expect(await hasher.verify('segura123', first)).toBe(true);
    expect(await hasher.verify('errada123', first)).toBe(false);
    expect(await hasher.verify('segura123', 'formato-invalido')).toBe(false);
  });

  it('emite e valida tokens de sessão, recusando tokens adulterados ou de outro segredo', () => {
    const tokens = new SessionTokens('a'.repeat(48), 1);
    const token = tokens.issue('user-1');
    expect(tokens.verify(token)).toBe('user-1');
    expect(tokens.verify(`${token}x`)).toBeNull();
    expect(new SessionTokens('b'.repeat(48), 1).verify(token)).toBeNull();
  });

  it('exige segredo de sessão em produção e gera um temporário em desenvolvimento', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/AUTH_TOKEN_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', AUTH_TOKEN_SECRET: 'curto' })).toThrow(/32/);
    const dev = loadConfig({ NODE_ENV: 'development' });
    expect(dev.AUTH_TOKEN_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(dev.warnings[0]).toContain('temporário');
  });

  it('usa o modo demonstração quando não há chave de IA', () => {
    const config = loadConfig({ NODE_ENV: 'test', AI_PROVIDER: 'anthropic' });
    expect(config.warnings.some((warning) => warning.includes('modo demonstração'))).toBe(true);
    const ai = createAIService(config, createStaticCatalog(), createLogger({ silent: true }));
    expect(ai.providerName).toBe('mock');
  });

  it('usa o provedor real com fallback quando a chave está configurada', () => {
    const config = loadConfig({ NODE_ENV: 'test', AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key' });
    const ai = createAIService(config, createStaticCatalog(), createLogger({ silent: true }));
    expect(ai.providerName).toBe('anthropic');
  });

  it('remove campos sensíveis dos logs', () => {
    expect(redact({ email: 'a@b.com', password: 'x', nested: { token: 't', route: '/api' } })).toEqual({
      email: '[redacted]',
      password: '[redacted]',
      nested: { token: '[redacted]', route: '/api' },
    });
  });
});
