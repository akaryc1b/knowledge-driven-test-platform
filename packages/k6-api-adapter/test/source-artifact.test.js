import test from 'node:test';
import assert from 'node:assert/strict';
import {
  K6_API_SOURCE_ARTIFACT_SAFETY_BOUNDARY,
  K6_API_SOURCE_VALIDATION_DECISION,
  computeK6ApiSourceArtifactDigest,
  computeK6ApiSourceValidationEvidenceDigest,
  createK6ApiSourceArtifact,
  createK6ApiSourceValidationEvidence,
  validateK6ApiSourceArtifact,
  validateK6ApiSourceValidationEvidence,
} from '../src/index.js';
import { clone, p3P2Evidence, p3SourceResult } from './p3-test-helpers.js';

function bindings() {
  const sourceResult = p3SourceResult();
  const p2Evidence = p3P2Evidence(sourceResult);
  const sourceArtifact = createK6ApiSourceArtifact({ sourceResult, p2Evidence });
  return { sourceResult, p2Evidence, sourceArtifact };
}

test('P3 creates a deterministic immutable in-memory Source Artifact', () => {
  const left = bindings();
  const right = bindings();
  assert.deepEqual(left.sourceArtifact, right.sourceArtifact);
  assert.equal(left.sourceArtifact.persistence, 'IN_MEMORY_ONLY');
  assert.equal(left.sourceArtifact.published, false);
  assert.equal(left.sourceArtifact.source, left.sourceResult.source);
  assert.equal(computeK6ApiSourceArtifactDigest(left.sourceArtifact),
    left.sourceArtifact.artifactDigest);
  assert.equal(Object.isFrozen(left.sourceArtifact), true);
  assert.equal(Object.isFrozen(left.sourceArtifact.provenance), true);
  assert.equal(Object.isFrozen(left.sourceArtifact.validationReport), true);
});

test('Artifact provenance binds Source Result, compilation chain and P2 Evidence', () => {
  const { sourceResult, p2Evidence, sourceArtifact } = bindings();
  assert.equal(sourceArtifact.provenance.sourceResultDigest, sourceResult.resultDigest);
  assert.equal(sourceArtifact.provenance.specDigest, sourceResult.specDigest);
  assert.equal(sourceArtifact.provenance.bundleDigest, sourceResult.bundleDigest);
  assert.equal(sourceArtifact.provenance.compilationEvidenceDigest,
    sourceResult.compilationEvidenceDigest);
  assert.equal(sourceArtifact.provenance.p2EvidenceDigest, p2Evidence.evidenceDigest);
  assert.deepEqual(validateK6ApiSourceArtifact(sourceArtifact, { sourceResult, p2Evidence }),
    sourceArtifact);
});

test('Artifact and P2 evidence tampering fail closed', () => {
  const { sourceResult, p2Evidence, sourceArtifact } = bindings();
  for (const artifact of [
    { ...sourceArtifact, published: true },
    { ...sourceArtifact, persistence: 'FILESYSTEM' },
    { ...sourceArtifact, source: `${sourceArtifact.source}x` },
    { ...sourceArtifact, provenance: { ...sourceArtifact.provenance, specDigest: '0'.repeat(64) } },
    { ...sourceArtifact, executed: true },
  ]) assert.throws(() => validateK6ApiSourceArtifact(artifact, { sourceResult, p2Evidence }));

  const changedEvidence = clone(p2Evidence);
  changedEvidence.sourceResult.sourceDigest = '0'.repeat(64);
  assert.throws(() => createK6ApiSourceArtifact({ sourceResult, p2Evidence: changedEvidence }));
});

test('P3 validation evidence is deterministic, digest-bound and non-executing', () => {
  const { sourceResult, p2Evidence, sourceArtifact } = bindings();
  const evidence = createK6ApiSourceValidationEvidence({
    sourceArtifact, sourceResult, p2Evidence,
  });
  assert.deepEqual(evidence.decision, K6_API_SOURCE_VALIDATION_DECISION);
  assert.deepEqual(evidence.safetyBoundary, K6_API_SOURCE_ARTIFACT_SAFETY_BOUNDARY);
  assert.equal(computeK6ApiSourceValidationEvidenceDigest(evidence), evidence.evidenceDigest);
  assert.deepEqual(validateK6ApiSourceValidationEvidence(evidence, {
    sourceArtifact, sourceResult, p2Evidence,
  }), evidence);
  assert.equal(evidence.decision.nextRequiredSlice, 'M3-R2-P4');
  assert.equal(evidence.decision.sourceExecuted, false);
  assert.equal(evidence.decision.executionRuntimeStarted, false);
  for (const [key, value] of Object.entries(evidence.safetyBoundary)) {
    if (key === 'sourceArtifactCreated') assert.equal(value, true, key);
    else assert.equal(value, false, key);
  }
});

test('validation evidence rejects Artifact or decision substitution', () => {
  const { sourceResult, p2Evidence, sourceArtifact } = bindings();
  const evidence = createK6ApiSourceValidationEvidence({
    sourceArtifact, sourceResult, p2Evidence,
  });
  assert.throws(() => validateK6ApiSourceValidationEvidence({
    ...evidence,
    decision: { ...evidence.decision, artifactPublished: true },
  }, { sourceArtifact, sourceResult, p2Evidence }));
  assert.throws(() => validateK6ApiSourceValidationEvidence({
    ...evidence,
    artifactDigest: '0'.repeat(64),
  }, { sourceArtifact, sourceResult, p2Evidence }));
});
