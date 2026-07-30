#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveEvidenceBranch } from './release-evidence-environment.js';

export const M2_PORTABLE_RELEASE_READINESS_SCHEMA_VERSION =
  'm2-portable-release-readiness/v1';
export const M2_PORTABLE_RELEASE_READINESS_EVIDENCE_SCHEMA_VERSION =
  'm2-portable-release-readiness-evidence/v1';

const ROOT = process.cwd();
const PATHS = Object.freeze({
  readiness: 'releases/m2/portable-release-readiness.json',
  promotion: 'releases/m2/production-promotion.json',
  intake: 'releases/m2/r2a-external-evidence-intake.json',
  binding: 'releases/m2/r1b-image-binding.json',
  imageEvidence: 'releases/m2/release-image-evidence.json',
  deployment: 'deploy/kubernetes/read-only-governance-service/deployment.yaml',
  configMap: 'deploy/kubernetes/read-only-governance-service/configmap.yaml',
  kustomization: 'deploy/kubernetes/read-only-governance-service/kustomization.yaml',
  serviceConfig: 'apps/read-only-governance-service/src/config.js',
});
const FIXED = Object.freeze({
  contractBaseSha: '286bdab429ee7365082b8b5abaff1b5b981d9ef7',
  releaseSourceSha: '6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7',
  imageDigest: 'sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13',
  imageReference:
    'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service@sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13',
  promotionDigest: 'sha256:4125d5f08ec559e2bc6012ab501879432493af012b4d70665eb1d653c4190f5d',
  intakeDigest: 'sha256:54413977a3030847fdef7e3aa77c2a1c2924677f0555a4fabdba888f829a6d18',
  bindingDigest: 'sha256:adb6374bee157b7b64d25b6fdfe1b35ea2d4e5e92a08b029c0fbc5e66c33c0a7',
  deploymentDigest: 'sha256:fb2cb10f42f8d3473c1997c514ec11eb66bfb06f7542c3404c328c39f8763a45',
});
const HISTORICAL_BLOCKERS = Object.freeze([
  'production-secrets-not-configured',
  'target-cluster-validation-not-run',
  'change-approval-missing',
  'release-owner-approval-missing',
]);
const REQUIRED_INPUTS = Object.freeze([
  {
    name: 'KDTP_DATABASE_URL',
    classification: 'SENSITIVE_OR_IDENTITY_BOUND',
    repositoryValueAllowed: false,
    deliveryMechanisms: [
      'kubernetes-secret',
      'external-secret-provider',
      'workload-identity-adapter',
    ],
  },
  {
    name: 'KDTP_OIDC_ISSUER',
    classification: 'NON_SECRET_CONFIGURATION',
    repositoryValueAllowed: true,
    deliveryMechanisms: ['config-map', 'environment-overlay'],
  },
  {
    name: 'KDTP_OIDC_JWKS_URI',
    classification: 'NON_SECRET_CONFIGURATION',
    repositoryValueAllowed: true,
    deliveryMechanisms: ['config-map', 'environment-overlay'],
  },
  {
    name: 'KDTP_OIDC_AUDIENCE',
    classification: 'NON_SECRET_CONFIGURATION',
    repositoryValueAllowed: true,
    deliveryMechanisms: ['config-map', 'environment-overlay'],
  },
  {
    name: 'KDTP_OIDC_SUBJECT_MAPPINGS_JSON',
    classification: 'SECURITY_CONFIGURATION',
    repositoryValueAllowed: false,
    deliveryMechanisms: ['kubernetes-secret', 'environment-overlay'],
  },
]);
const NON_REQUIREMENTS = Object.freeze([
  'production-secret-provider-evidence',
  'provider-specific-secret-version-record',
  'target-cluster-identity',
  'change-approval-record',
  'release-owner-approval-record',
]);
const OPERATOR_RESPONSIBILITIES = Object.freeze([
  'supply-required-runtime-configuration',
  'replace-environment-placeholders',
  'protect-sensitive-runtime-values',
  'validate-target-environment',
  'complete-local-change-governance-if-required',
]);
const OPERATOR_GATES = Object.freeze([
  'runtime-configuration-supplied',
  'environment-placeholders-replaced',
  'target-environment-validated',
  'local-governance-completed-if-required',
]);

