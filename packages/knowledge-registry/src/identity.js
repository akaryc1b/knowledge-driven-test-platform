import { registryInvariant } from './errors.js';

const KNOWLEDGE_ID_PATTERN = /^[A-Z][A-Z0-9]{1,31}(?:-[A-Z0-9][A-Z0-9]{0,31}){2,7}$/;
const STRICT_SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/** @param {unknown} input */
export function validateKnowledgeId(input) {
  registryInvariant(typeof input === 'string' && KNOWLEDGE_ID_PATTERN.test(input),
    'INVALID_KNOWLEDGE_ID',
    'Knowledge ID must contain 3-8 uppercase hyphen-separated segments',
    { knowledgeId: input });
  return input;
}

/** @param {unknown} input */
export function parseKnowledgeVersion(input) {
  registryInvariant(typeof input === 'string',
    'INVALID_KNOWLEDGE_VERSION', 'Knowledge version must be a string', { version: input });
  const match = STRICT_SEMVER_PATTERN.exec(input);
  registryInvariant(match,
    'INVALID_KNOWLEDGE_VERSION',
    'Knowledge version must use strict MAJOR.MINOR.PATCH SemVer without suffixes',
    { version: input });
  const components = match.slice(1).map(Number);
  registryInvariant(components.every(Number.isSafeInteger),
    'INVALID_KNOWLEDGE_VERSION', 'Knowledge version components must be safe integers', {
      version: input,
    });
  return {
    raw: input,
    major: components[0],
    minor: components[1],
    patch: components[2],
  };
}

/** @param {string} left @param {string} right */
export function compareKnowledgeVersions(left, right) {
  const a = parseKnowledgeVersion(left);
  const b = parseKnowledgeVersion(right);
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/** @param {unknown} id @param {unknown} version */
export function knowledgeKey(id, version) {
  return `${validateKnowledgeId(id)}@${parseKnowledgeVersion(version).raw}`;
}
