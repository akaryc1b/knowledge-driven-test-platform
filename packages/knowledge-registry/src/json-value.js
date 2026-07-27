import { RegistryError } from './errors.js';

/**
 * @param {unknown} value
 * @param {string} [path]
 * @returns {unknown}
 */
export function cloneJsonValue(value, path = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new RegistryError('NON_JSON_NUMBER', `Non-finite number at ${path}`, { path });
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => cloneJsonValue(item, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new RegistryError('NON_JSON_OBJECT', `Unsupported object at ${path}`, { path });
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item, `${path}.${key}`)]),
    );
  }
  throw new RegistryError('NON_JSON_VALUE', `Unsupported JSON value at ${path}`, {
    path,
    type: typeof value,
  });
}
