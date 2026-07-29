import test from 'node:test';
import assert from 'node:assert/strict';
import { validateM2ProductionPromotion } from '../../../scripts/validate-m2-production-promotion-r1b.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;
if (!connectionString) {
  test('M2 production promotion PostgreSQL evidence validation requires KDTP_POSTGRES_TEST_URL', { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');
  test('M2 R1-B production promotion evidence validates alongside PostgreSQL 18 readiness', { concurrency: false }, async () => {
    const pool = new Pool({ connectionString, max: 2 });
    try {
      const result = await pool.query("SELECT current_setting('server_version_num')::int AS version, 1 AS ready");
      assert(result.rows[0].version >= 180000);
      assert.equal(result.rows[0].ready, 1);
      const evidence = await validateM2ProductionPromotion({
        generatedAt: '2026-07-29T10:15:00.000Z',
        commitSha: 'local',
        branch: 'agent/m2-rc1-r1b-immutable-image-binding',
      });
      assert.equal(evidence.digests.candidate, '5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697');
      assert.equal(evidence.digests.postMergeAcceptance, 'd073efec5aa587caf7f54eedd219a494b876d2913cb8e110981c374e79501e25');
      assert.deepEqual(evidence.decision.resolvedBlockers, [
        'main-branch-final-ci-not-verified',
        'external-registry-digest-missing',
      ]);
      assert.equal(evidence.decision.openBlockers.length, 4);
      assert.equal(evidence.imageRelease.status, 'PUBLISHED');
      assert.equal(evidence.decision.productionEligible, false);
    } finally {
      await pool.end();
    }
  });
}
