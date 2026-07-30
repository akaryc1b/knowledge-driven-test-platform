import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalDigest,
  classifyM2ExternalEvidenceInput,
  loadM2ExternalEvidenceIntake,
  validateM2ExternalEvidenceIntake,
} from '../../../scripts/validate-m2-external-evidence-intake.js';

const SOURCE_SHA = '6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7';
const IMAGE_DIGEST = 'sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13';
const DEPLOYMENT_DIGEST = 'sha256:fb2cb10f42f8d3473c1997c514ec11eb66bfb06f7542c3404c328c39f8763a45';
const BINDING = Object.freeze({
  releaseId: 'M2-RC1',
  version: '0.12.0',
  sourceSha: SOURCE_SHA,
  imageDigest: IMAGE_DIGEST,
  deploymentManifestDigest: DEPLOYMENT_DIGEST,
});
const OPEN_BLOCKERS = [
  'production-secrets-not-configured',
  'target-cluster-validation-not-run',
  'change-approval-missing',
  'release-owner-approval-missing',
];

function entry(schemaVersion, status, payload, verification, providedAt = '2026-07-30T02:45:00.000Z') {
  return {
    schemaVersion,
    status,
    providedAt: payload === null && status === 'NOT_PROVIDED' ? null : providedAt,
    submissionDigest: payload === null && status === 'NOT_PROVIDED'
      ? null
      : payload === null
        ? 'sha256:4ec9b7d40c580445ec72d38d1c46fcae55ead53cf91547f997ddde6eebd68b09'
        : canonicalDigest(payload),
    payload,
    verification,
  };
}

function notRunVerification(reasonCode = 'AWAITING_EXTERNAL_VERIFICATION') {
  return {
    result: 'NOT_RUN',
    method: null,
    sourceSystem: null,
    externalRecordId: null,
    verifiedAt: null,
    reasonCode,
  };
}

function passedVerification(kind, externalRecordId) {
  const method = {
    productionSecrets: 'SECRET_PROVIDER_METADATA_READ',
    targetClusterValidation: 'KUBERNETES_READ_ONLY_AND_SERVER_SIDE_DRY_RUN',
    changeApproval: 'CHANGE_APPROVAL_SYSTEM_QUERY',
    releaseOwnerApproval: 'RELEASE_OWNER_APPROVAL_SYSTEM_QUERY',
  }[kind];
  return {
    result: 'PASSED',
    method,
    sourceSystem: `${kind}-control-plane`,
    externalRecordId,
    verifiedAt: '2026-07-30T02:50:00.000Z',
    reasonCode: null,
  };
}

function failedVerification(kind, reasonCode = 'VERIFICATION_FAILED') {
  const verification = passedVerification(kind, `${kind}-rejection-0042`);
  return { ...verification, result: 'FAILED', reasonCode };
}

function commonPayload(verificationRecordId) {
  return {
    releaseId: 'M2-RC1',
    version: '0.12.0',
    sourceSha: SOURCE_SHA,
    imageDigest: IMAGE_DIGEST,
    verificationRecordId,
  };
}

function secretPayload() {
  return {
    ...commonPayload('gsm-verification-20260730-0042'),
    provider: 'gcp-secret-manager',
    references: [{
      logicalName: 'database-connection',
      versionedReference: 'projects/kdtp-production/secrets/database-connection/versions/42',
      externalResourceId: 'projects/kdtp-production/secrets/database-connection',
    }],
    configuredAt: '2026-07-30T02:40:00.000Z',
  };
}

