import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../../../core/errors/app-error.js';
import type { EmisorTokens, HasherContrasena } from '../domain/auth.ports.js';

export class BcryptHasher implements HasherContrasena {
  constructor(private readonly costo: number) {}

  generar(contrasena: string): Promise<string> {
    return bcrypt.hash(contrasena, this.costo);
  }

  comparar(contrasena: string, hash: string): Promise<boolean> {
    return bcrypt.compare(contrasena, hash);
  }
}

const ALGORITMO = 'HS256';
const EMISOR = 'shopcart-api';
const AUDIENCIA = 'shopcart-web';

export class JwtEmisorTokens implements EmisorTokens {
  constructor(
    private readonly secreto: string,
    readonly segundosVida: number,
  ) {}

  emitir(idUsuario: number, rol: string): string {
    return jwt.sign({ rol }, this.secreto, {
      algorithm: ALGORITMO,
      subject: String(idUsuario),
      issuer: EMISOR,
      audience: AUDIENCIA,
      expiresIn: this.segundosVida,
    });
  }

  verificar(token: string): number {
    try {
      // El algoritmo se fija aqui: el del encabezado del token nunca se obedece.
      const { sub } = jwt.verify(token, this.secreto, { algorithms: [ALGORITMO], issuer: EMISOR, audience: AUDIENCIA }) as jwt.JwtPayload;
      const idUsuario = Number(sub);
      if (!Number.isInteger(idUsuario) || idUsuario <= 0) throw new jwt.JsonWebTokenError('sub invalido');
      return idUsuario;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) throw AppError.noAutenticado('TOKEN_EXPIRADO', 'La sesion expiro.');
      throw AppError.noAutenticado('TOKEN_INVALIDO', 'Token invalido.');
    }
  }
}
