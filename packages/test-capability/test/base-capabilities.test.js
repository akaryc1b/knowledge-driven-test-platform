import test from 'node:test';
import assert from 'node:assert/strict';
import { baseCapabilities, createBaseCapabilityCatalog } from '../src/index.js';

test('base capabilities are data-driven and deterministically cataloged', () => {
  assert.deepEqual(baseCapabilities().map((item) => item.capabilityId), [
    'api-functional', 'api-performance', 'web-ui', 'websocket', 'database', 'middleware',
  ]);
  const first = createBaseCapabilityCatalog();
  const second = createBaseCapabilityCatalog();
  assert.deepEqual(first, second);
  assert.equal(first.capabilities.length, 6);
});
