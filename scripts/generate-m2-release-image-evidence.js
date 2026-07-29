import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalStringify } from '../packages/knowledge-core/src/index.js';

export const M2_RELEASE_IMAGE_EVIDENCE_SCHEMA_VERSION = 'm2-release-image-evidence/v1';

const ROOT = process.cwd();
const PROMOTION_PATH = join(ROOT, 'releases/m2/production-promotion.json');
const REPOSITORY = 'akaryc1b/knowledge-driven-test-platform';
const WORKFLOW = '.github/workflows/m2-release-image.yml';
const IMAGE_REPOSITORY = 'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service';
const PLACEHOLDER_PATTERN = /(?:example|placeholder|sample|dummy|fake|todo|tbd|changeme|replace[-_ ]?me|not[-_ ]?set|unknown)/i;

export async function generateM2ReleaseImageEvidence(options = {}) {
  const env = options.env ?? process.env;
  const promotion = options.promotion
    ?? JSON.parse(await readFile(options.promotionPath ?? PROMOTION_PATH, 'utf8'));
  assertObject(promotion, 'M2 production promotion');

  const releaseId = required(env, 'KDTP_RELEASE_ID');
  const version = required(env, 'KDTP_RELEASE_VERSION');
  const sourceSha = required(env, 'KDTP_RELEASE_SOURCE_SHA');
  const buildRunId = positiveInteger(required(env, 'KDTP_RELEASE_BUILD_RUN_ID'), 'Build run ID');
  const imageRepository = required(env, 'KDTP_RELEASE_IMAGE_REPOSITORY');
  const registryDigest = requiredDigest(env, 'KDTP_RELEASE_IMAGE_DIGEST', 'Registry digest');
  const immutableReference = required(env, 'KDTP_RELEASE_IMAGE_REFERENCE');
  const sbomDigest = requiredDigest(env, 'KDTP_RELEASE_SBOM_DIGEST', 'SBOM digest');
  const provenance = attestationFromEnv(env, 'PROVENANCE', 'provenance attestation');
  const sbomAttestation = attestationFromEnv(env, 'SBOM', 'SBOM attestation');
  const verifiedAt = timestamp(required(env, 'KDTP_RELEASE_PULL_VERIFIED_AT'), 'Image pull verification time');
  const generatedAt = timestamp(required(env, 'KDTP_RELEASE_GENERATED_AT'), 'Image evidence generation time');

  assert(releaseId === promotion.releaseId && releaseId === 'M2-RC1',
    'Release ID does not match Production Promotion');
  assert(version === promotion.version && version === '0.12.0',
    'Release version does not match Production Promotion');
  assert(isSha(sourceSha), 'Release image source SHA is invalid');
  assert(!isPlaceholderHex(sourceSha), 'Release image source SHA cannot be a placeholder');
  assert(imageRepository === IMAGE_REPOSITORY, 'Release image repository is invalid');
  assert(immutableReference === `${imageRepository}@${registryDigest}`,
    'Release image reference must be the complete immutable Registry reference');
  assert(!immutableReference.includes(':0.12.0') && !immutableReference.includes(':m2-rc1'),
    'Release evidence cannot use a mutable image tag');

  const shortSha = sourceSha.slice(0, 12);
  const evidence = {
    schemaVersion: M2_RELEASE_IMAGE_EVIDENCE_SCHEMA_VERSION,
    releaseId,
    version,
    generatedAt,
    source: {
      branch: 'main',
      sha: sourceSha,
    },
    build: {
      repository: REPOSITORY,
      workflow: WORKFLOW,
      runId: buildRunId,
    },
    image: {
      repository: imageRepository,
      immutableReference,
      registryDigest,
      tags: [version, 'm2-rc1', `sha-${shortSha}`],
      pullVerification: {
        status: 'PASSED',
        verifiedReference: immutableReference,
        resolvedDigest: registryDigest,
        verifiedAt,
      },
    },
    sbom: {
      format: 'spdx-json',
      digest: sbomDigest,
    },
    attestations: {
      provenance,
      sbom: sbomAttestation,
    },
    decision: {
      externalRegistryDigestAvailable: true,
      eligibleForDigestBinding: true,
    },
  };
  assertNoSensitiveMaterial(evidence);
  return evidence;
}

function attestationFromEnv(env, prefix, label) {
  const attestationId = required(env, `KDTP_RELEASE_${prefix}_ATTESTATION_ID`);
  const url = required(env, `KDTP_RELEASE_${prefix}_ATTESTATION_URL`);
  const bundleDigest = requiredDigest(
    env,
    `KDTP_RELEASE_${prefix}_BUNDLE_DIGEST`,
    `${label} bundle digest`,
  );
  assertExternalId(attestationId, `${label} ID`);
  assertHttpsUrl(url, `${label} URL`);
  return { attestationId, url, bundleDigest };
}

function requiredDigest(env, name, label) {
  const value = required(env, name);
  assert(/^sha256:[a-f0-9]{64}$/.test(value), `${label} is invalid`);
  assert(!isPlaceholderHex(value.slice('sha256:'.length)), `${label} cannot be a placeholder`);
  return value;
}

function required(env, name) {
  const value = env[name];
  assert(typeof value === 'string' && value.length > 0, `${name} is required`);
  return value;
}

function positiveInteger(value, label) {
  assert(/^\d+$/.test(value), `${label} is invalid`);
  const number = Number(value);
  assert(Number.isSafeInteger(number) && number > 0, `${label} is invalid`);
  return number;
}

function timestamp(value, label) {
  assert(Number.isFinite(Date.parse(value)), `${label} is invalid`);
  return new Date(value).toISOString();
}

function assertExternalId(value, label) {
  assert(typeof value === 'string' && value.length >= 4 && value.length <= 512,
    `${label} is invalid`);
  assert(!PLACEHOLDER_PATTERN.test(value), `${label} cannot be a placeholder`);
}

function assertHttpsUrl(value, label) {
  assertExternalId(value, label);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is invalid`);
  }
  assert(url.protocol === 'https:', `${label} must use HTTPS`);
}

function isPlaceholderHex(value) {
  return new Set(value).size <= 2
    || /^(?:0123456789abcdef)+$/.test(value)
    || /^(?:abcdef0123456789)+$/.test(value);
}

function assertNoSensitiveMaterial(value) {
  const text = canonicalStringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /Bearer\s+[A-Za-z0-9._~-]+/i,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /"(?:token|password|privateKey|databaseUrl|connectionString|subjectMappings|kubeconfig|clientSecret|secretValue)"\s*:/i,
    /:\/\/[^"@:\s]+:[^"@\s]+@/,
  ]) assert(!pattern.test(text), 'M2 release image evidence contains sensitive material');
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
  process.stdout.write(`${JSON.stringify(await generateM2ReleaseImageEvidence(), null, 2)}\n`);
}
