#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  computeK6ApiSourceArtifactDigest,
  computeK6ApiSourceValidationEvidenceDigest,
  createK6ApiSourceArtifact,
  createK6ApiSourceValidationEvidence,
  validateK6ApiSourceArtifact,
  validateK6ApiSourceValidationEvidence,
} from '../packages/k6-api-adapter/src/index.js';
import { deterministicK6ApiSourceRendering } from '../examples/k6-api-source-renderer.js';
import {
  ACCEPTED_P2,
  ACCEPTED_P2_BRANCH,
  ACCEPTED_P2_GENERATED_AT,
  ACCEPTED_P2_RECEIPT_FILE_DIGEST,
  ACCEPTED_P2_RECEIPT_PATH,
  M3_R2_P3_EVIDENCE_SCHEMA_VERSION,
  P3_SAFETY_BOUNDARY,
  assertP3,
  resolveP3Branch,
} from './m3-r2-p3-baseline.js';
import { loadP3Repository, validateP3Repository } from './m3-r2-p3-repository.js';

const ACCEPTED_P2_DECISION = Object.freeze({
  sourceGenerationContractReady: true,
  deterministicSourceRendererReady: true,
  sourceGenerationStarted: true,
  sourceGenerated: true,
  sourceExecuted: false,
  executionRuntimeStarted: false,
  nextRequiredSlice: 'M3-R2-P3',
  repositoryBlockers: Object.freeze([]),
});

export async function validateM3R2SourceGenerationP3(options = {}) {
  const repository = options.repository ?? await loadP3Repository();
  validateP3Repository(repository);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assertP3(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt),
    'M3-R2 P3 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assertP3(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'M3-R2 P3 source commit SHA is invalid');
  const branch = options.branch ?? resolveP3Branch(options);

  const p2Evidence = options.p2Evidence
    ? validateAcceptedP2Evidence(options.p2Evidence)
    : await loadAcceptedP2EvidenceReceipt();
  const sourceResult = options.sourceResult ?? deterministicK6ApiSourceRendering();
  const sourceArtifact = options.sourceArtifact
    ?? createK6ApiSourceArtifact({ sourceResult, p2Evidence });
  const validationEvidence = options.validationEvidence
    ?? createK6ApiSourceValidationEvidence({ sourceArtifact, sourceResult, p2Evidence });
  validateK6ApiSourceArtifact(sourceArtifact, { sourceResult, p2Evidence });
  validateK6ApiSourceValidationEvidence(validationEvidence, {
    sourceArtifact, sourceResult, p2Evidence,
  });
  assertP3(computeK6ApiSourceArtifactDigest(sourceArtifact) === sourceArtifact.artifactDigest,
    'M3-R2 P3 Source Artifact digest cannot be independently recomputed');
  assertP3(computeK6ApiSourceValidationEvidenceDigest(validationEvidence)
      === validationEvidence.evidenceDigest,
  'M3-R2 P3 validation Evidence digest cannot be independently recomputed');

  const decision = { ...validationEvidence.decision };
  const evidenceClaims = {
    schemaVersion: M3_R2_P3_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedP2: { ...ACCEPTED_P2 },
    sourceArtifact: {
      artifactId: sourceArtifact.artifactId,
      artifactDigest: sourceArtifact.artifactDigest,
      sourceIdentity: sourceArtifact.sourceIdentity.identityDigest,
      sourceDigest: sourceArtifact.sourceDigest,
      sourceByteLength: sourceArtifact.sourceByteLength,
      sourceLineCount: sourceArtifact.sourceLineCount,
      persistence: sourceArtifact.persistence,
      published: sourceArtifact.published,
      validationReportDigest: sourceArtifact.validationReport.reportDigest,
    },
    validationEvidence: {
      evidenceId: validationEvidence.evidenceId,
      evidenceDigest: validationEvidence.evidenceDigest,
      validatorId: validationEvidence.validator.validatorId,
      validatorVersion: validationEvidence.validator.validatorVersion,
      checkCount: validationEvidence.validator.checkIds.length,
      artifactDigest: validationEvidence.artifactDigest,
    },
    decision,
    safetyBoundary: { ...P3_SAFETY_BOUNDARY },
  };
  return { ...evidenceClaims, evidenceDigest: sha256(evidenceClaims) };
}

async function loadAcceptedP2EvidenceReceipt() {
  const raw = await readFile(ACCEPTED_P2_RECEIPT_PATH, 'utf8');
  const rawDigest = createHash('sha256').update(raw, 'utf8').digest('hex');
  assertP3(rawDigest === ACCEPTED_P2_RECEIPT_FILE_DIGEST,
    'Accepted M3-R2 P2 Evidence receipt file digest changed');
  let evidence;
  try {
    evidence = JSON.parse(raw);
  } catch {
    throw new Error('Accepted M3-R2 P2 Evidence receipt is not valid JSON');
  }
  return validateAcceptedP2Evidence(evidence);
}

function validateAcceptedP2Evidence(evidence) {
  assertP3(evidence && typeof evidence === 'object' && !Array.isArray(evidence),
    'Accepted M3-R2 P2 Evidence receipt is invalid');
  const { evidenceDigest, ...claims } = evidence;
  assertP3(evidenceDigest === ACCEPTED_P2.evidenceDigest
      && sha256(claims) === evidenceDigest,
  'Accepted M3-R2 P2 Evidence canonical digest changed');
  assertP3(evidence.schemaVersion === 'm3-r2-source-generation-p2-evidence/v1'
      && evidence.generatedAt === ACCEPTED_P2_GENERATED_AT
      && evidence.source?.branch === ACCEPTED_P2_BRANCH
      && evidence.source?.commitSha === ACCEPTED_P2.headSha,
  'Accepted M3-R2 P2 Evidence source binding changed');
  assertP3(evidence.sourceResult?.sourceDigest === ACCEPTED_P2.sourceDigest
      && evidence.sourceResult?.resultDigest === ACCEPTED_P2.sourceResultDigest,
  'Accepted M3-R2 P2 Source Result binding changed');
  assertP3(canonicalStringify(evidence.decision)
      === canonicalStringify(ACCEPTED_P2_DECISION),
  'Accepted M3-R2 P2 Evidence decision changed');
  assertP3(Object.keys(evidence.safetyBoundary ?? {}).length === 19
      && Object.values(evidence.safetyBoundary ?? {}).every((value) => value === false),
  'Accepted M3-R2 P2 Evidence safety boundary changed');
  return evidence;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM3R2SourceGenerationP3(), null, 2)}\n`);
}
