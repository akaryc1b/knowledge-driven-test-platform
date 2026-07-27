import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/cli.js';

const here = dirname(fileURLToPath(import.meta.url));
const example = resolve(here, '../../../examples/approval-platform');

test('approval example resolves into a project-bound snapshot', async () => {
  const originalWrite = process.stdout.write;
  process.stdout.write = () => true;
  try {
    const snapshot = await run(['resolve', example]);
    assert.equal(snapshot.context.projectId, 'approval-platform');
    assert.match(snapshot.snapshotId, /^kb-approval-platform-[a-f0-9]{12}$/);
    assert.ok(snapshot.rules.length >= 8);
  } finally {
    process.stdout.write = originalWrite;
  }
});
