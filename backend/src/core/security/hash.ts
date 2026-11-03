import { createHash, randomBytes } from 'node:crypto';

export const sha256 = (valor: string): Buffer => createHash('sha256').update(valor).digest();

/** 256 bits aleatorios: no se pueden adivinar y por eso basta un hash rapido para guardarlos. */
export const tokenOpaco = (): string => randomBytes(32).toString('base64url');
