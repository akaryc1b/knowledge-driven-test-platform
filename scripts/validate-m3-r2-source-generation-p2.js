#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@kdtp/knowledge-core';
import {
  computeK6ApiSourceResultDigest,
  validateK6ApiRenderedSource,
  validateK6ApiSourceResult,
} from '../packages/k6-api-adapter/src/index.js';
import {
  deterministicK6ApiSourceRendering,
} from '../examples/k6-api-source-renderer.js';
import { rendererBindings } from '../examples/k6-api-source-renderer-fixture.js';
import { validateM3R1K6ApiSpecCompiler } from './validate-m3-r1-k6-api-spec-compiler.js';
import { validateM3R2SourceGenerationP1 } from './validate-m3-r2-source-generation-p1.js';
import {
  ACCEPTED_FOUNDATION,
  ACCEPTED_M3_R1_DIGESTS,
  M3_R2_P2_EVIDENCE_SCHEMA_VERSION,
  P2_SAFETY_BOUNDARY,
  assertP2,
  resolveP2Branch,
} from './m3-r2-p2-baseline.js';
import {
  loadP2Repository,
  validateP2Repository,
} from './m3-r2-p2-repository.js';

export async function validateM3R2SourceGenerationP2(options = {}) {
  const repository = options.repository ?? await loadP2Repository();
  validateP2Repository(repository);

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assertP2(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt),
    'M3-R2 P2 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assertP2(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'M3-R2 P2 source commit SHA is invalid');
  const branch = options.branch ?? resolveP2Branch(options);

  const m3r1 = await validateM3R1K6ApiSpecCompiler({
    generatedAt: '2026-07-31T07:30:00.000Z',
    commitSha,
    branch,
  });
  assertP2(JSON.stringify(m3r1.digests) === JSON.stringify(ACCEPTED_M3_R1_DIGESTS),
    'M3-R1 fixed digests changed during M3-R2 P2');

  const p1 = await validateM3R2SourceGenerationP1({
    generatedAt: '2026-07-31T07:31:00.000Z',
    commitSha,
    branch,
  });
  assertP2(p1.decision.sourceGenerationContractReady === true
      && p1.decision.sourceGenerationStarted === false
      && p1.decision.sourceGenerated === false
      && p1.decision.sourceExecuted === false
      && p1.decision.executionRuntimeStarted === false
      && p1.decision.nextRequiredSlice === 'M3-R2-P2'
      && p1.decision.repositoryBlockers.length === 0,
  'M3-R2 P1 anti-regression decision changed');

  const bindings = rendererBindings({
    requestedAt: '2026-07-31T07:00:00.000Z',
    requestedBy: 'm3-r2-p2-example',
  });
  const result = options.result ?? deterministicK6ApiSourceRendering();
  const validated = validateK6ApiSourceResult(result, bindings);
  assertP2(validateK6ApiRenderedSource(validated.source, bindings) === true,
    'M3-R2 P2 canonical source validation failed');
  assertP2(computeK6ApiSourceResultDigest(validated) === validated.resultDigest,
    'M3-R2 P2 Source Result digest cannot be independently recomputed');

  const sourceBytes = Buffer.from(validated.source, 'utf8');
  const independentSourceDigest = createHash('sha256').update(sourceBytes).digest('hex');
  assertP2(independentSourceDigest === validated.sourceDigest,
    'M3-R2 P2 Source digest does not bind raw UTF-8 bytes');
  assertP2(sourceBytes.length === validated.sourceByteLength,
    'M3-R2 P2 Source byte length is invalid');
  assertP2((validated.source.match(/\n/g) ?? []).length === validated.sourceLineCount,
    'M3-R2 P2 Source line count is invalid');
  assertP2(validated.source.endsWith('\n') && !validated.source.includes('\r'),
    'M3-R2 P2 Source must use LF and end with one newline');

  for (const forbidden of [
    generatedAt,
    commitSha === 'local' ? null : commitSha,
    branch === 'local' ? null : branch,
    'GITHUB_RUN_ID',
    'requestedAt',
    'requestedBy',
  ].filter(Boolean)) {
    assertP2(!validated.source.includes(forbidden),
      'M3-R2 P2 volatile metadata entered Source bytes');
  }

  const decision = {
    sourceGenerationContractReady: true,
    deterministicSourceRendererReady: true,
    sourceGenerationStarted: true,
    sourceGenerated: true,
    sourceExecuted: false,
    executionRuntimeStarted: false,
    nextRequiredSlice: 'M3-R2-P3',
    repositoryBlockers: [],
  };
  const sourceResult = {
    sourceIdentity: validated.sourceIdentity.identityDigest,
    sourceDigest: validated.sourceDigest,
    sourceByteLength: validated.sourceByteLength,
    sourceLineCount: validated.sourceLineCount,
    operationCount: validated.operationCount,
    assertionCount: validated.assertionCount,
    thresholdCount: validated.thresholdCount,
    renderingPolicyDigest: validated.renderingPolicyDigest,
    generatorDescriptorDigest: validated.generatorDescriptorDigest,
    generationRequestDigest: validated.generationRequestDigest,
    sourceResultSchemaCatalogDigest: sha256(repository.catalog),
    resultDigest: validated.resultDigest,
  };
  const evidenceClaims = {
    schemaVersion: M3_R2_P2_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedFoundation: { ...ACCEPTED_FOUNDATION },
    fixedDigests: { ...ACCEPTED_M3_R1_DIGESTS },
    sourceResult,
    decision,
    safetyBoundary: { ...P2_SAFETY_BOUNDARY },
  };
  return {
    ...evidenceClaims,
    evidenceDigest: sha256(evidenceClaims),
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(
    `${JSON.stringify(await validateM3R2SourceGenerationP2(), null, 2)}\n`,
  );
}
