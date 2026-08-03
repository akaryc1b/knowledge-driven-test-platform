import { sha256 } from '@kdtp/knowledge-core';
import { deterministicK6ApiSourceRendering } from '../../../examples/k6-api-source-renderer.js';
import {
  ACCEPTED_FOUNDATION,
  ACCEPTED_M3_R1_DIGESTS,
  M3_R2_P2_EVIDENCE_SCHEMA_VERSION,
  P2_SAFETY_BOUNDARY,
} from '../../../scripts/m3-r2-p2-baseline.js';

export function p3SourceResult() {
  return deterministicK6ApiSourceRendering();
}

export function p3P2Evidence(sourceResult = p3SourceResult()) {
  const claims = {
    schemaVersion: M3_R2_P2_EVIDENCE_SCHEMA_VERSION,
    generatedAt: '2026-07-31T10:15:44.787Z',
    source: {
      branch: 'agent/m3-r2-governed-k6-api-source-generation',
      commitSha: 'b4bb9ed7833869edf9762adc7e7ab13971cc87c9',
    },
    acceptedFoundation: { ...ACCEPTED_FOUNDATION },
    fixedDigests: { ...ACCEPTED_M3_R1_DIGESTS },
    sourceResult: {
      sourceIdentity: sourceResult.sourceIdentity.identityDigest,
      sourceDigest: sourceResult.sourceDigest,
      sourceByteLength: sourceResult.sourceByteLength,
      sourceLineCount: sourceResult.sourceLineCount,
      operationCount: sourceResult.operationCount,
      assertionCount: sourceResult.assertionCount,
      thresholdCount: sourceResult.thresholdCount,
      renderingPolicyDigest: sourceResult.renderingPolicyDigest,
      generatorDescriptorDigest: sourceResult.generatorDescriptorDigest,
      generationRequestDigest: sourceResult.generationRequestDigest,
      sourceResultSchemaCatalogDigest:
        'b674fae637aaa0fb16289e0324e8192b98705e8234ac75fa597f674986b6e591',
      resultDigest: sourceResult.resultDigest,
    },
    decision: {
      sourceGenerationContractReady: true,
      deterministicSourceRendererReady: true,
      sourceGenerationStarted: true,
      sourceGenerated: true,
      sourceExecuted: false,
      executionRuntimeStarted: false,
      nextRequiredSlice: 'M3-R2-P3',
      repositoryBlockers: [],
    },
    safetyBoundary: { ...P2_SAFETY_BOUNDARY },
  };
  return { ...claims, evidenceDigest: sha256(claims) };
}

export function clone(value) {
  return structuredClone(value);
}
