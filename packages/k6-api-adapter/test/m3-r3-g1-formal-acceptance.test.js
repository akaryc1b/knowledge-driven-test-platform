import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '@kdtp/knowledge-core';
import {
  ACCEPTED_BASE_MAIN,
  ACCEPTED_P4,
  G1_EVIDENCE_SCHEMA_PATH,
  G1_PREDECESSOR_VALIDATORS,
  G1_SCOPE_MANIFEST_PATH,
  G1_WORKFLOW_PATH,
} from '../../../scripts/m3-r3-g1/constants.js';
import {
  validateG1RootValidatorPackage,
} from '../../../scripts/validate-m3-r3-g1-formal-acceptance.js';
import {
  createM3R3G1Evidence,
  validateM3R3G1EvidenceDocument,
} from '../../../scripts/m3-r3-g1/evidence.js';
import {
  loadM3R3G1RepositoryFiles,
  validateM3R3G1Repository,
} from '../../../scripts/m3-r3-g1/repository-validator.js';

function redigest(evidence) {
  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  evidence.evidenceDigest = sha256(claims);
  return evidence;
}

function acceptedResults() {
  return {
    focused: { total: 7, passed: 7, failed: 0 },
    allK6ApiAdapter: { total: 1, passed: 1, failed: 0 },
    fullNode: { total: 1, passed: 1, skipped: 0, failed: 0 },
    node22Compatibility: {
      total: 8, passed: 8, failed: 0,
      productDigest: ACCEPTED_P4.compatibilityProductDigest,
    },
    node24Compatibility: {
      total: 8, passed: 8, failed: 0,
      productDigest: ACCEPTED_P4.compatibilityProductDigest,
    },
    repositoryValidator: { status: 'success' },
    g1Validator: { status: 'success' },
    predecessorValidators: {
      status: 'success',
      validators: [...G1_PREDECESSOR_VALIDATORS],
    },
  };
}

async function acceptedEvidence(files) {
  const repository = await validateM3R3G1Repository({ files });
  return createM3R3G1Evidence({
    files,
    generatedAt: '2026-08-06T01:00:00.000Z',
    eventName: 'pull_request',
    branch: 'agent/m3-r3-p4-fault-security-compatibility-acceptance',
    baseSha: ACCEPTED_BASE_MAIN,
    commitSha: 'a'.repeat(40),
    testResults: acceptedResults(),
    scopeAudit: {
      manifestPath: G1_SCOPE_MANIFEST_PATH,
      manifestDigest: repository.scopeManifestDigest,
      pathCount: 45,
      commitCount: 17,
      baseMain: ACCEPTED_BASE_MAIN,
      exactDiffMatched: true,
    },
  });
}

test('G1 repository contract accepts the current formal-acceptance files',
  async () => {
    const result = await validateM3R3G1Repository();
    assert.equal(result.status, 'success');
    assert.equal(result.acceptedP4Head, ACCEPTED_P4.headSha);
    assert.equal(result.scopePathCount, 45);
    assert.equal(result.artifactPathCount, 16);
  });

test('G1 Evidence binds accepted P4, exact scope and closed merge control',
  async () => {
    const files = await loadM3R3G1RepositoryFiles();
    const evidence = await acceptedEvidence(files);
    const schema = JSON.parse(files[G1_EVIDENCE_SCHEMA_PATH]);
    assert.equal(validateM3R3G1EvidenceDocument(evidence, schema), true);
    assert.deepEqual(evidence.acceptedP4, ACCEPTED_P4);
    assert.equal(evidence.decision.readyMarked, false);
    assert.equal(evidence.decision.merged, false);
    assert.equal(evidence.decision.g2Started, false);
  });

