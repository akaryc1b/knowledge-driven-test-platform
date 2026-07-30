import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const M2_EXTERNAL_EVIDENCE_INTAKE_SCHEMA_VERSION = 'm2-external-evidence-intake/v1';
export const M2_R2A_EVIDENCE_SCHEMA_VERSION = 'm2-r2a-external-evidence-intake-evidence/v1';
export const M2_EXTERNAL_EVIDENCE_STATUSES = Object.freeze([
  'NOT_PROVIDED',
  'PROVIDED_UNVERIFIED',
  'VERIFIED',
  'REJECTED',
]);
export const M2_SECRET_PROVIDERS = Object.freeze([
  'aws-secrets-manager',
  'azure-key-vault',
  'gcp-secret-manager',
  'hashicorp-vault',
  'kubernetes-external-secrets',
]);

const ROOT = process.cwd();
const INTAKE_PATH = join(ROOT, 'releases/m2/r2a-external-evidence-intake.json');
const PROMOTION_PATH = join(ROOT, 'releases/m2/production-promotion.json');
const R1B_BINDING_PATH = join(ROOT, 'releases/m2/r1b-image-binding.json');
const DEPLOYMENT_PATH = join(ROOT, 'deploy/kubernetes/read-only-governance-service/deployment.yaml');

const R2A_BASE_SHA = 'ebfa1a16f95146b48f11934aecc3d41bcd605f57';
const RELEASE_SOURCE_SHA = '6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7';
const REGISTRY_DIGEST = 'sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13';
const DEPLOYMENT_MANIFEST_DIGEST = 'sha256:fb2cb10f42f8d3473c1997c514ec11eb66bfb06f7542c3404c328c39f8763a45';
const IMMUTABLE_IMAGE = `ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service@${REGISTRY_DIGEST}`;
const INPUT_KINDS = Object.freeze([
  'productionSecrets',
  'targetClusterValidation',
  'changeApproval',
  'releaseOwnerApproval',
]);
const ENTRY_SCHEMA_BY_KIND = Object.freeze({
  productionSecrets: 'm2-production-secret-references-input/v1',
  targetClusterValidation: 'm2-target-cluster-validation-input/v1',
  changeApproval: 'm2-change-approval-input/v1',
  releaseOwnerApproval: 'm2-release-owner-approval-input/v1',
});
const VERIFICATION_METHOD_BY_KIND = Object.freeze({
  productionSecrets: 'SECRET_PROVIDER_METADATA_READ',
  targetClusterValidation: 'KUBERNETES_READ_ONLY_AND_SERVER_SIDE_DRY_RUN',
  changeApproval: 'CHANGE_APPROVAL_SYSTEM_QUERY',
  releaseOwnerApproval: 'RELEASE_OWNER_APPROVAL_SYSTEM_QUERY',
});
const BLOCKER_BY_KIND = Object.freeze({
  productionSecrets: 'production-secrets-not-configured',
  targetClusterValidation: 'target-cluster-validation-not-run',
  changeApproval: 'change-approval-missing',
  releaseOwnerApproval: 'release-owner-approval-missing',
});
const EXPECTED_RESOLVED_BLOCKERS = Object.freeze([
  'main-branch-final-ci-not-verified',
  'external-registry-digest-missing',
]);
const EXPECTED_OPEN_BLOCKERS = Object.freeze(INPUT_KINDS.map((kind) => BLOCKER_BY_KIND[kind]));
const REJECTION_REASON_CODES = new Set([
  'PLACEHOLDER_DETECTED',
  'FORMAT_INVALID',
  'SENSITIVE_MATERIAL',
  'EXTERNAL_ID_MISMATCH',
  'TIMESTAMP_INVALID',
  'BINDING_MISMATCH',
  'VERIFICATION_FAILED',
]);
const PLACEHOLDER_PATTERN = /(?:example|placeholder|sample|dummy|fake|todo|tbd|changeme|replace[-_ ]?me|not[-_ ]?set|unknown)/i;

