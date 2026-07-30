import test from 'node:test';
import assert from 'node:assert/strict';
import { validateM2PortableReleaseReadiness } from '../../../scripts/validate-m2-portable-release-readiness.js';

test('portable readiness remains valid with the real PostgreSQL service dependency', async (t) => {
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

  const evidence = await validateM2PortableReleaseReadiness({
    generatedAt: '2026-07-30T07:00:00.000Z',
    commitSha: 'local',
    branch: 'agent/m2-rc1-r2-rebaseline-portable-readiness',
  });
  assert.equal(evidence.decision.repositoryReleaseReady, true);
  assert.equal(evidence.decision.environmentPromotionEvaluated, false);
  assert.equal(evidence.runtimeConfiguration.repositoryRequiresProviderMetadata, false);
});
