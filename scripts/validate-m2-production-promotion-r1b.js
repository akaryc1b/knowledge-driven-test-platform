import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalize, canonicalStringify, sha256 } from '../packages/knowledge-core/src/index.js';
import { resolveEvidenceBranch } from './release-evidence-environment.js';
import { validateM2R1BImageBinding } from './validate-m2-r1b-image-binding.js';

const ROOT = process.cwd();
const PROMOTION_PATH = join(ROOT, 'releases/m2/production-promotion.json');
const CANDIDATE_DIGEST = '5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697';
const POST_MERGE_DIGEST = 'd073efec5aa587caf7f54eedd219a494b876d2913cb8e110981c374e79501e25';

export async function loadM2ProductionPromotion(path = PROMOTION_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateM2ProductionPromotion(options = {}) {
  const promotion = options.promotion ?? await loadM2ProductionPromotion(options.path);
  await validateM2R1BImageBinding({
    binding: options.binding,
    releaseEvidence: options.releaseImageEvidence ?? options.releaseEvidence,
    promotion,
    deployment: options.deployment,
    candidate: options.candidate,
    postMerge: options.postMergeAcceptance ?? options.postMerge,
    bindingPath: options.bindingPath,
    releaseEvidencePath: options.releaseEvidencePath,
    deploymentPath: options.deploymentPath,
    candidatePath: options.candidatePath,
    postMergePath: options.postMergePath,
    generatedAt: options.generatedAt,
    commitSha: options.commitSha,
    branch: options.branch,
  });

  const generatedAt = normalizeTimestamp(options.generatedAt ?? new Date().toISOString());
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'M2 production promotion evidence commit SHA is invalid');
  const branch = resolveEvidenceBranch({
    branch: options.branch,
    fallback: 'agent/m2-rc1-r1b-immutable-image-binding',
    label: 'M2 production promotion evidence branch',
  });

  const evidence = {
    schemaVersion: 'm2-production-promotion-evidence/v1',
    releaseId: promotion.releaseId,
    version: promotion.version,
    generatedAt,
    source: { branch, commitSha },
    digests: {
      productionPromotion: sha256(canonicalize(promotion)),
      candidate: CANDIDATE_DIGEST,
      postMergeAcceptance: POST_MERGE_DIGEST,
    },
    promotionSource: structuredClone(promotion.promotionSource),
    mainBranchFinalCi: structuredClone(promotion.mainBranchFinalCi),
    imageRelease: structuredClone(promotion.imageRelease),
    secrets: structuredClone(promotion.secrets),
    targetClusterValidation: structuredClone(promotion.targetClusterValidation),
    approvals: structuredClone(promotion.approvals),
    decision: structuredClone(promotion.decision),
  };
  assertNoSensitiveMaterial(evidence);
  return evidence;
}

function normalizeTimestamp(value) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)),
    'M2 production promotion timestamp is invalid');
  return new Date(value).toISOString();
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
    /"clusters"\s*:\s*\[/,
  ]) assert(!pattern.test(text), 'M2 production promotion evidence contains sensitive material');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.stdout.write(`${JSON.stringify(await validateM2ProductionPromotion(), null, 2)}\n`);
}