export async function loadM2ExternalEvidenceIntake(path = INTAKE_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateM2ExternalEvidenceIntake(options = {}) {
  const intake = options.intake ?? await loadM2ExternalEvidenceIntake(options.path);
  const promotion = options.promotion
    ?? JSON.parse(await readFile(options.promotionPath ?? PROMOTION_PATH, 'utf8'));
  const r1bBinding = options.r1bBinding
    ?? JSON.parse(await readFile(options.r1bBindingPath ?? R1B_BINDING_PATH, 'utf8'));
  const deployment = options.deployment
    ?? JSON.parse(await readFile(options.deploymentPath ?? DEPLOYMENT_PATH, 'utf8'));

  assertObject(intake, 'R2-A external evidence intake');
  assertExactKeys(intake, [
    'schemaVersion',
    'releaseId',
    'version',
    'contractBaseSha',
    'releaseSourceSha',
    'immutableImageDigest',
    'deploymentManifestDigest',
    'inputs',
  ], 'R2-A external evidence intake');
  assert(intake.schemaVersion === M2_EXTERNAL_EVIDENCE_INTAKE_SCHEMA_VERSION,
    'R2-A external evidence intake schemaVersion is invalid');
  assert(intake.releaseId === 'M2-RC1', 'R2-A releaseId must be M2-RC1');
  assert(intake.version === '0.12.0', 'R2-A version must be 0.12.0');
  assert(intake.contractBaseSha === R2A_BASE_SHA, 'R2-A contract base SHA changed');
  assertNotPlaceholderSha(intake.contractBaseSha, 'R2-A contract base SHA');
  assert(intake.releaseSourceSha === RELEASE_SOURCE_SHA, 'R2-A release source SHA changed');
  assertNotPlaceholderSha(intake.releaseSourceSha, 'R2-A release source SHA');
  assert(intake.immutableImageDigest === REGISTRY_DIGEST, 'R2-A immutable image digest changed');
  assert(intake.deploymentManifestDigest === DEPLOYMENT_MANIFEST_DIGEST,
    'R2-A Deployment manifest digest changed');
  assertArtifactDigest(intake.immutableImageDigest, 'R2-A immutable image digest');
  assertArtifactDigest(intake.deploymentManifestDigest, 'R2-A Deployment manifest digest');

  assertR1BBinding(r1bBinding, intake);
  assertImmutableDeployment(deployment);
  assertPromotionRemainsR2ABlocked(promotion);
  assertObject(intake.inputs, 'R2-A external evidence inputs');
  assertExactKeys(intake.inputs, INPUT_KINDS, 'R2-A external evidence inputs');

  const binding = {
    releaseId: intake.releaseId,
    version: intake.version,
    sourceSha: intake.releaseSourceSha,
    imageDigest: intake.immutableImageDigest,
    deploymentManifestDigest: intake.deploymentManifestDigest,
  };
  const statuses = {};
  for (const kind of INPUT_KINDS) {
    statuses[kind] = classifyM2ExternalEvidenceInput(kind, intake.inputs[kind], binding);
  }

  if (options.enforceR2ABaseline !== false) {
    for (const kind of INPUT_KINDS) {
      assert(statuses[kind] === 'NOT_PROVIDED',
        `R2-A repository intake must keep ${kind} at NOT_PROVIDED`);
    }
  }

  assertNoSensitiveMaterial(intake);
  const generatedAt = normalizeTimestamp(options.generatedAt ?? new Date().toISOString(), 'R2-A generatedAt');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || isSha(commitSha), 'R2-A evidence commit SHA is invalid');
  if (commitSha !== 'local') assertNotPlaceholderSha(commitSha, 'R2-A evidence commit SHA');
  const branch = options.branch
    ?? process.env.GITHUB_HEAD_REF
    ?? process.env.GITHUB_REF_NAME
    ?? 'agent/m2-rc1-r2a-external-evidence-intake';
  assertExternalId(branch, 'R2-A evidence branch');

  const evidence = {
    schemaVersion: M2_R2A_EVIDENCE_SCHEMA_VERSION,
    releaseId: intake.releaseId,
    version: intake.version,
    generatedAt,
    source: { branch, commitSha },
    bindings: {
      contractBaseSha: intake.contractBaseSha,
      releaseSourceSha: intake.releaseSourceSha,
    },
    digests: {
      intake: canonicalDigest(intake),
      productionPromotion: canonicalDigest(promotion),
      r1bImageBinding: canonicalDigest(r1bBinding),
      deploymentManifest: intake.deploymentManifestDigest,
      immutableImage: intake.immutableImageDigest,
    },
    statuses,
    decision: {
      promotionMutationAllowed: false,
      eligibleInputs: INPUT_KINDS.filter((kind) => statuses[kind] === 'VERIFIED'),
      rejectedInputs: INPUT_KINDS.filter((kind) => statuses[kind] === 'REJECTED'),
      resolvedBlockers: [...EXPECTED_RESOLVED_BLOCKERS],
      openBlockers: [...EXPECTED_OPEN_BLOCKERS],
      productionEligible: false,
    },
    safetyBoundary: {
      secretCreated: false,
      targetClusterAccessed: false,
      targetClusterModified: false,
      rolloutExecuted: false,
      approvalCreated: false,
      unverifiedExternalEvidencePresent: INPUT_KINDS.some(
        (kind) => statuses[kind] === 'PROVIDED_UNVERIFIED' || statuses[kind] === 'REJECTED',
      ),
    },
  };
  assertNoSensitiveMaterial(evidence);
  return evidence;
}

