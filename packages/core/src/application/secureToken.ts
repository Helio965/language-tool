/**
 * Tokens de uso único (redefinição de senha) com Web Crypto — disponível no navegador e no Node,
 * então o mesmo código serve à API e ao modo demonstração.
 */

const TOKEN_BYTES = 32;
/** 32 bytes em base64url sem preenchimento = 43 caracteres. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Token aleatório de 256 bits (gerador criptográfico), seguro para ir em um link. */
export function generateSecureToken(): string {
  return toBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

/** Formato esperado de um token; qualquer outra coisa é inválida sem consultar o banco. */
export function isWellFormedToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** SHA-256 em hexadecimal. É o que fica guardado: o token em si só existe no e-mail enviado. */
export async function hashToken(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
