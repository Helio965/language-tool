/**
 * Hash de senha com PBKDF2-SHA256 via Web Crypto (disponível no navegador e no Node).
 * Usado no modo demonstração; a API usa scrypt (apps/api/src/security/passwordHasher.ts).
 */
import type { PasswordHasher } from '../application/ports';

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export class Pbkdf2PasswordHasher implements PasswordHasher {
  constructor(private readonly iterations = 310_000) {}

  async hash(password: string): Promise<string> {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt, this.iterations);
    return `pbkdf2$sha256$${this.iterations}$${toBase64(salt)}$${toBase64(hash)}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, digest, iterations, salt, hash] = stored.split('$');
    if (scheme !== 'pbkdf2' || digest !== 'sha256' || !iterations || !salt || !hash) return false;
    const derived = await derive(password, fromBase64(salt), Number(iterations));
    return constantTimeEqual(derived, fromBase64(hash));
  }
}
