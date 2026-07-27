import { TestPlanError } from './errors.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'bearertoken',
  'apikey',
  'secret',
  'clientsecret',
  'privatekey',
  'signingkey',
  'connectionstring',
  'databaseurl',
  'databaseuri',
  'jdbcurl',
  'credential',
  'credentials',
]);

const EXECUTOR_KEYS = new Set([
  'script',
  'k6script',
  'playwrightscript',
  'sqlscript',
  'websocketclientcode',
  'executorcode',
  'runtimecommand',
  'runtimenode',
  'workerimage',
]);

const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/i;
const BASIC_PATTERN = /\bBasic\s+[A-Za-z0-9+/=]{12,}/i;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
const URI_CREDENTIAL_PATTERN = /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i;

/**
 * @param {unknown} value
 * @param {string} [path]
 * @returns {unknown}
 */
export function clonePlanningJson(value, path = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TestPlanError('NON_JSON_NUMBER', `Non-finite number at ${path}`, { path });
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => clonePlanningJson(item, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TestPlanError('NON_JSON_OBJECT', `Unsupported object at ${path}`, { path });
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clonePlanningJson(item, `${path}.${key}`)]),
    );
  }
  throw new TestPlanError('NON_JSON_VALUE', `Unsupported JSON value at ${path}`, {
    path,
    type: typeof value,
  });
}

/**
 * Reject actual secret material. Key inspection is disabled for immutable knowledge payloads
 * because knowledge can legitimately describe password or token policies.
 *
 * @param {unknown} value
 * @param {{path?: string, inspectKeys?: boolean}} [options]
 */
export function assertNoSensitivePlanningData(value, options = {}) {
  const path = options.path ?? '$';
  const inspectKeys = options.inspectKeys ?? true;
  walk(value, path, inspectKeys, ({ key, item, itemPath }) => {
    const normalizedKey = normalizeKey(key);
    if (inspectKeys && normalizedKey && SENSITIVE_KEYS.has(normalizedKey)) {
      throw new TestPlanError('SENSITIVE_PLANNING_DATA', 'Planning data contains a sensitive field', {
        path: itemPath,
        field: key,
      });
    }
    if (typeof item === 'string' && isSensitiveString(item)) {
      throw new TestPlanError('SENSITIVE_PLANNING_DATA', 'Planning data contains secret material', {
        path: itemPath,
      });
    }
  });
}

/** @param {unknown} value @param {string} [path] */
export function assertNoExecutorCode(value, path = '$') {
  walk(value, path, true, ({ key, itemPath }) => {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey && EXECUTOR_KEYS.has(normalizedKey)) {
      throw new TestPlanError('EXECUTOR_SCRIPT_FORBIDDEN', 'Formal planning contracts cannot contain executor code', {
        path: itemPath,
        field: key,
      });
    }
  });
}

function normalizeKey(key) {
  return typeof key === 'string' ? key.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

function isSensitiveString(value) {
  return PRIVATE_KEY_PATTERN.test(value)
    || BEARER_PATTERN.test(value)
    || BASIC_PATTERN.test(value)
    || JWT_PATTERN.test(value)
    || URI_CREDENTIAL_PATTERN.test(value);
}

function walk(value, path, inspectKeys, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      visit({ key: null, item, itemPath });
      walk(item, itemPath, inspectKeys, visit);
    });
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`;
    visit({ key, item, itemPath });
    walk(item, itemPath, inspectKeys, visit);
  }
}