export function classifyM2ExternalEvidenceInput(kind, entry, binding) {
  assert(INPUT_KINDS.includes(kind), `Unsupported external evidence input kind: ${kind}`);
  assertObject(binding, 'external evidence binding');
  validateBinding(binding);
  assertObject(entry, `${kind} intake entry`);
  assertExactKeys(entry, [
    'schemaVersion',
    'status',
    'providedAt',
    'submissionDigest',
    'payload',
    'verification',
  ], `${kind} intake entry`);
  assert(entry.schemaVersion === ENTRY_SCHEMA_BY_KIND[kind], `${kind} schemaVersion is invalid`);
  assert(M2_EXTERNAL_EVIDENCE_STATUSES.includes(entry.status), `${kind} status is invalid`);
  assertObject(entry.verification, `${kind} verification`);
  assertExactKeys(entry.verification, [
    'result',
    'method',
    'sourceSystem',
    'externalRecordId',
    'verifiedAt',
    'reasonCode',
  ], `${kind} verification`);
  assertNoSensitiveMaterial(entry);

  if (entry.payload === null) {
    if (entry.status === 'NOT_PROVIDED') {
      assert(entry.providedAt === null && entry.submissionDigest === null,
        `${kind} NOT_PROVIDED cannot contain submission metadata`);
      validateNotRunVerification(entry.verification, kind, 'NOT_PROVIDED');
      return 'NOT_PROVIDED';
    }
    if (entry.status === 'REJECTED') {
      normalizeTimestamp(entry.providedAt, `${kind} providedAt`);
      assertArtifactDigest(entry.submissionDigest, `${kind} rejected submission digest`);
      validateFailedVerification(entry.verification, kind, entry.providedAt);
      return 'REJECTED';
    }
    throw new Error(`${kind} ${entry.status} requires a payload`);
  }

  const providedAt = normalizeTimestamp(entry.providedAt, `${kind} providedAt`);
  assertArtifactDigest(entry.submissionDigest, `${kind} submission digest`);
  assert(entry.submissionDigest === canonicalDigest(entry.payload), `${kind} submission digest mismatch`);

  const result = entry.verification.result;
  if (result === 'NOT_RUN') {
    validatePayload(kind, entry.payload, binding, true);
    validateNotRunVerification(entry.verification, kind, 'AWAITING_EXTERNAL_VERIFICATION');
    assert(entry.status === 'PROVIDED_UNVERIFIED',
      `${kind} NOT_RUN evidence must be PROVIDED_UNVERIFIED`);
    return 'PROVIDED_UNVERIFIED';
  }
  if (result === 'PASSED') {
    validatePayload(kind, entry.payload, binding, true);
    validatePassedVerification(entry.verification, kind, providedAt, entry.payload.verificationRecordId);
    assert(entry.status === 'VERIFIED', `${kind} PASSED evidence must be VERIFIED`);
    return 'VERIFIED';
  }
  if (result === 'FAILED') {
    validatePayload(kind, entry.payload, binding, false);
    validateFailedVerification(entry.verification, kind, providedAt);
    assert(entry.status === 'REJECTED', `${kind} FAILED evidence must be REJECTED`);
    return 'REJECTED';
  }
  throw new Error(`${kind} verification result is invalid`);
}

