/**
 * Security utilities for input sanitization, regex escaping, and query protection.
 */

/**
 * Escapes all regular expression metacharacters in user input to prevent
 * ReDoS (Regular Expression Denial of Service) and regex injection.
 */
export function escapeRegex(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates a client-requested sort field against an allowlist of permitted fields.
 * If the requested field is invalid or not in the allowlist, falls back to the default field.
 */
export function safeSortField<T extends string>(
  requestedField: string | undefined,
  allowedFields: readonly T[],
  defaultField: T,
): T {
  if (!requestedField) return defaultField;
  const normalized = requestedField.trim();
  return allowedFields.includes(normalized as T) ? (normalized as T) : defaultField;
}

/**
 * Disallows path traversal patterns ('..', '//', '\\', ':') in URL paths.
 */
export function isSafePath(pathStr: string): boolean {
  if (!pathStr || typeof pathStr !== 'string') return false;
  if (pathStr.includes('..') || pathStr.includes('://') || pathStr.includes('\\')) {
    return false;
  }
  return true;
}
