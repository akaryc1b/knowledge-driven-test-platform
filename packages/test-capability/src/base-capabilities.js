import { CAPABILITY_CONTRACT_SCHEMA_VERSION } from './constants.js';
import { createCapability, createCapabilityCatalog } from './validation.js';

const emptyContract = Object.freeze({
  schemaVersion: CAPABILITY_CONTRACT_SCHEMA_VERSION,
  fields: [],
  additionalProperties: false,
});

const definitions = [
  ['api-functional', 'API functional intent', ['api'], 'api-functional', ['functional', 'api']],
  ['api-performance', 'API performance intent', ['api'], 'api-performance', ['performance', 'api']],
  ['web-ui', 'Web user-interface intent', ['web-page', 'web-application'], 'web-ui', ['web', 'ui']],
  ['websocket', 'WebSocket intent', ['websocket'], 'websocket', ['realtime', 'websocket']],
  ['database', 'Database intent', ['database'], 'database', ['database']],
  ['middleware', 'Middleware intent', ['middleware'], 'middleware', ['middleware']],
];

export function baseCapabilities() {
  return definitions.map(([capabilityId, name, targetKinds, intentKind, tags]) => createCapability({
    capabilityId,
    version: '1.0.0',
    name,
    targetKinds,
    intentKind,
    inputContract: emptyContract,
    assertionContract: emptyContract,
    thresholdContract: emptyContract,
    dependencyRules: [],
    enabled: true,
    source: { kind: 'built-in', reference: 'M2-B' },
    tags,
  }));
}

export function createBaseCapabilityCatalog(version = '1.0.0') {
  return createCapabilityCatalog({ version, capabilities: baseCapabilities() });
}
