import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
}

/**
 * Sign a short-lived JWT Access Token
 */
export const signAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as unknown as SignOptions['expiresIn'],
    issuer: 'smartfin-ai',
    audience: 'smartfin-api',
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

/**
 * Sign a long-lived JWT Refresh Token bound to a session
 */
export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as unknown as SignOptions['expiresIn'],
    issuer: 'smartfin-ai',
    audience: 'smartfin-api',
    jwtid: crypto.randomUUID(),
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

/**
 * Verify JWT Access Token with strict algorithm whitelist
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: 'smartfin-ai',
    audience: 'smartfin-api',
  }) as AccessTokenPayload;
};

/**
 * Verify JWT Refresh Token with strict algorithm whitelist
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer: 'smartfin-ai',
    audience: 'smartfin-api',
  }) as RefreshTokenPayload;
};

/**
 * Compute SHA-256 hash of a token for secure database storage
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate a cryptographically secure random token (e.g. for email verification or password reset)
 */
export const generateRandomToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};
