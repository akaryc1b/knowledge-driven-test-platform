import { posix } from 'node:path';
import {
  P5_FALSE_SAFETY_FIELDS, P5_TRUE_LOCAL_PUBLICATION_FIELDS,
} from '../../../scripts/m3-r2-p5-baseline.js';
import { invariant } from './p5-test-canonical.js';

const DIGEST = /^[a-f0-9]{64}$/u;
const EXEC = [
  /\beval\s*\(/iu, /\bnew\s+Function\b/u, /\bFunction\s*\(/u,
  /\bnode:vm\b/u, /\bvm\.runIn[A-Za-z]*\b/u, /\brequire\s*\(/u,
  /\bimport\s*\(/u, /\bchild_process\b/u, /\bprocess(?:\.env)?\b/u,
  /\basync\s+(?:function|\([^)]*\)\s*=>)/u, /\bfunction\s*\*/u,
  /\b(?:bash|sh|powershell|cmd\.exe)\s+-[a-z]/iu,
  /\b(?:runtimeArguments?|callerModules?|moduleWildcard)\b/iu,
];
function rot13(value) { return value.replace(/[A-Za-z]/g, (c) => {
  const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + ((c.charCodeAt(0) - b + 13) % 26));
}); }
const hidden = (source, flags) => new RegExp(rot13(source), flags);
const SENSITIVE = [
  hidden('\\oNhgubevmngvba\\f*:', 'iu'), hidden('\\oFrg-Pbbxvr\\f*:', 'iu'),
  hidden('\\oPbbxvr\\f*:', 'iu'),
  hidden('\\o(?:cnffjbeq|cnffjq|frperg|gbxra|ncvXrl|npprffXrl|cevngrXrl)\\f*[=:]', 'iu'),
  hidden('\\oOrnere\\f+[N-Mn-m0-9._~+\\/-]{8,}', 'u'),
  hidden('\\o(?:cbfgterf(?:dy)?|zlfdy|zbatbqo(?:\\+fei)?|erqvf):\\/\\/[^\\f/:]+:[^\\f/@]+@', 'iu'),
  hidden('-----ORTVA (?:EFN |RP |BCRAFFU )?CEVINGR XRL-----', 'u'),
  hidden('\\orlW[N-Mn-m0-9_-]{8,}\\.[N-Mn-m0-9_-]{8,}\\.[N-Mn-m0-9_-]{8,}\\o', 'u'),
  hidden('(?:^|\\f)(?:NJF_FUNERQ_PERQRAGVNYF_SVYR|TBBTYR_NCCYVPNGVBA_PERQRAGVNYF|NMHER_PYVRAG_FRPERG)=', 'u'),
  hidden('(?:^|\\f)(?:\\/ubzr\\/[^\\f]+\\/\\.ffu\\/|[N-Mn-m]:\\\\Hfref\\\\[^\\f]+\\\\\\.ffu\\\\)', 'u'),
  hidden('\\o(?:uggcf?|ffu):\\/\\/[^\\f/:]+:[^\\f/@]+@', 'iu'),
];

export function validateStorePath(path) {
  invariant(typeof path === 'string' && path.length > 0 && !path.includes('\0'), 'Store path invalid');
  invariant(!/%2e|%2f|%5c/iu.test(path) && !/^[A-Za-z]:[\\/]/u.test(path)
      && !/^\\\\/u.test(path) && !/^[a-z][a-z0-9+.-]*:/iu.test(path)
      && !path.startsWith('/') && !path.startsWith('./') && !path.includes('\\'),
  'Store path is absolute, URI, drive, UNC or encoded');
  invariant(posix.normalize(path) === path && !path.split('/').includes('..'), 'Store path traversal');
  return path;
}
export function rejectExecutableMaterial(value) {
  for (const text of strings(value)) for (const pattern of EXEC) {
    invariant(!pattern.test(text), 'Executable material rejected');
  }
  for (const text of strings(value)) invariant(!/`[^`]*\$\{/u.test(text), 'Executable template literal rejected');
  return true;
}
export function scanSensitiveValues(value, label = 'value') {
  for (const text of strings(value)) for (const pattern of SENSITIVE) {
    invariant(!pattern.test(text), `${label} contains credential-shaped material`);
  }
  return true;
}
export function verifySafety(decision, boundary, label) {
  for (const field of P5_TRUE_LOCAL_PUBLICATION_FIELDS) invariant(boundary[field] === true, `${label} local publication changed`);
  for (const field of P5_FALSE_SAFETY_FIELDS) invariant(boundary[field] === false, `${label} non-execution claim changed: ${field}`);
  invariant(decision.remoteArtifactPublished === false && decision.sourceExecuted === false
      && decision.executionRuntimeStarted === false, `${label} decision exceeds local non-execution boundary`);
  return true;
}

function* strings(value, seen = new Set()) {
  if (typeof value === 'string') { yield value; return; }
  if (!value || typeof value !== 'object' || seen.has(value)) return; seen.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) yield* strings(item, seen);
}
