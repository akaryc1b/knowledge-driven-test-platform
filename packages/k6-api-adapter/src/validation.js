import { K6_API_REQUIRED_OUTPUT_ARTIFACT_KINDS } from './constants.js';
import { compilerInvariant } from './errors.js';

export function validateCompilerBindings(descriptor, request, record) {
  compilerInvariant(record.status === 'FROZEN', 'K6_API_TEST_PLAN_NOT_FROZEN',
    'Compiler requires a FROZEN Test Plan record');
  compilerInvariant(record.planId === request.frozenTestPlan.planId
      && record.projectId === request.projectId
      && record.environmentId === request.environment.environmentId
      && record.revision === request.frozenTestPlan.revision
      && record.inputFingerprint === request.frozenTestPlan.inputFingerprint
      && record.contentDigest === request.frozenTestPlan.digest,
  'K6_API_PLAN_REQUEST_BINDING_MISMATCH',
  'FROZEN Test Plan does not match the Execution Request binding');
  compilerInvariant(record.knowledgeSnapshot.snapshotId
      === request.frozenTestPlan.knowledgeSnapshot.snapshotId
      && record.knowledgeSnapshot.digest
      === request.frozenTestPlan.knowledgeSnapshot.digest,
  'K6_API_SNAPSHOT_BINDING_MISMATCH',
  'Knowledge Snapshot does not match the Execution Request binding');
  const supported = new Set(descriptor.supportedCapabilities.map(capabilityKey));
  const requested = new Set(request.requestedCapabilities.map(capabilityKey));
  for (const capability of request.requestedCapabilities) {
    compilerInvariant(supported.has(capabilityKey(capability)),
      'K6_API_CAPABILITY_NOT_AUTHORIZED', 'Requested capability is outside descriptor allow-list');
  }
  for (const intent of record.planningResult.plan.intents) {
    compilerInvariant(requested.has(capabilityKey(intent.capability)),
      'K6_API_PLAN_CAPABILITY_NOT_REQUESTED',
      'FROZEN Test Plan contains a capability not explicitly requested', {
        intentId: intent.intentId,
        capability: intent.capability,
      });
    compilerInvariant(descriptor.acceptedIntentKinds.includes(intent.intentKind),
      'K6_API_INTENT_KIND_NOT_ACCEPTED', 'Descriptor does not accept a Test Plan intent kind', {
        intentId: intent.intentId,
        intentKind: intent.intentKind,
      });
  }
  for (const kind of K6_API_REQUIRED_OUTPUT_ARTIFACT_KINDS) {
    compilerInvariant(descriptor.outputArtifactKinds.includes(kind),
      'K6_API_OUTPUT_KIND_NOT_AUTHORIZED', 'Descriptor does not authorize a compiler output kind', {
        kind,
      });
  }
}

export function compareCapability(left, right) {
  return capabilityKey(left).localeCompare(capabilityKey(right));
}

export function capabilityKey(value) {
  return `${value.capabilityId}@${value.version}`;
}

export function exactFields(value, required, code, label, allowOptional = false, optional = []) {
  compilerInvariant(value && typeof value === 'object' && !Array.isArray(value),
    code, `${label} must be an object`);
  const requiredFields = [...required];
  const optionalFields = [...optional];
  const allowed = new Set([...requiredFields, ...optionalFields]);
  const actual = Object.keys(value).sort();
  for (const field of actual) compilerInvariant(allowed.has(field), code,
    `${label} contains an unsupported field`, { field });
  const mandatory = allowOptional
    ? requiredFields.filter((field) => !optionalFields.includes(field))
    : requiredFields;
  for (const field of mandatory) compilerInvariant(Object.hasOwn(value, field), code,
    `${label} field is missing`, { field });
}

export function unique(values, code) {
  compilerInvariant(new Set(values).size === values.length, code, 'Values must be unique');
}