export function canonicalDigest(value) {
  return `sha256:${createHash('sha256').update(canonicalStringify(value)).digest('hex')}`;
}

function validatePayload(kind, payload, binding, enforceBindings) {
  assertObject(payload, `${kind} payload`);
  if (kind === 'productionSecrets') validateSecretPayload(payload, binding, enforceBindings);
  if (kind === 'targetClusterValidation') validateClusterPayload(payload, binding, enforceBindings);
  if (kind === 'changeApproval') validateChangeApprovalPayload(payload, binding, enforceBindings);
  if (kind === 'releaseOwnerApproval') validateReleaseOwnerApprovalPayload(payload, binding, enforceBindings);
  assertNoSensitiveMaterial(payload);
}

function validateSecretPayload(payload, binding, enforceBindings) {
  assertExactKeys(payload, [
    'releaseId', 'version', 'sourceSha', 'imageDigest', 'provider', 'references',
    'configuredAt', 'verificationRecordId',
  ], 'production Secret payload');
  validateCommonPayloadBinding(payload, binding, enforceBindings);
  assert(M2_SECRET_PROVIDERS.includes(payload.provider), 'Production Secret provider is not allowed');
  assert(Array.isArray(payload.references) && payload.references.length > 0,
    'Production Secret references must be non-empty');
  const names = new Set();
  for (const [index, reference] of payload.references.entries()) {
    assertObject(reference, `Production Secret reference ${index}`);
    assertExactKeys(reference, ['logicalName', 'versionedReference', 'externalResourceId'],
      `Production Secret reference ${index}`);
    assertExternalId(reference.logicalName, `Production Secret reference ${index} logical name`);
    assertExternalId(reference.externalResourceId,
      `Production Secret reference ${index} external resource ID`);
    assertVersionedSecretReference(payload.provider, reference.versionedReference, index);
    assert(!names.has(reference.logicalName), `Production Secret logical name ${reference.logicalName} is duplicated`);
    names.add(reference.logicalName);
  }
  normalizeTimestamp(payload.configuredAt, 'Production Secret configuredAt');
  assertExternalId(payload.verificationRecordId, 'Production Secret verification record ID');
}

function validateClusterPayload(payload, binding, enforceBindings) {
  assertExactKeys(payload, [
    'releaseId', 'version', 'sourceSha', 'imageDigest', 'deploymentManifestDigest',
    'clusterRef', 'kubernetesServerVersion', 'namespaceRef', 'validationWorkflowRunId',
    'apiDiscoveryDigest', 'serverSideDryRunDigest', 'admissionCompatibilityDigest',
    'dependencyReadDigest', 'permissionEvaluationDigest', 'nodeArchitectureDigest',
    'validatedAt', 'verificationRecordId',
  ], 'target cluster validation payload');
  validateCommonPayloadBinding(payload, binding, enforceBindings);
  if (enforceBindings) {
    assert(payload.deploymentManifestDigest === binding.deploymentManifestDigest,
      'Target cluster Deployment manifest digest does not match intake binding');
  }
  assertArtifactDigest(payload.deploymentManifestDigest, 'Target cluster Deployment manifest digest');
  assertExternalId(payload.clusterRef, 'Target cluster reference');
  assert(/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(payload.kubernetesServerVersion),
    'Kubernetes Server Version is invalid');
  assertExternalId(payload.namespaceRef, 'Target cluster namespace reference');
  assertPositiveInteger(payload.validationWorkflowRunId, 'Target cluster validation Workflow Run ID');
  for (const [key, label] of [
    ['apiDiscoveryDigest', 'API discovery digest'],
    ['serverSideDryRunDigest', 'server-side dry-run digest'],
    ['admissionCompatibilityDigest', 'admission compatibility digest'],
    ['dependencyReadDigest', 'dependency read digest'],
    ['permissionEvaluationDigest', 'permission evaluation digest'],
    ['nodeArchitectureDigest', 'node architecture digest'],
  ]) assertArtifactDigest(payload[key], `Target cluster ${label}`);
  normalizeTimestamp(payload.validatedAt, 'Target cluster validatedAt');
  assertExternalId(payload.verificationRecordId, 'Target cluster verification record ID');
}

