import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { PasswordHasher } from '@english-ai/core';

const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/**
 * Hash de senha com scrypt (função de derivação resistente a força bruta, nativa do Node).
 * Formato: scrypt$N$r$p$salt$hash (base64). A senha nunca é armazenada nem registrada.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly options: { N: number; r: number; p: number } = { N: 16384, r: 8, p: 1 }) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const { N, r, p } = this.options;
    const key = await scrypt(password, salt, { N, r, p, maxmem: 64 * 1024 * 1024 });
    return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, n, r, p, salt, hash] = stored.split('$');
    if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'base64');
    const key = await scrypt(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return key.length === expected.length && timingSafeEqual(key, expected);
  }
}
