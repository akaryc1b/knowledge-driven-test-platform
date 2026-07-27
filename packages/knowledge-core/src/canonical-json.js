import { createHash } from 'node:crypto';
import { KnowledgeError } from './errors.js';

/**
 * Convert a JSON-compatible value into a recursively key-sorted value.
 * Array order is preserved because arrays can carry domain semantics.
 *
 * @param {unknown} value
 * @param {string} [path]
 * @returns {unknown}
 */
export function canonicalize(value, path = '$') {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new KnowledgeError('NON_JSON_NUMBER', `Non-finite number at ${path}`, { path });
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new KnowledgeError('NON_JSON_OBJECT', `Unsupported object at ${path}`, { path });
    }

    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key], `${path}.${key}`)]),
    );
  }

  throw new KnowledgeError('NON_JSON_VALUE', `Unsupported JSON value at ${path}`, {
    path,
    type: typeof value,
  });
}

/** @param {unknown} value */
export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

/** @param {unknown} value */
export function sha256(value) {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

/** @param {unknown} left @param {unknown} right */
export function jsonEqual(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}