function validateChangeApprovalPayload(payload, binding, enforceBindings) {
  assertExactKeys(payload, [
    'releaseId', 'version', 'sourceSha', 'imageDigest', 'system', 'approvalId',
    'scope', 'status', 'approvedAt', 'verificationRecordId',
  ], 'Change Approval payload');
  validateCommonPayloadBinding(payload, binding, enforceBindings);
  assertExternalId(payload.system, 'Change Approval system');
  assertExternalId(payload.approvalId, 'Change Approval ID');
  assertHumanText(payload.scope, 'Change Approval scope');
  assert(payload.status === 'APPROVED', 'Change Approval status must be APPROVED');
  normalizeTimestamp(payload.approvedAt, 'Change Approval approvedAt');
  assertExternalId(payload.verificationRecordId, 'Change Approval verification record ID');
}

function validateReleaseOwnerApprovalPayload(payload, binding, enforceBindings) {
  assertExactKeys(payload, [
    'releaseId', 'version', 'sourceSha', 'imageDigest', 'system', 'ownerRef',
    'approvalId', 'status', 'approvedAt', 'verificationRecordId',
  ], 'Release Owner Approval payload');
  validateCommonPayloadBinding(payload, binding, enforceBindings);
  assertExternalId(payload.system, 'Release Owner Approval system');
  assertExternalId(payload.ownerRef, 'Release Owner controlled identifier');
  assertExternalId(payload.approvalId, 'Release Owner Approval ID');
  assert(payload.status === 'APPROVED', 'Release Owner Approval status must be APPROVED');
  normalizeTimestamp(payload.approvedAt, 'Release Owner Approval approvedAt');
  assertExternalId(payload.verificationRecordId, 'Release Owner Approval verification record ID');
}

function validateCommonPayloadBinding(payload, binding, enforceBindings) {
  assert(payload.releaseId === 'M2-RC1', 'External evidence releaseId must be M2-RC1');
  assert(payload.version === '0.12.0', 'External evidence version must be 0.12.0');
  assertNotPlaceholderSha(payload.sourceSha, 'External evidence source SHA');
  assertArtifactDigest(payload.imageDigest, 'External evidence image digest');
  if (enforceBindings) {
    assert(payload.releaseId === binding.releaseId, 'External evidence releaseId binding mismatch');
    assert(payload.version === binding.version, 'External evidence version binding mismatch');
    assert(payload.sourceSha === binding.sourceSha, 'External evidence source SHA binding mismatch');
    assert(payload.imageDigest === binding.imageDigest, 'External evidence image digest binding mismatch');
  }
}

function validateBinding(binding) {
  assertExactKeys(binding, [
    'releaseId', 'version', 'sourceSha', 'imageDigest', 'deploymentManifestDigest',
  ], 'external evidence binding');
  assert(binding.releaseId === 'M2-RC1', 'External evidence binding releaseId is invalid');
  assert(binding.version === '0.12.0', 'External evidence binding version is invalid');
  assertNotPlaceholderSha(binding.sourceSha, 'External evidence binding source SHA');
  assertArtifactDigest(binding.imageDigest, 'External evidence binding image digest');
  assertArtifactDigest(binding.deploymentManifestDigest, 'External evidence binding Deployment digest');
}

function validateNotRunVerification(verification, kind, reasonCode) {
  assert(verification.result === 'NOT_RUN', `${kind} unverified result must be NOT_RUN`);
  assert(verification.method === null
    && verification.sourceSystem === null
    && verification.externalRecordId === null
    && verification.verifiedAt === null,
  `${kind} NOT_RUN verification cannot contain external verification metadata`);
  assert(verification.reasonCode === reasonCode, `${kind} NOT_RUN reason code is invalid`);
}

function validatePassedVerification(verification, kind, providedAt, payloadRecordId) {
  assert(verification.result === 'PASSED', `${kind} verification result must be PASSED`);
  assert(verification.method === VERIFICATION_METHOD_BY_KIND[kind], `${kind} verification method is invalid`);
  assertExternalId(verification.sourceSystem, `${kind} verification source system`);
  assertExternalId(verification.externalRecordId, `${kind} verification external record ID`);
  assert(verification.externalRecordId === payloadRecordId, `${kind} external verification ID mismatch`);
  const verifiedAt = normalizeTimestamp(verification.verifiedAt, `${kind} verifiedAt`);
  assert(Date.parse(verifiedAt) >= Date.parse(providedAt), `${kind} verifiedAt precedes providedAt`);
  assert(verification.reasonCode === null, `${kind} PASSED verification cannot contain a reason code`);
}

