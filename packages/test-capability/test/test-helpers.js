import {
  CAPABILITY_CONTRACT_SCHEMA_VERSION,
  createCapability,
} from '../src/index.js';

export function capability(overrides = {}) {
  const capabilityId = overrides.capabilityId ?? 'api-functional';
  return createCapability({
    capabilityId,
    version: overrides.version ?? '1.0.0',
    name: overrides.name ?? `${capabilityId} capability`,
    targetKinds: overrides.targetKinds ?? ['api'],
    intentKind: overrides.intentKind ?? capabilityId,
    inputContract: overrides.inputContract ?? contract(['operationId']),
    assertionContract: overrides.assertionContract ?? contract(['statusCode']),
    thresholdContract: overrides.thresholdContract ?? contract([]),
    dependencyRules: overrides.dependencyRules ?? [],
    enabled: overrides.enabled ?? true,
    source: overrides.source ?? { kind: 'built-in', reference: 'test' },
    tags: overrides.tags ?? ['test'],
  });
}

export function contract(fields) {
  return {
    schemaVersion: CAPABILITY_CONTRACT_SCHEMA_VERSION,
    fields: fields.map((name) => ({ name, type: 'string', required: true })),
    additionalProperties: false,
  };
}
