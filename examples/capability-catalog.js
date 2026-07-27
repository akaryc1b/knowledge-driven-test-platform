import {
  InMemoryCapabilityCatalog,
  createBaseCapabilityCatalog,
} from '@kdtp/test-capability';

const catalog = createBaseCapabilityCatalog('1.0.0');
const adapter = new InMemoryCapabilityCatalog(catalog);
const capability = await adapter.assertCompatible(
  { capabilityId: 'api-functional', version: '1.0.0' },
  'api',
);

console.log(JSON.stringify({
  catalogVersion: catalog.version,
  catalogDigest: catalog.digest,
  capabilityCount: catalog.capabilities.length,
  resolved: {
    capabilityId: capability.capabilityId,
    version: capability.version,
    targetKinds: capability.targetKinds,
    intentKind: capability.intentKind,
  },
}, null, 2));
