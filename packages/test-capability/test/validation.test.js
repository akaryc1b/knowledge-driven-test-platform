import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CapabilityCatalogError,
  createCapability,
  createCapabilityCatalog,
  validateCapabilityCatalog,
} from '../src/index.js';
import { capability, contract } from './test-helpers.js';

test('catalog digest and capability ordering are deterministic', () => {
  const first = capability({ capabilityId: 'api-performance', intentKind: 'api-performance' });
  const second = capability({ capabilityId: 'api-functional', intentKind: 'api-functional' });
  const left = createCapabilityCatalog({ version: '1.0.0', capabilities: [first, second] });
  const right = createCapabilityCatalog({ version: '1.0.0', capabilities: [second, first] });
  assert.deepEqual(left, right);
  assert.deepEqual(left.capabilities.map((item) => item.capabilityId), [
    'api-functional', 'api-performance',
  ]);
  assert.match(left.digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(validateCapabilityCatalog(left), left);
});

test('catalog rejects duplicate capability identity and digest drift', () => {
  const item = capability();
  assert.throws(
    () => createCapabilityCatalog({ version: '1.0.0', capabilities: [item, item] }),
    (error) => error instanceof CapabilityCatalogError && error.code === 'DUPLICATE_CAPABILITY',
  );
  const catalog = createCapabilityCatalog({ version: '1.0.0', capabilities: [item] });
  assert.throws(
    () => validateCapabilityCatalog({ ...catalog, digest: 'f'.repeat(64) }),
    (error) => error instanceof CapabilityCatalogError
      && error.code === 'CAPABILITY_CATALOG_DIGEST_MISMATCH',
  );
});

test('capability rejects secrets, executor scripts and runtime infrastructure', () => {
  for (const [field, value, code] of [
    ['inputContract', { ...contract([]), token: 'should-not-exist' }, 'SENSITIVE_PLANNING_DATA'],
    ['assertionContract', { ...contract([]), k6Script: 'export default function(){}' }, 'EXECUTOR_SCRIPT_FORBIDDEN'],
    ['thresholdContract', { ...contract([]), worker: { image: 'runner:latest' } }, 'RUNTIME_INFRASTRUCTURE_FORBIDDEN'],
  ]) {
    assert.throws(
      () => capability({ [field]: value }),
      (error) => error.code === code,
    );
  }
});

test('capability construction defensively copies all input data', () => {
  const inputContract = contract(['operationId']);
  const targetKinds = ['api'];
  const item = createCapability({
    capabilityId: 'api-functional', version: '1.0.0', name: 'API functional',
    targetKinds, intentKind: 'api-functional', inputContract,
    assertionContract: contract([]), thresholdContract: contract([]),
    dependencyRules: [], enabled: true,
    source: { kind: 'built-in' }, tags: [],
  });
  targetKinds.push('database');
  inputContract.fields[0].name = 'mutated';
  assert.deepEqual(item.targetKinds, ['api']);
  assert.equal(item.inputContract.fields[0].name, 'operationId');
});