test('G1 rejects a re-digested Ready forgery', async () => {
  const files = await loadM3R3G1RepositoryFiles();
  const evidence = await acceptedEvidence(files);
  evidence.decision.readyMarked = true;
  redigest(evidence);
  assert.throws(() => validateM3R3G1EvidenceDocument(
    evidence, JSON.parse(files[G1_EVIDENCE_SCHEMA_PATH])),
  /merge control mismatch/u);
});

test('G1 rejects substituted accepted P4 identity after re-digest',
  async () => {
    const files = await loadM3R3G1RepositoryFiles();
    const evidence = await acceptedEvidence(files);
    evidence.acceptedP4.artifactId += 1;
    redigest(evidence);
    assert.throws(() => validateM3R3G1EvidenceDocument(
      evidence, JSON.parse(files[G1_EVIDENCE_SCHEMA_PATH])),
    /accepted P4 identity changed/u);
  });

test('G1 Evidence rejects invalid date-time after re-digest', async () => {
  const files = await loadM3R3G1RepositoryFiles();
  const evidence = await acceptedEvidence(files);
  evidence.generatedAt = 'not-a-date';
  redigest(evidence);
  assert.throws(() => validateM3R3G1EvidenceDocument(
    evidence, JSON.parse(files[G1_EVIDENCE_SCHEMA_PATH])),
  /Schema date-time mismatch/u);
});

test('G1 Evidence rejects an unexpected nested property after re-digest',
  async () => {
    const files = await loadM3R3G1RepositoryFiles();
    const evidence = await acceptedEvidence(files);
    evidence.acceptance.unexpected = true;
    redigest(evidence);
    assert.throws(() => validateM3R3G1EvidenceDocument(
      evidence, JSON.parse(files[G1_EVIDENCE_SCHEMA_PATH])),
    /Schema additional property/u);
  });

test('G1 Evidence executes local refs for nested closed contracts', async () => {
  const files = await loadM3R3G1RepositoryFiles();
  const evidence = await acceptedEvidence(files);
  evidence.testResults.focused.unexpected = true;
  redigest(evidence);
  assert.throws(() => validateM3R3G1EvidenceDocument(
    evidence, JSON.parse(files[G1_EVIDENCE_SCHEMA_PATH])),
  /Schema additional property/u);
});

test('G1 repository Validator rejects write-capable Workflow permissions',
  async () => {
    const files = await loadM3R3G1RepositoryFiles();
    const forged = { ...files,
      [G1_WORKFLOW_PATH]:
        files[G1_WORKFLOW_PATH].replace('contents: read', 'contents: write') };
    await assert.rejects(
      validateM3R3G1Repository({ files: forged }),
      /forbidden token|Workflow missing/u,
    );
  });

test('G1 Repository Validator rejects a missing root G1 Validator binding',
  async () => {
    const files = await loadM3R3G1RepositoryFiles();
    const pkg = JSON.parse(files['package.json']);
    delete pkg.scripts['validate:m3-r3-g1-formal-acceptance'];
    pkg.scripts.validate = pkg.scripts.validate.replace(
      ' && node scripts/validate-m3-r3-g1-formal-acceptance.js',
      '',
    );
    assert.throws(
      () => validateG1RootValidatorPackage(`${JSON.stringify(pkg, null, 2)}\n`),
      /explicit Validator script is missing|root Validator missing or reordered/u,
    );
  });

test('G1 repository Validator rejects an unauthorized scope path',
  async () => {
    const files = await loadM3R3G1RepositoryFiles();
    const manifest = JSON.parse(files[G1_SCOPE_MANIFEST_PATH]);
    manifest.paths.push('outside-scope.txt');
    manifest.paths.sort();
    manifest.pathCount = manifest.paths.length;
    const forged = {
      ...files,
      [G1_SCOPE_MANIFEST_PATH]: `${JSON.stringify(manifest, null, 2)}\n`,
      'outside-scope.txt': 'forged\n',
    };
    await assert.rejects(
      validateM3R3G1Repository({ files: forged }),
      /scope manifest identity|unauthorized path/u,
    );
  });
