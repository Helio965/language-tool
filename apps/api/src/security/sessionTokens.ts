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

  issue(userId: string): string {
    return jwt.sign({}, this.secret, { algorithm: 'HS256', subject: userId, expiresIn: `${this.ttlHours}h`, audience: 'english-ai' });
  }

  /** Retorna o id do usuário ou null se o token for inválido/expirado. */
  verify(token: string): string | null {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'], audience: 'english-ai' });
      return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
