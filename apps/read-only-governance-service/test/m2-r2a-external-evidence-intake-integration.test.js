import test from 'node:test';
import assert from 'node:assert/strict';
import { validateM2ExternalEvidenceIntake } from '../../../scripts/validate-m2-external-evidence-intake.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;
if (!connectionString) {
  test('R2-A PostgreSQL evidence validation requires KDTP_POSTGRES_TEST_URL', { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');
  test('R2-A external evidence intake validates alongside PostgreSQL 18 readiness', { concurrency: false }, async () => {
    const pool = new Pool({ connectionString, max: 2 });
    try {
      const result = await pool.query("SELECT current_setting('server_version_num')::int AS version, 1 AS ready");
      assert(result.rows[0].version >= 180000);
      assert.equal(result.rows[0].ready, 1);
      const evidence = await validateM2ExternalEvidenceIntake({
        generatedAt: '2026-07-30T02:55:00.000Z',
        commitSha: 'local',
        branch: 'agent/m2-rc1-r2a-external-evidence-intake',
      });
      assert.equal(evidence.decision.productionEligible, false);
      assert.equal(evidence.decision.openBlockers.length, 4);
      assert.equal(evidence.statuses.productionSecrets, 'NOT_PROVIDED');
      assert.equal(evidence.statuses.targetClusterValidation, 'NOT_PROVIDED');
    } finally {
      await pool.end();
    }
  });
}
