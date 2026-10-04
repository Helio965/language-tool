import jwt from 'jsonwebtoken';

/** Token de sessão assinado (HS256). Fica apenas em cookie httpOnly — nunca no JavaScript do navegador. */
export class SessionTokens {
  constructor(
    private readonly secret: string,
    private readonly ttlHours: number,
  ) {}

  get maxAgeMs(): number {
    return this.ttlHours * 60 * 60 * 1000;
  }

  /**
   * `sessionVersion` acompanha users.session_version: quando a senha é redefinida, a versão sobe
   * e tokens emitidos antes deixam de ser aceitos (ver middleware authenticate).
   */
  issue(userId: string, sessionVersion = 0): string {
    return jwt.sign({ sv: sessionVersion }, this.secret, {
      algorithm: 'HS256',
      subject: userId,
      expiresIn: `${this.ttlHours}h`,
      audience: 'english-ai',
    });
  }

  /** Retorna o id do usuário ou null se o token for inválido/expirado. */
  verify(token: string): string | null {
    return this.read(token)?.userId ?? null;
  }

  /** Conteúdo do token válido: conta e versão da sessão (tokens antigos, sem versão, contam como 0). */
  read(token: string): { userId: string; sessionVersion: number } | null {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'], audience: 'english-ai' });
      if (typeof payload !== 'object' || typeof payload.sub !== 'string') return null;
      const version = (payload as { sv?: unknown }).sv;
      return { userId: payload.sub, sessionVersion: typeof version === 'number' && Number.isInteger(version) ? version : 0 };
    } catch {
      return null;
    }
  }
}
