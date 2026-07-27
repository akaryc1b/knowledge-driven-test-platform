import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKubernetesManifests } from '../../../scripts/validate-kubernetes-manifests.js';

test('Kubernetes baseline satisfies deterministic deployment controls', async () => {
  const result = await validateKubernetesManifests();
  assert.deepEqual(result, {
    resources: 7,
    deployment: 'kdtp-read-only-governance',
    namespace: 'kdtp-system',
    replicas: 2,
  });
});
