import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { sanitizeForLog } from '../utils/redaction.util.js';

export interface RequestWithId extends Request {
  id?: string;
  requestId?: string;
  correlationId?: string;
}

const REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Request correlation & tracking middleware.
 * Safely inspects X-Request-ID or X-Correlation-ID header, validates against injection,
 * and generates a cryptographically random UUID v4 if absent.
 */
export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const incomingId =
    (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string);

  let requestId: string;

  if (incomingId && REQUEST_ID_REGEX.test(incomingId.trim())) {
    requestId = incomingId.trim();
  } else {
    requestId = randomUUID();
  }

  // Sanitize to guarantee safe handling in logs and response headers
  const safeId = sanitizeForLog(requestId, 64);

  req.id = safeId;
  req.requestId = safeId;
  req.correlationId = safeId;

  // Propagate in response headers
  res.setHeader('X-Request-ID', safeId);
  res.setHeader('X-Correlation-ID', safeId);

  next();
}