export async function loadM2PortableReleaseReadiness(path = join(ROOT, PATHS.readiness)) {
  return loadJson(path);
}

export async function validateM2PortableReleaseReadiness(options = {}) {
  const readiness = options.readiness ?? await loadM2PortableReleaseReadiness(options.path);
  const promotion = options.promotion ?? await loadJson(join(ROOT, PATHS.promotion));
  const intake = options.intake ?? await loadJson(join(ROOT, PATHS.intake));
  const binding = options.imageBinding ?? await loadJson(join(ROOT, PATHS.binding));
  const imageEvidence = options.imageEvidence ?? await loadJson(join(ROOT, PATHS.imageEvidence));
  const deployment = options.deployment ?? await loadJson(join(ROOT, PATHS.deployment));
  const configMap = options.configMap ?? await loadJson(join(ROOT, PATHS.configMap));
  const kustomization = options.kustomization ?? await loadJson(join(ROOT, PATHS.kustomization));
  const serviceConfig = options.serviceConfigSource
    ?? await readFile(join(ROOT, PATHS.serviceConfig), 'utf8');

  validateRecord(readiness);
  validateHistorical(readiness, promotion, intake, binding, deployment);
  validateImage(readiness, binding, imageEvidence, deployment);
  validateRuntime(readiness, deployment, configMap, kustomization, serviceConfig);
  rejectSensitiveLiterals(readiness);

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt),
    'portable readiness generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'portable readiness evidence commit SHA is invalid');
  const branch = resolveEvidenceBranch({
    branch: options.branch,
    headRef: options.headRef,
    refName: options.refName,
    fallback: 'agent/m2-rc1-r2-rebaseline-portable-readiness',
    label: 'portable readiness evidence branch',
  });

  return {
    schemaVersion: M2_PORTABLE_RELEASE_READINESS_EVIDENCE_SCHEMA_VERSION,
    releaseId: readiness.releaseId,
    version: readiness.version,
    generatedAt,
    source: { branch, commitSha },
    digests: {
      readiness: canonicalDigest(readiness),
      productionPromotion: canonicalDigest(promotion),
      externalEvidenceIntake: canonicalDigest(intake),
      imageBinding: canonicalDigest(binding),
      deploymentManifest: canonicalDigest(deployment),
    },
    runtimeConfiguration: {
      requiredInputNames: readiness.runtimeConfiguration.requiredInputs.map(({ name }) => name),
      providerAgnostic: true,
      repositoryStoresSecretValues: false,
      repositoryRequiresProviderMetadata: false,
    },
    decision: structuredClone(readiness.decision),
    safetyBoundary: {
      secretAccessed: false,
      secretCreated: false,
      targetClusterAccessed: false,
      targetClusterModified: false,
      approvalCreated: false,
      rolloutExecuted: false,
      imagePublished: false,
    },
  };
}

