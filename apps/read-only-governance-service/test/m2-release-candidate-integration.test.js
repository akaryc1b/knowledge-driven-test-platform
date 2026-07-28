import test from 'node:test';
import assert from 'node:assert/strict';
import { validateM2ReleaseCandidate } from '../../../scripts/validate-m2-release-candidate.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;
if (!connectionString) {
  test('M2-RC1 PostgreSQL evidence validation requires KDTP_POSTGRES_TEST_URL', { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');
  test('M2-RC1 evidence validates on PostgreSQL 18 alongside unified route acceptance', { concurrency: false }, async () => {
    const pool = new Pool({ connectionString, max: 2 });
    try {
      const result = await pool.query("SELECT current_setting('server_version_num')::int AS version, 1 AS ready");
      assert(result.rows[0].version >= 180000);
      assert.equal(result.rows[0].ready, 1);
      const evidence = await validateM2ReleaseCandidate({
        generatedAt: '2026-07-28T06:30:00.000Z', commitSha: 'local', branch: 'agent/m2-i-release-acceptance',
      });
      assert.equal(evidence.verification.businessRoutes.length, 10);
      assert.equal(evidence.decision.productionEligible, false);
    } finally { await pool.end(); }
  });
}
