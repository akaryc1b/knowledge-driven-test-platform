import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CapabilityCatalogError,
  InMemoryCapabilityCatalog,
  createCapabilityCatalog,
} from '../src/index.js';
import { capability } from './test-helpers.js';

function runCapabilityCatalogContract(name, factory) {
  test(`${name}: returns a defensive catalog snapshot`, async () => {
    const adapter = factory();
    const first = await adapter.getCatalog();
    first.capabilities[0].name = 'mutated';
    const second = await adapter.getCatalog();
    assert.notEqual(second.capabilities[0].name, 'mutated');
  });

  test(`${name}: resolves exact ID/version only`, async () => {
    const adapter = factory();
    const resolved = await adapter.resolve({ capabilityId: 'api-functional', version: '1.0.0' });
    assert.equal(resolved.intentKind, 'api-functional');
    await assert.rejects(
      adapter.resolve({ capabilityId: 'api-functional', version: '1.0.1' }),
      (error) => error instanceof CapabilityCatalogError && error.code === 'CAPABILITY_NOT_FOUND',
    );
  });

  test(`${name}: rejects disabled and incompatible capabilities`, async () => {
    const adapter = factory();
    await assert.rejects(
      adapter.resolve({ capabilityId: 'api-disabled', version: '1.0.0' }),
      (error) => error.code === 'CAPABILITY_DISABLED',
    );
    await assert.rejects(
      adapter.assertCompatible({ capabilityId: 'api-functional', version: '1.0.0' }, 'database'),
      (error) => error.code === 'CAPABILITY_TARGET_KIND_MISMATCH',
    );
    const compatible = await adapter.assertCompatible(
      { capabilityId: 'api-functional', version: '1.0.0' }, 'api',
    );
    assert.equal(compatible.capabilityId, 'api-functional');
  });
}

runCapabilityCatalogContract('InMemoryCapabilityCatalog', () => new InMemoryCapabilityCatalog(
  createCapabilityCatalog({
    version: '1.0.0',
    capabilities: [
      capability(),
      capability({ capabilityId: 'api-disabled', intentKind: 'api-disabled', enabled: false }),
    ],
  }),
));