function validateRecord(value) {
  exactKeys(value, [
    'schemaVersion', 'releaseId', 'version', 'phase', 'contractBaseSha',
    'releaseSourceSha', 'immutableImage', 'repositoryVerification',
    'historicalEvidence', 'runtimeConfiguration', 'repositoryNonRequirements',
    'deploymentOperatorResponsibilities', 'decision',
  ], 'portable release readiness');
  assert(value.schemaVersion === M2_PORTABLE_RELEASE_READINESS_SCHEMA_VERSION,
    'portable release readiness schemaVersion is invalid');
  assert(value.releaseId === 'M2-RC1' && value.version === '0.12.0',
    'portable release identity is invalid');
  assert(value.phase === 'PORTABLE_RELEASE_READINESS',
    'portable release readiness phase is invalid');
  assert(value.contractBaseSha === FIXED.contractBaseSha,
    'portable release readiness contract base SHA changed');
  assert(value.releaseSourceSha === FIXED.releaseSourceSha,
    'portable release readiness release source SHA changed');
  same(value.repositoryNonRequirements, NON_REQUIREMENTS, 'repository non-requirements');
  same(value.deploymentOperatorResponsibilities, OPERATOR_RESPONSIBILITIES,
    'deployment operator responsibilities');
  same(value.decision, {
    repositoryReleaseReady: true,
    environmentPromotionEvaluated: false,
    environmentPromotionEligible: null,
    repositoryBlockers: [],
    deploymentOperatorGates: OPERATOR_GATES,
  }, 'portable readiness decision');
  same(value.repositoryVerification, {
    mainPushValidationRunId: 30517143338,
    independentR2AValidationRunId: 30517143343,
    postMergeObservationRunId: 30517188902,
    postMergeObservationArtifactId: 8749328707,
    postMergeObservationArtifactDigest:
      'sha256:1348879aa0a9610141d443be950c97c136965bdc734dcac1c7379c0513b19ebb',
  }, 'repository verification');
}

function validateHistorical(readiness, promotion, intake, binding, deployment) {
  const historical = readiness.historicalEvidence;
  same(historical, {
    productionPromotion: {
      path: PATHS.promotion,
      canonicalDigest: FIXED.promotionDigest,
      role: 'HISTORICAL_ENVIRONMENT_PROMOTION_RECORD',
    },
    externalEvidenceIntake: {
      path: PATHS.intake,
      canonicalDigest: FIXED.intakeDigest,
      role: 'HISTORICAL_OPTIONAL_DEPLOYMENT_EVIDENCE_CONTRACT',
    },
    imageBinding: { path: PATHS.binding, canonicalDigest: FIXED.bindingDigest },
    deploymentManifest: { path: PATHS.deployment, canonicalDigest: FIXED.deploymentDigest },
  }, 'historical evidence');
  assert(canonicalDigest(promotion) === FIXED.promotionDigest,
    'historical Production Promotion digest changed');
  assert(canonicalDigest(intake) === FIXED.intakeDigest,
    'historical external evidence intake digest changed');
  assert(canonicalDigest(binding) === FIXED.bindingDigest,
    'historical image binding digest changed');
  assert(canonicalDigest(deployment) === FIXED.deploymentDigest,
    'historical Deployment manifest digest changed');
  assert(promotion.decision?.productionEligible === false,
    'historical Production Promotion must remain ineligible');
  same(promotion.decision?.openBlockers, HISTORICAL_BLOCKERS,
    'historical Production Promotion blockers');
  assert(Object.values(intake.inputs ?? {}).length === 4
    && Object.values(intake.inputs).every(({ status }) => status === 'NOT_PROVIDED'),
  'historical external evidence intake must remain NOT_PROVIDED');
}

function validateImage(readiness, binding, imageEvidence, deployment) {
  same(readiness.immutableImage, {
    reference: FIXED.imageReference,
    digest: FIXED.imageDigest,
    releaseWorkflowRunId: 30440674461,
    sbomDigest: 'sha256:94a4a77a76f4802c9ff4a238e63854e1619d2ce46fd6a5eaef1e2698eb033702',
    provenanceAttestationId: '37705043',
    sbomAttestationId: '37705058',
  }, 'portable readiness immutable image');
  assert(imageEvidence.source?.sha === FIXED.releaseSourceSha,
    'release image source changed');
  assert(imageEvidence.build?.runId === 30440674461,
    'release image run changed');
  assert(imageEvidence.image?.immutableReference === FIXED.imageReference
    && imageEvidence.image?.registryDigest === FIXED.imageDigest
    && imageEvidence.image?.pullVerification?.resolvedDigest === FIXED.imageDigest,
  'release image immutable binding is invalid');
  assert(binding.deployment?.image === FIXED.imageReference
    && binding.deployment?.manifestDigest === FIXED.deploymentDigest,
  'R1-B Deployment binding changed');
  assert(deployment.spec?.template?.spec?.containers?.[0]?.image === FIXED.imageReference,
    'Deployment immutable image changed');
}

