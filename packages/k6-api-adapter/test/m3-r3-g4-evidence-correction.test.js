import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '@kdtp/knowledge-core';
import { collectM2MainBranchCiEvidence } from '../../../scripts/collect-m2-main-branch-ci-evidence.js';
import {
  C1_ARTIFACT_PATHS,
  C1_SCHEMA_PATH,
  createM3R3G4C1Evidence,
  loadM3R3G4C1RepositoryFiles,
  validateM3R3G4C1EvidenceDocument,
  validateM3R3G4C1Repository,
} from '../../../scripts/m3-r3-g4-correction/contract.js';

function redigest(evidence) {
  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  evidence.evidenceDigest = sha256(claims);
  return evidence;
}

async function acceptedEvidence(files) {
  return createM3R3G4C1Evidence({
    files,
    generatedAt: '2026-08-06T13:00:00.000Z',
    eventName: 'pull_request',
    branch: 'agent/m3-r3-g4-p4-evidence-correction-583e848',
    commitSha: 'a'.repeat(40),
    validation: {
      focusedStatus: 'success',
      rootValidationStatus: 'success',
      correctionValidatorStatus: 'success',
    },
  });
}

test('M3-R3-G4-C1 repository contract accepts the minimal correction slice',
  async () => {
    const result = await validateM3R3G4C1Repository();
    assert.equal(result.status, 'success');
    assert.equal(result.artifactPathCount, 19);
    assert.equal(C1_ARTIFACT_PATHS.length, 19);
  });

test('M3-R3-G4-C1 binds the historical main-run query to the exact SHA',
  async () => {
    const sourceSha = '991b5f0f9cfa3a382f9aff3c600f98b76aed9c08';
    let requestedUrl = null;
    await assert.rejects(
      collectM2MainBranchCiEvidence({
        promotion: {
          releaseId: 'M2-RC1',
          version: '0.12.0',
          promotionSource: { mainSha: sourceSha },
        },
        collectedAt: '2026-08-06T13:00:00.000Z',
        credential: '',
        fetchImpl: async (url) => {
          requestedUrl = url;
          return {
            ok: true,
            status: 200,
            async json() { return { workflow_runs: [] }; },
          };
        },
      }),
      /completed main push validation run, found 0/u,
    );
    assert.equal(typeof requestedUrl, 'string');
    const request = new URL(requestedUrl);
    assert.equal(request.searchParams.get('branch'), 'main');
    assert.equal(request.searchParams.get('event'), 'push');
    assert.equal(request.searchParams.get('status'), 'completed');
    assert.equal(request.searchParams.get('head_sha'), sourceSha);
    assert.equal(request.searchParams.get('per_page'), '100');
  });

test('M3-R3-G4-C1 Evidence is closed and digest-bound', async () => {
  const files = await loadM3R3G4C1RepositoryFiles();
  const evidence = await acceptedEvidence(files);
  const schema = JSON.parse(files[C1_SCHEMA_PATH]);
  assert.equal(validateM3R3G4C1EvidenceDocument(evidence, schema), true);
  assert.equal(evidence.corrections.p4HistoricalEvidenceEmissionRestricted, true);
  assert.equal(evidence.corrections.g1ClosedSchemaValidationComplete, true);
  assert.equal(evidence.historicalEvidence.p4EvidenceRewritten, false);
  assert.equal(evidence.historicalEvidence.g1EvidenceRewritten, false);
});

test('M3-R3-G4-C1 Evidence rejects nested contract widening', async () => {
  const files = await loadM3R3G4C1RepositoryFiles();
  const evidence = await acceptedEvidence(files);
  evidence.corrections.unexpected = true;
  redigest(evidence);
  assert.throws(() => validateM3R3G4C1EvidenceDocument(
    evidence, JSON.parse(files[C1_SCHEMA_PATH])),
  /Schema additional property/u);
});

test('M3-R3-G4-C1 Evidence rejects a disabled correction after re-digest',
  async () => {
    const files = await loadM3R3G4C1RepositoryFiles();
    const evidence = await acceptedEvidence(files);
    evidence.corrections.p4HistoricalEvidenceEmissionRestricted = false;
    redigest(evidence);
    assert.throws(() => validateM3R3G4C1EvidenceDocument(
      evidence, JSON.parse(files[C1_SCHEMA_PATH])),
    /Schema const mismatch|correction is incomplete/u);
  });

test('M3-R3-G4-C1 Evidence rejects invalid date-time', async () => {
  const files = await loadM3R3G4C1RepositoryFiles();
  const evidence = await acceptedEvidence(files);
  evidence.generatedAt = 'invalid';
  redigest(evidence);
  assert.throws(() => validateM3R3G4C1EvidenceDocument(
    evidence, JSON.parse(files[C1_SCHEMA_PATH])),
  /Schema date-time mismatch/u);
});
