import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '@kdtp/knowledge-core';
import {
  createM3R3P4Evidence,
  loadM3R3P4RepositoryFiles,
  P4_ARTIFACT_PATHS,
  P4_EVIDENCE_SCHEMA_PATH,
  validateM3R3P4EvidenceDocument,
  validateM3R3P4Repository,
} from '../../../scripts/validate-m3-r3-p4-fault-security-compatibility.js';

function cloneFiles(files) {
  return { ...files };
}

function acceptedTestResults() {
  const productDigest = 'b'.repeat(64);
  return {
    focused: { total: 1, passed: 1, failed: 0 },
    allK6ApiAdapter: { total: 1, passed: 1, failed: 0 },
    fullNode: { total: 2, passed: 1, skipped: 1, failed: 0 },
    node22Compatibility: {
      total: 1, passed: 1, failed: 0, productDigest,
    },
    node24Compatibility: {
      total: 1, passed: 1, failed: 0, productDigest,
    },
    repositoryValidator: { status: 'success' },
    predecessorValidators: {
      status: 'success',
      validators: [
        'validate:m3-r3-p3-sanitized-runtime-result',
        'validate:m3-r3-p2-bounded-process-lifecycle',
        'validate:m3-r3-p1-local-process-boundary',
        'validate:m3-r3-runtime-admission',
        'validate:m3-r2-source-generation-p5',
        'validate:m3-r1-k6-api-spec-compiler',
        'validate:m3-r0-execution-contracts',
        'validate:m2-final-release-closure',
        'validate:m2-portable-release-readiness',
        'validate:m2-r2a-external-evidence-intake',
      ],
    },
  };
}

test('P4 Repository Validator accepts the complete permanent acceptance slice', async () => {
  const result = await validateM3R3P4Repository();
  assert.equal(result.status, 'success');
  assert.equal(result.artifactPathCount, 23);
  assert.equal(P4_ARTIFACT_PATHS.length, 23);
  assert.match(result.p4SchemaCatalogDigest, /^[a-f0-9]{64}$/u);
});

test('P4 Repository Validator rejects workflow write permission', async () => {
  const files = await loadM3R3P4RepositoryFiles();
  const forged = cloneFiles(files);
  const path = '.github/workflows/m3-r3-p4-fault-security-compatibility-acceptance.yml';
  forged[path] = forged[path].replace('contents: read', 'contents: write');
  await assert.rejects(() => validateM3R3P4Repository({ files: forged }),
    /Workflow contains forbidden token|Workflow missing/u);
});

test('P4 Repository Validator rejects removal from the root Validator chain', async () => {
  const files = await loadM3R3P4RepositoryFiles();
  const forged = cloneFiles(files);
  forged['package.json'] = forged['package.json'].replace(
    ' && node scripts/validate-m3-r3-p4-fault-security-compatibility.js', '');
  await assert.rejects(() => validateM3R3P4Repository({ files: forged }),
    /Root Validator missing or reordered/u);
});

test('P4 Repository Validator rejects a second process primitive', async () => {
  const files = await loadM3R3P4RepositoryFiles();
  const forged = cloneFiles(files);
  const path = 'packages/k6-api-adapter/src/node-process-adapter.js';
  forged[path] += '\nfunction forbidden() { return exec("k6"); }\n';
  await assert.rejects(() => validateM3R3P4Repository({ files: forged }),
    /forbidden process primitive/u);
});

test('P4 Repository Validator rejects accepted P3 Schema Catalog drift', async () => {
  const files = await loadM3R3P4RepositoryFiles();
  const forged = cloneFiles(files);
  const path = 'schemas/execution/k6-api-runtime/p3-schema-catalog.json';
  const catalog = JSON.parse(forged[path]);
  catalog.schemaVersion = 'forged-p3-catalog/v1';
  forged[path] = JSON.stringify(catalog, null, 2);
  await assert.rejects(() => validateM3R3P4Repository({ files: forged }),
    /Schema Catalog is invalid/u);
});

test('P4 Repository Validator rejects G1 start or merge-control widening', async () => {
  const files = await loadM3R3P4RepositoryFiles();
  const forged = cloneFiles(files);
  const path = 'docs/04-governance/m3-r3-p4-exact-head-acceptance.md';
  forged[path] = forged[path].replaceAll(
    'm3R3G1Started=false', 'm3R3G1Started=true');
  await assert.rejects(() => validateM3R3P4Repository({ files: forged }),
    /exact-Head record missing merge control/u);
});

test('P4 Evidence is closed, digest-bound and keeps Ready, merge and G1 false', async () => {
  const files = await loadM3R3P4RepositoryFiles();
  const evidence = await createM3R3P4Evidence({
    files,
    generatedAt: '2026-08-05T08:00:00.000Z',
    commitSha: 'a'.repeat(40),
    branch: 'agent/m3-r3-p4-fault-security-compatibility-acceptance',
    testResults: acceptedTestResults(),
  });
  const schema = JSON.parse(files[P4_EVIDENCE_SCHEMA_PATH]);
  assert.equal(validateM3R3P4EvidenceDocument(evidence, schema), true);
  assert.equal(evidence.decision.m3R3P4ReadyMarked, false);
  assert.equal(evidence.decision.m3R3P4Merged, false);
  assert.equal(evidence.decision.m3R3G1Started, false);
  assert.equal(evidence.decision.nextRequiredSlice, 'M3-R3-G1');
  assert.deepEqual(evidence.decision.repositoryBlockers, []);
  assert.equal(evidence.runtimeFindings.length, 2);
  assert.equal(evidence.runtimeFindings.every((finding) => finding.status === 'CLOSED'), true);
});

test('P4 Evidence rejects a self-redigested Ready decision forgery', async () => {
  const files = await loadM3R3P4RepositoryFiles();
  const schema = JSON.parse(files[P4_EVIDENCE_SCHEMA_PATH]);
  const evidence = await createM3R3P4Evidence({
    files,
    generatedAt: '2026-08-05T08:00:00.000Z',
    commitSha: 'a'.repeat(40),
    branch: 'agent/m3-r3-p4-fault-security-compatibility-acceptance',
    testResults: acceptedTestResults(),
  });
  const forged = structuredClone(evidence);
  forged.decision.m3R3P4ReadyMarked = true;
  const claims = structuredClone(forged);
  delete claims.evidenceDigest;
  forged.evidenceDigest = sha256(claims);
  assert.throws(() => validateM3R3P4EvidenceDocument(forged, schema),
    /merge control mismatch/u);
});
