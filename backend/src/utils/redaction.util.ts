import { SENSITIVE_FIELDS } from '../constants/observability.constants.js';

const SENSITIVE_SET = new Set(SENSITIVE_FIELDS.map((f) => f.toLowerCase()));
const MAX_STRING_LENGTH = 1000;
const MAX_RECURSION_DEPTH = 6;

/**
 * Sanitize strings for log injection protection (strip newlines, carriage returns, control characters)
 */
export function sanitizeForLog(val: unknown, maxLength = MAX_STRING_LENGTH): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'string' ? val : String(val);
  // Strip non-printable and CRLF injection characters
  const sanitized = str.replace(/[\r\n\x00-\x1F\x7F]/g, ' ').trim();
  if (sanitized.length > maxLength) {
    return `${sanitized.substring(0, maxLength)}...[TRUNCATED]`;
  }
  return sanitized;
}

/**
 * Recursively redacts sensitive fields from payloads, objects, queries, and headers
 */
export function redactSensitiveFields(data: unknown, currentDepth = 0): unknown {
  if (currentDepth > MAX_RECURSION_DEPTH) {
    return '[DEPTH_LIMIT_EXCEEDED]';
  }

  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return data;
  }

  // Handle Date
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle Error objects
  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeForLog(data.message),
      code: (data as { code?: unknown }).code,
      stack: data.stack,
    };
  }

  // Handle Array
  if (Array.isArray(data)) {
    // If array has too many items, summarize to protect memory & logging bandwidth
    if (data.length > 50) {
      const truncated = data.slice(0, 10).map((item) => redactSensitiveFields(item, currentDepth + 1));
      return [...truncated, `... and ${data.length - 10} more items [SUMMARIZED]`];
    }
    return data.map((item) => redactSensitiveFields(item, currentDepth + 1));
  }

  // Handle Plain Object
  const obj = data as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if key matches sensitive patterns
    if (
      SENSITIVE_SET.has(lowerKey) ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('cardnumber') ||
      lowerKey.includes('cvv') ||
      lowerKey.includes('apikey')
    ) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveFields(value, currentDepth + 1);
    } else if (typeof value === 'string') {
      redacted[key] = sanitizeForLog(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}
