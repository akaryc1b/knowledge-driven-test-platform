import { canonicalize, sha256 } from '@kdtp/knowledge-core';
import {
  assertNoExecutorCode,
  assertNoSensitivePlanningData,
  clonePlanningJson,
  validateDigest,
  validateIdentifier,
  validateKind,
  validateNonEmptyString,
  validateSemver,
} from '@kdtp/test-plan';
import {
  CAPABILITY_CATALOG_SCHEMA_VERSION,
  CAPABILITY_CONTRACT_SCHEMA_VERSION,
  TEST_CAPABILITY_SCHEMA_VERSION,
} from './constants.js';
import { capabilityInvariant } from './errors.js';

const CAPABILITY_FIELDS = new Set([
  'schemaVersion', 'capabilityId', 'version', 'name', 'targetKinds', 'intentKind',
  'inputContract', 'assertionContract', 'thresholdContract', 'dependencyRules',
  'enabled', 'source', 'tags',
]);
const DEPENDENCY_FIELDS = new Set([
  'capabilityId', 'version', 'required', 'targetScope',
]);
const SOURCE_FIELDS = new Set(['kind', 'reference']);
const CATALOG_FIELDS = new Set(['schemaVersion', 'version', 'digest', 'capabilities']);

export function createCapability(command) {
  return normalizeCapability({
    schemaVersion: TEST_CAPABILITY_SCHEMA_VERSION,
    ...command,
  });
}

export function validateCapability(input) {
  return normalizeCapability(input);
}

function normalizeCapability(input) {
  capabilityInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_CAPABILITY', 'Capability must be an object');
  assertOnlyFields(input, CAPABILITY_FIELDS, 'INVALID_CAPABILITY', 'Capability');
  capabilityInvariant(input.schemaVersion === TEST_CAPABILITY_SCHEMA_VERSION,
    'INVALID_CAPABILITY_SCHEMA', 'Capability schema version is unsupported');
  const capabilityId = validateIdentifier(input.capabilityId, 'capabilityId');
  const version = validateSemver(input.version, 'capability.version');
  const name = validateNonEmptyString(input.name, 'capability.name', 256);
  capabilityInvariant(Array.isArray(input.targetKinds) && input.targetKinds.length > 0,
    'INVALID_CAPABILITY_TARGET_KINDS', 'Capability must support at least one target kind');
  const targetKinds = normalizeStringArray(input.targetKinds, 'targetKinds', validateKind);
  const intentKind = validateKind(input.intentKind, 'intentKind');
  const inputContract = normalizeContract(input.inputContract, 'inputContract');
  const assertionContract = normalizeContract(input.assertionContract, 'assertionContract');
  const thresholdContract = normalizeContract(input.thresholdContract, 'thresholdContract');
  const dependencyRules = (input.dependencyRules ?? []).map(normalizeDependencyRule)
    .sort(compareDependency);
  assertUnique(dependencyRules.map(dependencyKey), 'DUPLICATE_CAPABILITY_DEPENDENCY',
    'Capability dependency rules must be unique');
  capabilityInvariant(typeof input.enabled === 'boolean',
    'INVALID_CAPABILITY_ENABLED', 'Capability enabled must be boolean');
  const source = normalizeSource(input.source);
  const tags = normalizeStringArray(input.tags ?? [], 'tags', validateKind);
  const normalized = canonicalize({
    schemaVersion: TEST_CAPABILITY_SCHEMA_VERSION,
    capabilityId,
    version,
    name,
    targetKinds,
    intentKind,
    inputContract,
    assertionContract,
    thresholdContract,
    dependencyRules,
    enabled: input.enabled,
    source,
    tags,
  });
  assertNoSensitivePlanningData(normalized, { path: `$.capabilities.${capabilityId}` });
  assertNoExecutorCode(normalized, `$.capabilities.${capabilityId}`);
  assertNoRuntimeInfrastructure(normalized, `$.capabilities.${capabilityId}`);
  return clonePlanningJson(normalized);
}

function normalizeContract(input, field) {
  capabilityInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_CAPABILITY_CONTRACT', `${field} must be an object`);
  const contract = clonePlanningJson(input, `$.${field}`);
  capabilityInvariant(contract.schemaVersion === CAPABILITY_CONTRACT_SCHEMA_VERSION,
    'INVALID_CAPABILITY_CONTRACT_SCHEMA', `${field} must use capability-contract/v1`, { field });
  assertNoSensitivePlanningData(contract, { path: `$.${field}` });
  assertNoExecutorCode(contract, `$.${field}`);
  assertNoRuntimeInfrastructure(contract, `$.${field}`);
  return canonicalize(contract);
}

function normalizeDependencyRule(input) {
  capabilityInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_CAPABILITY_DEPENDENCY', 'Capability dependency rule must be an object');
  assertOnlyFields(input, DEPENDENCY_FIELDS,
    'INVALID_CAPABILITY_DEPENDENCY', 'Capability dependency rule');
  capabilityInvariant(typeof input.required === 'boolean',
    'INVALID_CAPABILITY_DEPENDENCY', 'Capability dependency required must be boolean');
  return {
    capabilityId: validateIdentifier(input.capabilityId, 'dependency.capabilityId'),
    version: validateSemver(input.version, 'dependency.version'),
    required: input.required,
    targetScope: validateKind(input.targetScope, 'dependency.targetScope'),
  };
}

