import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '../src/cli.js';
import {
  generateCommand,
  service,
} from '../../../packages/test-planning-orchestration/test/test-helpers.js';

test('kdtp-plan delegates generate, validate, show and coverage to application services', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kdtp-plan-cli-'));
  try {
    const context = service();
    const outputs = [];
    const cli = { orchestration: context.orchestration, write: (value) => outputs.push(JSON.parse(value)) };
    const generatePath = join(directory, 'generate.json');
    await writeFile(generatePath, JSON.stringify(generateCommand(context.planningRequest)));
    const generated = await run(['generate', generatePath], cli);
    assert.equal(generated.created, true);

    const validatePath = join(directory, 'validate.json');
    await writeFile(validatePath, JSON.stringify(generated.planningResult));
    const validated = await run(['validate', validatePath], cli);
    assert.equal(validated.digest, generated.planningResult.digest);

    const queryPath = join(directory, 'query.json');
    await writeFile(queryPath, JSON.stringify({ planId: generated.record.planId, actor: 'planner-service' }));
    const shown = await run(['show', queryPath], cli);
    assert.equal(shown.planId, generated.record.planId);
    const coverage = await run(['coverage', queryPath], cli);
    assert.equal(coverage.summary.covered, 1);
    assert.equal(outputs.length, 4);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('kdtp-plan rejects unknown commands', async () => {
  await assert.rejects(() => run(['execute', 'command.json'], {}), /Usage/);
});