function clusterPayload() {
  return {
    ...commonPayload('cluster-validation-run-30510000001'),
    deploymentManifestDigest: DEPLOYMENT_DIGEST,
    clusterRef: 'cluster:kdtp-production-us-east-1',
    kubernetesServerVersion: 'v1.31.7',
    namespaceRef: 'namespace:kdtp-system',
    validationWorkflowRunId: 30510000001,
    apiDiscoveryDigest: 'sha256:29978ad7b66df51bd3fe82a04f93fdc3e9cdf33690ee97acb88e188bd9b7990f',
    serverSideDryRunDigest: 'sha256:76ae1a4e78127f26525b92aaef60253898f712a3f7d6c01e2924fbe5f72c813b',
    admissionCompatibilityDigest: 'sha256:61f945ae8c1ee3f2c749fc451939fdf092b5a2ef8b334d34f1bb3281c4dfb075',
    dependencyReadDigest: 'sha256:18b8a127d86d7d604ab81586ef95b65f93d1ac695b0d368171c4ec36da46294c',
    permissionEvaluationDigest: 'sha256:7566e60de5177fc4cd5d03a62e52bb34b859067be6f25b11c00ff90d0bd34eb6',
    nodeArchitectureDigest: 'sha256:3fb97d77087ad743695cbe4a8b8e141942cdfc4eb6e8e9ae9849b7448564aa48',
    validatedAt: '2026-07-30T02:44:00.000Z',
  };
}

function changeApprovalPayload() {
  return {
    ...commonPayload('change-query-CHG-2026-004281'),
    system: 'enterprise-change-management',
    approvalId: 'CHG-2026-004281',
    scope: 'M2-RC1 0.12.0 production promotion evidence',
    status: 'APPROVED',
    approvedAt: '2026-07-30T02:42:00.000Z',
  };
}

function releaseOwnerPayload() {
  return {
    ...commonPayload('release-owner-query-REL-2026-000119'),
    system: 'enterprise-release-governance',
    ownerRef: 'release-owner:platform-production',
    approvalId: 'REL-2026-000119',
    status: 'APPROVED',
    approvedAt: '2026-07-30T02:43:00.000Z',
  };
}

test('R2-A repository intake is fail-closed and keeps all external blockers open', async () => {
  const evidence = await validateM2ExternalEvidenceIntake({
    generatedAt: '2026-07-30T02:55:00.000Z',
    commitSha: 'local',
    branch: 'agent/m2-rc1-r2a-external-evidence-intake',
  });
  assert.equal(evidence.schemaVersion, 'm2-r2a-external-evidence-intake-evidence/v1');
  assert.deepEqual(evidence.statuses, {
    productionSecrets: 'NOT_PROVIDED',
    targetClusterValidation: 'NOT_PROVIDED',
    changeApproval: 'NOT_PROVIDED',
    releaseOwnerApproval: 'NOT_PROVIDED',
  });
  assert.deepEqual(evidence.decision.openBlockers, OPEN_BLOCKERS);
  assert.equal(evidence.decision.promotionMutationAllowed, false);
  assert.equal(evidence.decision.productionEligible, false);
  assert.equal(evidence.safetyBoundary.secretCreated, false);
  assert.equal(evidence.safetyBoundary.targetClusterAccessed, false);
});

test('R2-A distinguishes format-valid but unverified evidence', () => {
  const payload = clusterPayload();
  const record = entry(
    'm2-target-cluster-validation-input/v1',
    'PROVIDED_UNVERIFIED',
    payload,
    notRunVerification(),
  );
  assert.equal(classifyM2ExternalEvidenceInput('targetClusterValidation', record, BINDING),
    'PROVIDED_UNVERIFIED');
});

test('R2-A distinguishes verified evidence without mutating Promotion', () => {
  const payload = changeApprovalPayload();
  const record = entry(
    'm2-change-approval-input/v1',
    'VERIFIED',
    payload,
    passedVerification('changeApproval', payload.verificationRecordId),
  );
  assert.equal(classifyM2ExternalEvidenceInput('changeApproval', record, BINDING), 'VERIFIED');
});

test('R2-A distinguishes rejected evidence and stores only safe metadata when payload is omitted', () => {
  const record = entry(
    'm2-release-owner-approval-input/v1',
    'REJECTED',
    null,
    failedVerification('releaseOwnerApproval'),
  );
  assert.equal(classifyM2ExternalEvidenceInput('releaseOwnerApproval', record, BINDING), 'REJECTED');
});

