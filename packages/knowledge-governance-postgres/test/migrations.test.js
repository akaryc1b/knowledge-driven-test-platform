import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadGovernancePostgresMigrations,
} from '../src/index.js';

test('governance migrations are deterministic and contain immutable evidence guards', async () => {
  const migrations = await loadGovernancePostgresMigrations();
  assert.deepEqual(migrations.map((item) => item.version), ['0001_create_governance_evidence']);
  const sql = migrations[0].sql;
  assert.match(sql, /review_decisions/);
  assert.match(sql, /snapshot_envelopes/);
  assert.match(sql, /review_decisions_reviewer_revision_uq/);
  assert.match(sql, /reject_evidence_mutation/);
  assert.match(sql, /right\(snapshot_id, 12\) = left\(digest, 12\)/);
});