function validateFailedVerification(verification, kind, providedAt) {
  assert(verification.result === 'FAILED', `${kind} rejected verification result must be FAILED`);
  assert(verification.method === VERIFICATION_METHOD_BY_KIND[kind], `${kind} rejected verification method is invalid`);
  assertExternalId(verification.sourceSystem, `${kind} rejected verification source system`);
  assertExternalId(verification.externalRecordId, `${kind} rejected verification external record ID`);
  const verifiedAt = normalizeTimestamp(verification.verifiedAt, `${kind} rejected verifiedAt`);
  assert(Date.parse(verifiedAt) >= Date.parse(providedAt), `${kind} rejected verifiedAt precedes providedAt`);
  assert(REJECTION_REASON_CODES.has(verification.reasonCode), `${kind} rejection reason code is invalid`);
}

function assertVersionedSecretReference(provider, value, index) {
  assert(typeof value === 'string' && value.length >= 8 && value.length <= 1024,
    `Production Secret reference ${index} is invalid`);
  assert(!PLACEHOLDER_PATTERN.test(value), `Production Secret reference ${index} cannot be a placeholder`);
  assert(!/(?:^|[\/#?=&:-])latest(?:$|[\/#?=&:-])/i.test(value),
    `Production Secret reference ${index} cannot use latest`);
  const patterns = {
    'aws-secrets-manager': /^arn:aws:secretsmanager:[^:\s]+:\d{12}:secret:[^#\s]+#(?:versionId|versionStage)=[A-Za-z0-9._-]+$/,
    'azure-key-vault': /^https:\/\/[A-Za-z0-9-]+\.vault\.azure\.net\/secrets\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/,
    'gcp-secret-manager': /^projects\/[A-Za-z0-9._-]+\/secrets\/[A-Za-z0-9._-]+\/versions\/(?!latest$)[A-Za-z0-9._-]+$/,
    'hashicorp-vault': /^vault:\/\/[A-Za-z0-9._\/-]+#version=\d+$/,
    'kubernetes-external-secrets': /^external-secret:\/\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+#version=[A-Za-z0-9._-]+$/,
  };
  assert(patterns[provider]?.test(value),
    `Production Secret reference ${index} is not a versioned ${provider} reference`);
}

function assertR1BBinding(binding, intake) {
  assertObject(binding, 'R1-B image binding');
  assert(binding.schemaVersion === 'm2-r1b-image-binding/v1', 'R1-B image binding schemaVersion is invalid');
  assert(binding.releaseId === intake.releaseId && binding.version === intake.version,
    'R2-A intake release identity does not match R1-B');
  assert(binding.deployment?.image === IMMUTABLE_IMAGE, 'R1-B immutable Deployment image changed');
  assert(binding.deployment?.manifestDigest === intake.deploymentManifestDigest,
    'R2-A Deployment digest does not match R1-B');
  assert(binding.source?.sha === intake.releaseSourceSha, 'R2-A release source SHA does not match R1-B');
  assert(binding.release?.runId === 30440674461, 'R1-A release run changed');
  assert(binding.release?.evidenceArtifact?.id === 8719335176, 'R1-A release Artifact ID changed');
  assert(binding.decision?.productionEligible === false, 'R1-B must remain production ineligible');
  assertSet(binding.decision?.remainingBlockers, EXPECTED_OPEN_BLOCKERS, 'R1-B remaining blockers');
}

function assertImmutableDeployment(deployment) {
  const image = deployment?.spec?.template?.spec?.containers?.[0]?.image;
  assert(image === IMMUTABLE_IMAGE, 'Deployment immutable image changed during R2-A');
  const secretName = deployment?.spec?.template?.spec?.containers?.[0]?.envFrom?.[1]?.secretRef?.name;
  assert(secretName === 'kdtp-read-only-governance-secrets',
    'Deployment must reference only the governed Secret object name');
  assertNoSensitiveMaterial(deployment);
}

function assertPromotionRemainsR2ABlocked(promotion) {
  assertObject(promotion, 'Production Promotion');
  assert(promotion.secrets?.status === 'NOT_CONFIGURED'
    && promotion.secrets?.provider === null
    && Array.isArray(promotion.secrets?.references)
    && promotion.secrets.references.length === 0
    && promotion.secrets?.configuredAt === null,
  'R2-A must not configure production Secrets');
  assert(promotion.targetClusterValidation?.status === 'NOT_RUN',
    'R2-A must not mark target cluster validation as passed');
  for (const key of [
    'clusterRef', 'validationRunId', 'sourceSha', 'imageDigest',
    'deploymentManifestDigest', 'validatedAt',
  ]) assert(promotion.targetClusterValidation?.[key] === null,
    `R2-A target cluster validation cannot contain ${key}`);
  for (const [key, label] of [['change', 'Change Approval'], ['releaseOwner', 'Release Owner Approval']]) {
    const approval = promotion.approvals?.[key];
    assert(approval?.status === 'MISSING'
      && approval?.system === null
      && approval?.approvalId === null
      && approval?.approvedAt === null,
    `R2-A must not create ${label}`);
  }
  assert(promotion.imageRelease?.registryDigest === REGISTRY_DIGEST,
    'R2-A must not change the immutable Registry digest');
  assert(promotion.decision?.productionEligible === false,
    'R2-A cannot make the release production eligible');
  assertSet(promotion.decision?.resolvedBlockers, EXPECTED_RESOLVED_BLOCKERS,
    'R2-A resolved blockers');
  assertSet(promotion.decision?.openBlockers, EXPECTED_OPEN_BLOCKERS,
    'R2-A open blockers');
  assertNoSensitiveMaterial(promotion);
}

function assertNoSensitiveMaterial(value) {
  const text = canonicalStringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /Bearer\s+[A-Za-z0-9._~-]+/i,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /"(?:token|password|privateKey|databaseUrl|connectionString|subjectMappings|kubeconfig|clientSecret|secretValue|authorization)"\s*:/i,
    /:\/\/[^"@:\s]+:[^"@\s]+@/,
    /"clusters"\s*:\s*\[/,
    /"(?:data|stringData)"\s*:/,
  ]) assert(!pattern.test(text), 'External evidence intake contains sensitive material');
}

function canonicalStringify(value) {
  return JSON.stringify(sortCanonical(value));
}

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortCanonical(value[key])]));
}