test('R2-A rejects placeholders and mutable Secret references', () => {
  const placeholder = secretPayload();
  placeholder.references[0].externalResourceId = 'example-secret-resource';
  const record = entry(
    'm2-production-secret-references-input/v1',
    'PROVIDED_UNVERIFIED',
    placeholder,
    notRunVerification(),
  );
  assert.throws(
    () => classifyM2ExternalEvidenceInput('productionSecrets', record, BINDING),
    /placeholder/,
  );

  const mutable = secretPayload();
  mutable.references[0].versionedReference = 'projects/kdtp-production/secrets/database-connection/versions/latest';
  const mutableRecord = entry(
    'm2-production-secret-references-input/v1',
    'PROVIDED_UNVERIFIED',
    mutable,
    notRunVerification(),
  );
  assert.throws(
    () => classifyM2ExternalEvidenceInput('productionSecrets', mutableRecord, BINDING),
    /latest|versioned/,
  );
});

test('R2-A rejects sensitive material before evidence persistence', () => {
  const leaked = secretPayload();
  const sensitiveKey = ['pass', 'word'].join('');
  leaked[sensitiveKey] = ['do', 'not', 'store', 'fixture'].join('-');
  const record = entry(
    'm2-production-secret-references-input/v1',
    'PROVIDED_UNVERIFIED',
    leaked,
    notRunVerification(),
  );
  assert.throws(
    () => classifyM2ExternalEvidenceInput('productionSecrets', record, BINDING),
    /sensitive material/,
  );
});

test('R2-A rejects invalid timestamps and external verification ID mismatches', () => {
  const invalidTime = changeApprovalPayload();
  invalidTime.approvedAt = '2026-07-30 02:42:00';
  const invalidTimeRecord = entry(
    'm2-change-approval-input/v1',
    'PROVIDED_UNVERIFIED',
    invalidTime,
    notRunVerification(),
  );
  assert.throws(
    () => classifyM2ExternalEvidenceInput('changeApproval', invalidTimeRecord, BINDING),
    /approvedAt is invalid/,
  );

  const verified = changeApprovalPayload();
  const mismatchRecord = entry(
    'm2-change-approval-input/v1',
    'VERIFIED',
    verified,
    passedVerification('changeApproval', 'different-external-record-0042'),
  );
  assert.throws(
    () => classifyM2ExternalEvidenceInput('changeApproval', mismatchRecord, BINDING),
    /external verification ID mismatch/,
  );
});

test('R2-A rejects incorrect source bindings and fabricated repeated digests', () => {
  const wrongSource = releaseOwnerPayload();
  wrongSource.sourceSha = 'ebfa1a16f95146b48f11934aecc3d41bcd605f57';
  const wrongSourceRecord = entry(
    'm2-release-owner-approval-input/v1',
    'PROVIDED_UNVERIFIED',
    wrongSource,
    notRunVerification(),
  );
  assert.throws(
    () => classifyM2ExternalEvidenceInput('releaseOwnerApproval', wrongSourceRecord, BINDING),
    /source SHA binding mismatch/,
  );

  const fabricated = clusterPayload();
  fabricated.apiDiscoveryDigest = `sha256:${'a'.repeat(64)}`;
  const fabricatedRecord = entry(
    'm2-target-cluster-validation-input/v1',
    'PROVIDED_UNVERIFIED',
    fabricated,
    notRunVerification(),
  );
  assert.throws(
    () => classifyM2ExternalEvidenceInput('targetClusterValidation', fabricatedRecord, BINDING),
    /placeholder digest/,
  );
});

test('R2-A rejects premature production eligibility or blocker closure', async () => {
  const intake = await loadM2ExternalEvidenceIntake();
  const promotion = JSON.parse(await import('node:fs/promises').then(({ readFile }) =>
    readFile('releases/m2/production-promotion.json', 'utf8')));
  promotion.decision.productionEligible = true;
  await assert.rejects(
    validateM2ExternalEvidenceIntake({
      intake,
      promotion,
      generatedAt: '2026-07-30T02:55:00.000Z',
      commitSha: 'local',
      branch: 'agent/m2-rc1-r2a-external-evidence-intake',
    }),
    /cannot make the release production eligible/,
  );
});
