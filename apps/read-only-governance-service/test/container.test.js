import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dockerfile = new URL('../Dockerfile', import.meta.url);

test('container runs as non-root and exposes liveness healthcheck', async () => {
  const content = await readFile(dockerfile, 'utf8');
  assert.match(content, /^USER node$/m);
  assert.match(content, /HEALTHCHECK[\s\S]*\/live/);
  assert.doesNotMatch(content, /ENV\s+.*(?:TOKEN|PASSWORD|SECRET)/i);
});
