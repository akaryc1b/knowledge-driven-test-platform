import { ExecutionContractError } from './errors.js';
import { validateDigest } from './identity.js';

const SENSITIVE_KEYS = new Set([
  'password', 'passwd', 'token', 'accesstoken', 'refreshtoken', 'idtoken',
  'bearertoken', 'authorization', 'cookie', 'setcookie', 'apikey', 'secret',
  'clientsecret', 'privatekey', 'signingkey', 'connectionstring', 'databaseurl',
  'databaseuri', 'jdbcurl', 'credential', 'credentials', 'headers', 'environmentvariables',
]);

const EXECUTABLE_KEYS = new Set([
  'script', 'k6script', 'playwrightscript', 'sqlscript', 'executorcode', 'sourcecode',
  'runtimecommand', 'command', 'arguments', 'args', 'shell', 'binary', 'executable',
  'modulepath', 'workerimage', 'containerimage', 'kubernetesjob', 'podtemplate',
]);

const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/i;
const BASIC_PATTERN = /\bBasic\s+[A-Za-z0-9+/=]{12,}/i;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
const URI_CREDENTIAL_PATTERN = /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i;
const EXECUTABLE_STRING_PATTERN = /(?:node:)?child_process|\b(?:spawn|exec|execFile)Sync?\s*\(|^#!\//i;
const PLACEHOLDER_PATTERNS = [
  /^(?:latest|main|master)$/i,
  /\.(?:invalid)(?:\/|$)/i,
  /\b(?:example\.com|example\.net|example\.org)\b/i,
  /<[^>]+>/,
  /\$\{[^}]+\}/,
  /\{\{[^}]+\}\}/,
  /\b(?:todo|fixme|changeme|replace[-_ ]?me|placeholder)\b/i,
];
const ARTIFACT_URI_PATTERN = /^artifact:\/\/sha256\/([a-f0-9]{64})$/;

export function cloneExecutionJson(value, path = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ExecutionContractError('NON_JSON_NUMBER', `Non-finite number at ${path}`, { path });
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => cloneExecutionJson(item, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ExecutionContractError('NON_JSON_OBJECT', `Unsupported object at ${path}`, { path });
    }
    return Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, cloneExecutionJson(item, `${path}.${key}`)]));
  }
  throw new ExecutionContractError('NON_JSON_VALUE', `Unsupported JSON value at ${path}`, {
    path,
    type: typeof value,
  });
}

export function assertNoSensitiveExecutionData(value, path = '$') {
  walk(value, path, ({ key, item, itemPath }) => {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey && SENSITIVE_KEYS.has(normalizedKey)) {
      throw new ExecutionContractError('SENSITIVE_EXECUTION_DATA',
        'Execution contract contains a sensitive field', { path: itemPath, field: key });
    }
    if (typeof item === 'string' && isSensitiveString(item)) {
      throw new ExecutionContractError('SENSITIVE_EXECUTION_DATA',
        'Execution contract contains secret material', { path: itemPath });
    }
  });
}

export function assertNoExecutableMaterial(value, path = '$') {
  walk(value, path, ({ key, item, itemPath }) => {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey && EXECUTABLE_KEYS.has(normalizedKey)) {
      throw new ExecutionContractError('EXECUTABLE_MATERIAL_FORBIDDEN',
        'Contract-only execution data cannot contain executable material', {
          path: itemPath,
          field: key,
        });
    }
    if (typeof item === 'string' && EXECUTABLE_STRING_PATTERN.test(item)) {
      throw new ExecutionContractError('EXECUTABLE_MATERIAL_FORBIDDEN',
        'Contract-only execution data cannot contain executable expressions', { path: itemPath });
    }
  });
}

export function assertNoPlaceholderData(value, path = '$') {
  walk(value, path, ({ item, itemPath }) => {
    if (typeof item === 'string' && PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(item))) {
      throw new ExecutionContractError('EXECUTION_PLACEHOLDER_FORBIDDEN',
        'Execution contract contains a placeholder or mutable reference', { path: itemPath });
    }
  });
}

export function validateImmutableArtifactUri(uri, digest) {
  validateDigest(digest, 'artifact.digest');
  const match = typeof uri === 'string' ? ARTIFACT_URI_PATTERN.exec(uri) : null;
  if (!match || match[1] !== digest) {
    throw new ExecutionContractError('MUTABLE_ARTIFACT_REFERENCE',
      'Artifact URI must be an immutable artifact://sha256/<digest> reference', { uri, digest });
  }
  return uri;
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

function walk(value, path, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      visit({ key: null, item, itemPath });
      walk(item, itemPath, visit);
    });
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`;
    visit({ key, item, itemPath });
    walk(item, itemPath, visit);
  }
}