function normalizeSource(input) {
  capabilityInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_CAPABILITY_SOURCE', 'Capability source must be an object');
  assertOnlyFields(input, SOURCE_FIELDS, 'INVALID_CAPABILITY_SOURCE', 'Capability source');
  return compact({
    kind: validateKind(input.kind, 'source.kind'),
    reference: input.reference === undefined
      ? undefined
      : validateNonEmptyString(input.reference, 'source.reference', 1024),
  });
}

export function createCapabilityCatalog(command) {
  capabilityInvariant(command && typeof command === 'object' && !Array.isArray(command),
    'INVALID_CAPABILITY_CATALOG', 'Capability catalog command must be an object');
  const version = validateSemver(command.version, 'catalog.version');
  capabilityInvariant(Array.isArray(command.capabilities) && command.capabilities.length > 0,
    'INVALID_CAPABILITY_CATALOG', 'Capability catalog must contain at least one capability');
  const capabilities = command.capabilities.map((capability) => validateCapability(capability))
    .sort(compareCapability);
  assertUnique(capabilities.map(capabilityKey), 'DUPLICATE_CAPABILITY',
    'Capability ID/version identities must be unique');
  const identity = canonicalize({
    schemaVersion: CAPABILITY_CATALOG_SCHEMA_VERSION,
    version,
    capabilities,
  });
  return clonePlanningJson({ ...identity, digest: sha256(identity) });
}

export function validateCapabilityCatalog(input) {
  capabilityInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_CAPABILITY_CATALOG', 'Capability catalog must be an object');
  assertOnlyFields(input, CATALOG_FIELDS, 'INVALID_CAPABILITY_CATALOG', 'Capability catalog');
  capabilityInvariant(input.schemaVersion === CAPABILITY_CATALOG_SCHEMA_VERSION,
    'INVALID_CAPABILITY_CATALOG_SCHEMA', 'Capability catalog schema version is unsupported');
  validateDigest(input.digest, 'catalog.digest');
  const normalized = createCapabilityCatalog({
    version: input.version,
    capabilities: input.capabilities,
  });
  capabilityInvariant(input.digest === normalized.digest,
    'CAPABILITY_CATALOG_DIGEST_MISMATCH', 'Capability catalog digest does not match canonical content', {
      expectedDigest: normalized.digest,
      actualDigest: input.digest,
    });
  return normalized;
}

export function capabilityKey(capability) {
  return `${capability.capabilityId}@${capability.version}`;
}

export function compareCapability(left, right) {
  return left.capabilityId.localeCompare(right.capabilityId)
    || compareSemver(left.version, right.version);
}

export function supportsTargetKind(capability, targetKind) {
  const kind = validateKind(targetKind, 'targetKind');
  return capability.targetKinds.includes(kind) || capability.targetKinds.includes('any');
}

function dependencyKey(item) {
  return `${item.capabilityId}@${item.version}:${item.targetScope}:${item.required}`;
}

function compareDependency(left, right) {
  return left.capabilityId.localeCompare(right.capabilityId)
    || compareSemver(left.version, right.version)
    || left.targetScope.localeCompare(right.targetScope)
    || Number(left.required) - Number(right.required);
}

function compareSemver(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function normalizeStringArray(input, field, validate) {
  capabilityInvariant(Array.isArray(input), 'INVALID_CAPABILITY_FIELD', `${field} must be an array`);
  const values = input.map((value) => validate(value, field)).sort();
  assertUnique(values, 'DUPLICATE_CAPABILITY_VALUE', `${field} values must be unique`);
  return values;
}

function assertOnlyFields(input, allowed, code, label) {
  for (const field of Object.keys(input)) {
    capabilityInvariant(allowed.has(field), code, `${label} contains unsupported field`, { field });
  }
}

function assertUnique(values, code, message) {
  capabilityInvariant(new Set(values).size === values.length, code, message);
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function assertNoRuntimeInfrastructure(value, path) {
  const forbidden = new Set([
    'worker', 'workers', 'queue', 'scheduler', 'kubernetesjob', 'runtimeimage',
    'runtimehost', 'runtimeport', 'nodepool', 'podtemplate', 'serviceaccount',
  ]);
  walk(value, path, ({ key, itemPath }) => {
    const normalized = typeof key === 'string' ? key.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    capabilityInvariant(!forbidden.has(normalized), 'RUNTIME_INFRASTRUCTURE_FORBIDDEN',
      'Capability contracts cannot contain runtime infrastructure configuration', {
        path: itemPath,
        field: key,
      });
  });
}

function walk(value, path, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, visit));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`;
    visit({ key, item, itemPath });
    walk(item, itemPath, visit);
  }
}
