import {
  assertNoExecutableMaterial,
  assertNoPlaceholderData,
  assertNoSensitiveExecutionData,
} from '@kdtp/execution-contract';
import { K6ApiCompilerError } from './errors.js';

const FORBIDDEN_KEYS = new Set([
  'script', 'scripts', 'k6script', 'javascript', 'javascriptsource', 'sourcecode',
  'command', 'runtimecommand', 'executorcode', 'shell', 'binary', 'executable',
  'childprocess', 'spawn', 'exec', 'execfile', 'modulepath', 'workingdirectory',
  'temporarydirectory', 'tempdirectory', 'dockerfile', 'containerimage',
  'kubernetesjob', 'podtemplate', 'authorization', 'cookie', 'headers',
]);
const NETWORK_URL = /\b(?:https?|wss?):\/\//i;
const FILE_URI = /\bfile:\/\//i;
const ABSOLUTE_FILE_PATH = /^(?:[A-Za-z]:\\|\/(?:tmp|var|etc|home|Users|opt|root)(?:\/|$))/;
const SHELL_FRAGMENT = /(?:^#!\/|\$\(|`[^`]+`|\s(?:&&|\|\||;|\|)\s|\b(?:curl|wget|bash|sh|powershell|cmd\.exe)\b)/i;
const JS_SOURCE = /(?:\bexport\s+default\s+function\b|\bimport\s+.+\s+from\s+['"]|\bfunction\s*\([^)]*\)\s*\{|=>\s*\{)/;

export function assertK6ApiCompilationSafe(value, path = '$') {
  assertNoSensitiveExecutionData(value, path);
  assertNoExecutableMaterial(value, path);
  assertNoPlaceholderData(value, path);
  walk(value, path, ({ key, item, itemPath }) => {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey && FORBIDDEN_KEYS.has(normalizedKey)) {
      throw new K6ApiCompilerError('K6_API_FORBIDDEN_FIELD',
        'k6 API compilation input contains a forbidden field', { path: itemPath, field: key });
    }
    if (typeof item !== 'string') return;
    if (NETWORK_URL.test(item)) {
      throw new K6ApiCompilerError('K6_API_NETWORK_TARGET_FORBIDDEN',
        'k6 API compiler cannot receive a network endpoint', { path: itemPath });
    }
    if (FILE_URI.test(item) || ABSOLUTE_FILE_PATH.test(item)) {
      throw new K6ApiCompilerError('K6_API_FILE_PATH_FORBIDDEN',
        'k6 API compiler cannot receive an absolute filesystem path', { path: itemPath });
    }
    if (SHELL_FRAGMENT.test(item) || JS_SOURCE.test(item)) {
      throw new K6ApiCompilerError('K6_API_EXECUTABLE_SOURCE_FORBIDDEN',
        'k6 API compiler cannot receive executable source or shell fragments', { path: itemPath });
    }
  });
}

function normalizeKey(key) {
  return typeof key === 'string' ? key.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
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
