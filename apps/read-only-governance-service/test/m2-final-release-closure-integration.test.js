import test from 'node:test';
import assert from 'node:assert/strict';
import { validateM2FinalReleaseClosure } from '../../../scripts/validate-m2-final-release-closure.js';

test('M2 final closure remains valid with the real PostgreSQL service dependency', async (t) => {
  const connectionString = process.env.KDTP_POSTGRES_TEST_URL;
  if (!connectionString) {
    t.skip('KDTP_POSTGRES_TEST_URL is not configured');
    return;
  }
  const { Client } = await import('pg');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query('select 1::int as ok');
    assert.equal(result.rows[0].ok, 1);
  } finally {
    await client.end();
  }
  const evidence = await validateM2FinalReleaseClosure({
    generatedAt: '2026-07-30T09:00:00.000Z',
    commitSha: 'local',
    branch: 'agent/m2-rc1-r3-final-release-closure',
  });
  assert.equal(evidence.decision.m2Rc1Closed, true);
  assert.equal(evidence.decision.m3ImplementationStarted, false);
});
