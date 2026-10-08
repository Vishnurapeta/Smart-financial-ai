import { Request, Response, NextFunction } from 'express';

/**
 * Recursively cleans an object or array to remove MongoDB operator injection keys
 * (e.g. keys starting with '$' or containing '.') from user-supplied input.
 */
function sanitizeObject(target: unknown): unknown {
  if (target === null || target === undefined) {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => sanitizeObject(item));
  }

  if (typeof target === 'object' && target.constructor === Object) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target)) {
      // Strip dangerous MongoDB query operator keys
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      cleaned[key] = sanitizeObject(value);
    }
    return cleaned;
  }

  return target;
}

/**
 * Express middleware that inspects and sanitizes request body, query, and params
 * against NoSQL query operator injection attacks.
 */
export function noSqlSanitizer(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query) as Request['query'];
  }
  if (req.params) {
    req.params = sanitizeObject(req.params) as Request['params'];
  }
  next();
}