function validateRuntime(readiness, deployment, configMap, kustomization, source) {
  const runtime = readiness.runtimeConfiguration;
  assert(runtime.deliveryModel === 'OPERATOR_SUPPLIED'
    && runtime.providerAgnostic === true
    && runtime.repositoryStoresSecretValues === false
    && runtime.repositoryRequiresProviderMetadata === false,
  'portable runtime configuration boundary changed');
  assert(runtime.configMapRefName === 'kdtp-read-only-governance-config'
    && runtime.secretRefName === 'kdtp-read-only-governance-secrets',
  'portable runtime reference names changed');
  same(runtime.requiredInputs, REQUIRED_INPUTS, 'runtime required inputs');
  for (const { name } of REQUIRED_INPUTS) {
    assert(source.includes(`requiredString(env.${name}`), `service config does not require ${name}`);
  }
  assert(runtime.placeholders?.length === 2
    && runtime.placeholders.every(({ mustBeReplacedByOperator }) =>
      mustBeReplacedByOperator === true),
  'runtime placeholder contract is invalid');
  assert(configMap.metadata?.name === runtime.configMapRefName,
    'ConfigMap reference changed');
  assert(configMap.data?.KDTP_OIDC_ISSUER?.includes('.invalid/')
    && configMap.data?.KDTP_OIDC_JWKS_URI?.includes('.invalid/'),
  'OIDC placeholders must remain explicit');
  assert(configMap.data?.KDTP_DATABASE_URL === undefined
    && configMap.data?.KDTP_OIDC_SUBJECT_MAPPINGS_JSON === undefined,
  'sensitive runtime inputs cannot be in the ConfigMap');
  const envFrom = deployment.spec?.template?.spec?.containers?.[0]?.envFrom ?? [];
  assert(envFrom.some(({ configMapRef }) => configMapRef?.name === runtime.configMapRefName)
    && envFrom.some(({ secretRef }) => secretRef?.name === runtime.secretRefName),
  'Deployment runtime references are incomplete');
  assert(deployment.spec?.template?.spec?.automountServiceAccountToken === false,
    'Deployment service account token policy changed');
  const deploymentText = JSON.stringify(deployment).toLowerCase();
  for (const term of [
    'secrets-store.csi', 'externalsecret', 'secretstore', 'clustersecretstore',
    'aws-secrets-manager', 'azure-key-vault', 'gcp-secret-manager', 'hashicorp-vault',
  ]) assert(!deploymentText.includes(term), `Deployment requires provider-specific ${term}`);
  assert(kustomization.resources?.includes('configmap.yaml')
    && kustomization.resources?.includes('deployment.yaml')
    && !kustomization.resources.some((item) => /secret/i.test(item)),
  'Kustomization is not provider-agnostic');
}

export function canonicalDigest(value) {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function rejectSensitiveLiterals(value) {
  const text = JSON.stringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bAKIA[A-Z0-9]{16}\b/, /\bBearer\s+[A-Za-z0-9._-]+/i,
    /"client_secret"\s*:/i, /"password"\s*:/i, /"token"\s*:/i,
  ]) assert(!pattern.test(text), 'portable readiness contains sensitive material');
}
function same(actual, expected, label) {
  assert(canonical(actual) === canonical(expected), `${label} changed`);
}
function exactKeys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} is invalid`);
  same(Object.keys(value).sort(), [...expected].sort(), `${label} fields`);
}
async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM2PortableReleaseReadiness(), null, 2)}\n`);
}
