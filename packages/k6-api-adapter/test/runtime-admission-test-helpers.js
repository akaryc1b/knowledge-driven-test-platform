import { rendererBindings } from '../../../examples/k6-api-source-renderer-fixture.js';
import { ACCEPTED_P3 } from '../../../scripts/m3-r2-p5-baseline.js';
import {
  createK6ApiInvocationPlan,
  createK6ApiRuntimeAdmissionEvidence,
  createK6ApiRuntimeAdmissionRequest,
  createK6ApiRuntimePolicy,
} from '../src/runtime-admission.js';
import { loadAcceptedP5Fixture } from './p5-test-helpers.js';

export async function runtimeAdmissionFixture(options = {}) {
  const acceptedFixture = await loadAcceptedP5Fixture();
  const renderer = rendererBindings();
  const publication = acceptedFixture.receipt.publication;
  const acceptedP3 = {
    evidenceDigest: ACCEPTED_P3.evidenceDigest,
    sourceArtifactDigest: ACCEPTED_P3.sourceArtifactDigest,
    validationEvidenceDigest: ACCEPTED_P3.validationEvidenceDigest,
    sourceDigest: ACCEPTED_P3.sourceDigest,
  };
  const executionRequest = {
    requestId: `exec-approval-platform-${'a'.repeat(16)}`,
    requestDigest: renderer.compilationEvidence.executionRequestDigest,
    projectId: renderer.spec.projectId,
    environmentDigest: renderer.spec.environment.digest,
    frozenTestPlanDigest: renderer.spec.frozenTestPlan.contentDigest,
    knowledgeSnapshotDigest: renderer.spec.knowledgeSnapshot.digest,
    adapter: { ...renderer.spec.adapter },
  };
  const policy = createK6ApiRuntimePolicy();
  const resources = {
    vus: 2,
    iterations: 10,
    durationMs: 60_000,
    gracefulStopMs: 5_000,
    environmentVariableNames: [],
    outputArtifactKinds: [],
    ...(options.resources ?? {}),
  };
  options.transformExecutionRequest?.(executionRequest);
  options.transformSpec?.(renderer.spec);
  options.transformCompilationEvidence?.(renderer.compilationEvidence);
  options.transformBundle?.(publication.bundle);
  options.transformReceipt?.(publication.receipt);
  options.transformPublicationEvidence?.(publication.publicationEvidence);
  options.transformPolicy?.(policy);
  const command = {
    policy,
    executionRequest,
    spec: renderer.spec,
    compilationEvidence: renderer.compilationEvidence,
    bundle: publication.bundle,
    receipt: publication.receipt,
    publicationEvidence: publication.publicationEvidence,
    acceptedP3,
    resources,
    requestedAt: options.requestedAt ?? '2026-08-04T01:30:00.000Z',
    requestedBy: options.requestedBy ?? 'm3-r3-r0-test',
  };
  const admissionRequest = createK6ApiRuntimeAdmissionRequest(command);
  const invocationPlan = createK6ApiInvocationPlan(admissionRequest, policy);
  const admissionEvidence = createK6ApiRuntimeAdmissionEvidence({
    admissionRequest,
    invocationPlan,
  });
  return {
    acceptedFixture,
    acceptedP3,
    renderer,
    policy,
    resources,
    executionRequest,
    command,
    admissionRequest,
    invocationPlan,
    admissionEvidence,
  };
}

export function clone(value) {
  return structuredClone(value);
}