function normalizeTimestamp(value, label) {
  assert(typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value,
  `${label} is invalid`);
  return value;
}

function assertArtifactDigest(value, label) {
  assert(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), `${label} is invalid`);
  assert(!isPlaceholderHex(value.slice('sha256:'.length)), `${label} cannot be a placeholder digest`);
}

function assertNotPlaceholderSha(value, label) {
  assert(isSha(value), `${label} is invalid`);
  assert(!isPlaceholderHex(value), `${label} cannot be a placeholder SHA`);
}

function isPlaceholderHex(value) {
  return new Set(value).size <= 2
    || /^(?:0123456789abcdef)+$/.test(value)
    || /^(?:abcdef0123456789)+$/.test(value);
}

function assertExternalId(value, label) {
  assert(typeof value === 'string' && value.length >= 4 && value.length <= 512, `${label} is invalid`);
  assert(!PLACEHOLDER_PATTERN.test(value), `${label} cannot be a placeholder`);
  assert(!/[\u0000-\u001f\u007f]/.test(value), `${label} contains control characters`);
}

function assertHumanText(value, label) {
  assertExternalId(value, label);
  assert(value.length <= 1024, `${label} is too long`);
}

function assertPositiveInteger(value, label) {
  assert(Number.isInteger(value) && value > 0, `${label} is invalid`);
}

function assertSet(actual, expected, label) {
  assert(Array.isArray(actual) && actual.length === expected.length, `${label} count is invalid`);
  assert(actual.every((value, index) => value === expected[index]), `${label} order is invalid`);
  assert(new Set(actual).size === actual.length, `${label} contains duplicates`);
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const normalizedExpected = [...expected].sort();
  assert(actual.length === normalizedExpected.length
    && actual.every((key, index) => key === normalizedExpected[index]),
  `${label} fields are invalid`);
}

function isSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.stdout.write(`${JSON.stringify(await validateM2ExternalEvidenceIntake(), null, 2)}\n`);
}
