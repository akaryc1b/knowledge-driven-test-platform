import { canonicalize, sha256 } from '@kdtp/knowledge-core';
import {
  CapabilityCatalogError,
  capabilityKey,
  validateCapabilityCatalog,
} from '@kdtp/test-capability';
import {
  assertNoExecutorCode,
  assertNoSensitivePlanningData,
  clonePlanningJson,
  createCoverageObligation,
  createProvenanceEntry,
  createTestIntent,
  createTestPlan,
  validateIdentifier,
  validateKind,
  validatePlanningRequest,
  validateTestPlan,
} from '@kdtp/test-plan';
import {
  DEPENDENCY_TARGET_SCOPES,
  TEST_PLANNING_RESULT_SCHEMA_VERSION,
} from './constants.js';
import { TestPlannerError, plannerInvariant } from './errors.js';
import {
  createCoverageMatrix,
  createDependencyDag,
  createProvenanceGraph,
} from './graphs.js';
import { TestPlannerPort } from './ports.js';
import { DeclarativePlanningStrategy } from './strategy.js';

const SPEC_FIELDS = new Set(['intentKey', 'input', 'assertions', 'thresholds', 'tags']);
const RESULT_FIELDS = new Set([
  'schemaVersion', 'plan', 'coverageMatrix', 'provenanceGraph', 'dependencyDag',
  'unsupportedObligations', 'digest',
]);

export class DeterministicTestPlanner extends TestPlannerPort {
  #catalogPort;
  #strategy;

  constructor({ capabilityCatalogPort, strategy = new DeclarativePlanningStrategy() } = {}) {
    super();
    plannerInvariant(capabilityCatalogPort
        && typeof capabilityCatalogPort.getCatalog === 'function'
        && typeof capabilityCatalogPort.assertCompatible === 'function',
    'INVALID_PLANNER_INPUT', 'A CapabilityCatalogPort is required');
    plannerInvariant(strategy && typeof strategy.createIntentSpecs === 'function',
      'INVALID_PLANNER_INPUT', 'A PlanningStrategyPort is required');
    this.#catalogPort = capabilityCatalogPort;
    this.#strategy = strategy;
  }

  async plan(input) {
    const request = validatePlanningRequest(input?.planningRequest ?? input);
    const catalog = validateCapabilityCatalog(await this.#catalogPort.getCatalog());
    plannerInvariant(request.capabilityCatalogVersion === catalog.version
        && request.capabilityCatalogDigest === catalog.digest,
    'PLANNER_CATALOG_BINDING_MISMATCH',
    'Planning request is not bound to the exact capability catalog', {
      requestedVersion: request.capabilityCatalogVersion,
      requestedDigest: request.capabilityCatalogDigest,
      actualVersion: catalog.version,
      actualDigest: catalog.digest,
    });

    const candidates = enumerateCandidates(request);
    const states = [];
    for (const candidate of candidates) {
      states.push(await this.#prepareCandidate(request, candidate));
    }
    resolveRequiredDependencies(states);
    const finalIntents = finalizeIntents(states);
    const dependencyDag = createDependencyDag(finalIntents);
    const obligations = createObligations(request, states);
    const provenance = createProvenance(request, finalIntents);
    const plan = validateTestPlan(createTestPlan({
      planningRequest: request,
      intents: finalIntents,
      coverageObligations: obligations,
      provenance,
    }));
    const coverageMatrix = createCoverageMatrix(plan.coverage.obligations);
    const provenanceGraph = createProvenanceGraph(plan);
    const unsupportedObligations = createUnsupportedEvidence(states, plan.coverage.obligations);
    const payload = {
      schemaVersion: TEST_PLANNING_RESULT_SCHEMA_VERSION,
      plan,
      coverageMatrix,
      provenanceGraph,
      dependencyDag,
      unsupportedObligations,
    };
    return clonePlanningJson({ ...payload, digest: sha256(payload) });
  }

  async #prepareCandidate(request, candidate) {
    let capability;
    try {
      capability = await this.#catalogPort.assertCompatible(
        candidate.capabilityRef,
        candidate.target.kind,
      );
    } catch (error) {
      if (error instanceof CapabilityCatalogError || typeof error?.code === 'string') {
        return unsupportedState(candidate, error.code ?? 'UNSUPPORTED_OBLIGATION',
          'Capability cannot be used for this coverage obligation');
      }
      throw error;
    }
    const exemption = findExemption(request.planningPolicy.exemptions, candidate);
    if (exemption) {
      return { ...candidate, kind: 'EXEMPT', capability, exemption, active: false, records: [] };
    }

    let rawSpecs;
    try {
      rawSpecs = await this.#strategy.createIntentSpecs(clonePlanningJson({
        planningRequest: request,
        knowledge: candidate.knowledge,
        target: candidate.target,
        capability,
        policyEntry: candidate.policyEntry,
      }));
    } catch (error) {
      if (error instanceof TestPlannerError && error.code === 'UNSUPPORTED_OBLIGATION') {
        return unsupportedState(candidate, error.code, error.message, capability);
      }
      throw error;
    }
    const specs = normalizeIntentSpecs(rawSpecs, capability);
    if (specs.length === 0) {
      return unsupportedState(candidate, 'UNSUPPORTED_OBLIGATION',
        'Planning strategy did not produce any intent', capability);
    }
    const sourceKnowledge = [knowledgeReference(request, candidate.knowledge)];
    const records = specs.map((spec) => {
      const intent = createTestIntent({
        planInputFingerprint: request.inputFingerprint,
        intentKind: capability.intentKind,
        targetId: candidate.target.targetId,
        capability: candidate.capabilityRef,
        sourceKnowledge,
        policyEntryId: candidate.policyEntry.policyEntryId,
        input: spec.input,
        assertions: spec.assertions,
        thresholds: spec.thresholds,
        dependencies: [],
        tags: spec.tags,
      });
      return { intentKey: spec.intentKey, intent, capability, candidateId: candidate.candidateId };
    });
    return {
      ...candidate,
      kind: 'PLANNED',
      capability,
      active: true,
      records: deduplicateRecords(records),
    };
  }
}

export function validatePlanningResult(input) {
  plannerInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLANNING_RESULT', 'Planning result must be an object');
  assertOnlyFields(input, RESULT_FIELDS, 'INVALID_PLANNING_RESULT', 'Planning result');
  plannerInvariant(input.schemaVersion === TEST_PLANNING_RESULT_SCHEMA_VERSION,
    'INVALID_PLANNING_RESULT_SCHEMA', 'Planning result schema version is unsupported');
  const plan = validateTestPlan(input.plan);
  plannerInvariant(Array.isArray(input.unsupportedObligations),
    'INVALID_PLANNING_RESULT', 'unsupportedObligations must be an array');
  const expectedCoverage = createCoverageMatrix(plan.coverage.obligations);
  const expectedGraph = createProvenanceGraph(plan);
  const expectedDag = createDependencyDag(plan.intents);
  plannerInvariant(canonicalEqual(input.coverageMatrix, expectedCoverage),
    'COVERAGE_MATRIX_MISMATCH', 'Coverage matrix does not match the plan');
  plannerInvariant(canonicalEqual(input.provenanceGraph, expectedGraph),
    'PROVENANCE_GRAPH_MISMATCH', 'Provenance graph does not match the plan');
  plannerInvariant(canonicalEqual(input.dependencyDag, expectedDag),
    'DEPENDENCY_DAG_MISMATCH', 'Dependency DAG does not match the plan');
  validateUnsupportedEvidence(input.unsupportedObligations, plan);
  const payload = {
    schemaVersion: input.schemaVersion,
    plan,
    coverageMatrix: expectedCoverage,
    provenanceGraph: expectedGraph,
    dependencyDag: expectedDag,
    unsupportedObligations: clonePlanningJson(input.unsupportedObligations),
  };
  plannerInvariant(input.digest === sha256(payload),
    'PLANNING_RESULT_DIGEST_MISMATCH', 'Planning result digest does not match canonical content');
  return clonePlanningJson({ ...payload, digest: input.digest });
}

function enumerateCandidates(request) {
  const rules = [...request.knowledgeSnapshot.snapshot.rules].sort(compareKnowledge);
  const targets = [...request.targetInventory.targets].sort((a, b) => a.targetId.localeCompare(b.targetId));
  const candidates = [];
  for (const policyEntry of request.planningPolicy.entries) {
    for (const knowledge of rules) {
      if (!matchesKnowledge(policyEntry.selectors, knowledge)) continue;
      for (const target of targets) {
        if (!matchesTarget(policyEntry.selectors, target)) continue;
        for (const capabilityRef of policyEntry.capabilityRefs) {
          const identity = canonicalize({
            policyEntryId: policyEntry.policyEntryId,
            knowledgeId: knowledge.id,
            knowledgeVersion: knowledge.version,
            targetId: target.targetId,
            capability: capabilityRef,
          });
          candidates.push({
            candidateId: `candidate-${sha256(identity).slice(0, 16)}`,
            knowledge,
            target,
            capabilityRef,
            policyEntry,
          });
        }
      }
    }
  }
  return candidates.sort(compareCandidate);
}

function normalizeIntentSpecs(input, capability) {
  plannerInvariant(Array.isArray(input), 'INVALID_PLANNING_STRATEGY_RESULT',
    'Planning strategy must return an array of intent specs');
  plannerInvariant(input.length <= 1000, 'INVALID_PLANNING_STRATEGY_RESULT',
    'Planning strategy returned too many intent specs');
  const byKey = new Map();
  for (const raw of input) {
    plannerInvariant(raw && typeof raw === 'object' && !Array.isArray(raw),
      'INVALID_PLANNING_STRATEGY_RESULT', 'Intent spec must be an object');
    assertOnlyFields(raw, SPEC_FIELDS, 'INVALID_PLANNING_STRATEGY_RESULT', 'Intent spec');
    const spec = {
      intentKey: validateIdentifier(raw.intentKey, 'intentKey'),
      input: clonePlanningJson(raw.input ?? {}),
      assertions: clonePlanningJson(raw.assertions ?? {}),
      thresholds: clonePlanningJson(raw.thresholds ?? {}),
      tags: normalizeTags(raw.tags ?? []),
    };
    assertNoSensitivePlanningData(spec, { path: '$.planningStrategy' });
    assertNoExecutorCode(spec, '$.planningStrategy');
    validateContractPayload(spec.input, capability.inputContract, 'input');
    validateContractPayload(spec.assertions, capability.assertionContract, 'assertions');
    validateContractPayload(spec.thresholds, capability.thresholdContract, 'thresholds');
    const existing = byKey.get(spec.intentKey);
    if (existing && !canonicalEqual(existing, spec)) {
      throw new TestPlannerError('INTENT_CONFLICT',
        'Planning strategy produced conflicting intents for the same logical key', {
          intentKey: spec.intentKey,
          capabilityId: capability.capabilityId,
          capabilityVersion: capability.version,
        });
    }
    byKey.set(spec.intentKey, existing ?? spec);
  }
  return [...byKey.values()].sort((a, b) => a.intentKey.localeCompare(b.intentKey));
}

function validateContractPayload(payload, contract, label) {
  plannerInvariant(payload && typeof payload === 'object' && !Array.isArray(payload),
    'CAPABILITY_CONTRACT_VIOLATION', `${label} payload must be an object`);
  const fields = contract.fields ?? [];
  plannerInvariant(Array.isArray(fields), 'INVALID_CAPABILITY_CONTRACT',
    `${label} capability contract fields must be an array`);
  const allowed = new Map();
  for (const field of fields) {
    plannerInvariant(field && typeof field === 'object' && !Array.isArray(field)
        && typeof field.name === 'string' && field.name.length > 0,
    'INVALID_CAPABILITY_CONTRACT', `${label} capability contract field is invalid`);
    allowed.set(field.name, field);
    if (field.required === true) {
      plannerInvariant(Object.hasOwn(payload, field.name), 'CAPABILITY_CONTRACT_VIOLATION',
        `Required ${label} field is missing`, { field: field.name });
    }
  }
  if (contract.additionalProperties === false) {
    for (const key of Object.keys(payload)) {
      plannerInvariant(allowed.has(key), 'CAPABILITY_CONTRACT_VIOLATION',
        `${label} payload contains a field outside the capability contract`, { field: key });
    }
  }
  for (const [name, field] of allowed) {
    if (!Object.hasOwn(payload, name) || field.type === undefined) continue;
    plannerInvariant(matchesType(payload[name], field.type), 'CAPABILITY_CONTRACT_VIOLATION',
      `${label} field type does not match the capability contract`, { field: name, type: field.type });
  }
}

function resolveRequiredDependencies(states) {
  let changed;
  do {
    changed = false;
    const activeRecords = states.filter((state) => state.kind === 'PLANNED' && state.active)
      .flatMap((state) => state.records);
    for (const state of states) {
      if (state.kind !== 'PLANNED' || !state.active) continue;
      for (const rule of state.capability.dependencyRules) {
        if (!DEPENDENCY_TARGET_SCOPES.includes(rule.targetScope)) {
          state.active = false;
          state.unsupported = {
            code: 'UNSUPPORTED_DEPENDENCY_SCOPE',
            reason: 'Capability dependency target scope is not supported by planner v1',
          };
          changed = true;
          break;
        }
        if (rule.required && findDependencyRecords(state, rule, activeRecords).length === 0) {
          state.active = false;
          state.unsupported = {
            code: 'REQUIRED_DEPENDENCY_MISSING',
            reason: 'Required capability dependency has no planned intent',
          };
          changed = true;
          break;
        }
      }
    }
  } while (changed);
}

function finalizeIntents(states) {
  const activeRecords = states.filter((state) => state.kind === 'PLANNED' && state.active)
    .flatMap((state) => state.records);
  const output = [];
  for (const state of states) {
    if (state.kind !== 'PLANNED' || !state.active) continue;
    const dependencies = state.capability.dependencyRules.flatMap((rule) =>
      findDependencyRecords(state, rule, activeRecords).map((record) => record.intent.intentId));
    const normalizedDependencies = [...new Set(dependencies)].sort();
    state.finalIntents = state.records.map((record) => {
      const intent = createTestIntent({
        ...record.intent,
        dependencies: normalizedDependencies,
      });
      plannerInvariant(intent.intentId === record.intent.intentId,
        'NON_DETERMINISTIC_PLANNING_RESULT',
        'Adding dependency metadata changed deterministic intent identity');
      return intent;
    }).sort((a, b) => a.intentId.localeCompare(b.intentId));
    output.push(...state.finalIntents);
  }
  return deduplicateIntents(output);
}

function createObligations(request, states) {
  return states.map((state) => {
    let status = 'UNPLANNED';
    let intentIds = [];
    let exemption;
    if (state.kind === 'EXEMPT') {
      status = 'EXEMPT';
      exemption = { reason: state.exemption.reason, owner: state.exemption.owner };
    } else if (state.kind === 'PLANNED' && state.active) {
      status = 'COVERED';
      intentIds = state.finalIntents.map((intent) => intent.intentId);
    }
    return createCoverageObligation({
      planInputFingerprint: request.inputFingerprint,
      targetId: state.target.targetId,
      capability: state.capabilityRef,
      sourceKnowledge: [knowledgeReference(request, state.knowledge)],
      policyEntryId: state.policyEntry.policyEntryId,
      mandatory: state.policyEntry.mandatory,
      status,
      intentIds,
      ...(exemption ? { exemption } : {}),
    });
  }).sort((a, b) => a.obligationId.localeCompare(b.obligationId));
}

function createProvenance(request, intents) {
  return intents.flatMap((intent) => intent.sourceKnowledge.map((source) => createProvenanceEntry({
    intentId: intent.intentId,
    knowledgeId: source.knowledgeId,
    knowledgeVersion: source.version,
    boundaryKey: source.boundaryKey,
    snapshotId: request.knowledgeSnapshotId,
    snapshotDigest: request.knowledgeSnapshotDigest,
    capabilityId: intent.capability.capabilityId,
    capabilityVersion: intent.capability.version,
    targetId: intent.targetId,
    policyEntryId: intent.policyEntryId,
  }))).sort((a, b) => a.provenanceId.localeCompare(b.provenanceId));
}

function createUnsupportedEvidence(states, obligations) {
  const byCandidate = new Map(states.map((state) => [state.candidateId, state]));
  const obligationByBinding = new Map(obligations.map((obligation) => [obligationBinding(obligation), obligation]));
  return [...byCandidate.values()].filter((state) => state.kind === 'UNSUPPORTED'
      || (state.kind === 'PLANNED' && !state.active))
    .map((state) => {
      const obligation = obligationByBinding.get(candidateBinding(state));
      return {
        obligationId: obligation.obligationId,
        code: state.unsupported.code,
        reason: state.unsupported.reason,
        mandatory: state.policyEntry.mandatory,
        targetId: state.target.targetId,
        capabilityId: state.capabilityRef.capabilityId,
        capabilityVersion: state.capabilityRef.version,
        knowledgeId: state.knowledge.id,
        knowledgeVersion: state.knowledge.version,
        policyEntryId: state.policyEntry.policyEntryId,
      };
    }).sort((a, b) => a.obligationId.localeCompare(b.obligationId));
}

function validateUnsupportedEvidence(items, plan) {
  const obligations = new Map(plan.coverage.obligations.map((item) => [item.obligationId, item]));
  const seen = new Set();
  for (const item of items) {
    plannerInvariant(item && typeof item === 'object' && !Array.isArray(item),
      'INVALID_UNSUPPORTED_OBLIGATION', 'Unsupported obligation evidence must be an object');
    plannerInvariant(!seen.has(item.obligationId), 'INVALID_UNSUPPORTED_OBLIGATION',
      'Unsupported obligation evidence must be unique');
    seen.add(item.obligationId);
    const obligation = obligations.get(item.obligationId);
    plannerInvariant(obligation?.status === 'UNPLANNED', 'INVALID_UNSUPPORTED_OBLIGATION',
      'Unsupported evidence must reference an UNPLANNED obligation');
    plannerInvariant(typeof item.code === 'string' && item.code.length > 0
        && typeof item.reason === 'string' && item.reason.length > 0,
    'INVALID_UNSUPPORTED_OBLIGATION', 'Unsupported evidence requires code and reason');
  }
  const unplanned = plan.coverage.obligations.filter((item) => item.status === 'UNPLANNED');
  plannerInvariant(unplanned.every((item) => seen.has(item.obligationId)),
    'INVALID_UNSUPPORTED_OBLIGATION', 'Every UNPLANNED obligation requires unsupported evidence');
}

function findDependencyRecords(state, rule, records) {
  return records.filter((record) => capabilityKey(record.capability) === capabilityKey(rule)
      && (rule.targetScope === 'any-target'
        || record.intent.targetId === state.target.targetId))
    .sort((a, b) => a.intent.intentId.localeCompare(b.intent.intentId));
}

function findExemption(exemptions, candidate) {
  const key = exemptionBinding(candidate.knowledge.id, candidate.knowledge.version,
    candidate.target.targetId, candidate.capabilityRef.capabilityId, candidate.capabilityRef.version);
  return exemptions.find((item) => exemptionBinding(item.knowledgeId, item.knowledgeVersion,
    item.targetId, item.capabilityId, item.capabilityVersion) === key);
}

function matchesKnowledge(selectors, knowledge) {
  return matchesValue(selectors.knowledgeIds, knowledge.id)
    && matchesValue(selectors.boundaryKeys, knowledge.boundaryKey)
    && matchesTags(selectors.knowledgeTags, knowledge.tags ?? []);
}

function matchesTarget(selectors, target) {
  return matchesValue(selectors.targetIds, target.targetId)
    && matchesValue(selectors.targetKinds, target.kind)
    && matchesTags(selectors.targetTags, target.tags ?? []);
}

function matchesValue(selectors, value) {
  return selectors.length === 0 || selectors.includes(value);
}

function matchesTags(selectors, values) {
  return selectors.length === 0 || selectors.every((item) => values.includes(item));
}

function knowledgeReference(request, knowledge) {
  return {
    knowledgeId: knowledge.id,
    version: knowledge.version,
    boundaryKey: knowledge.boundaryKey,
    snapshotId: request.knowledgeSnapshotId,
    snapshotDigest: request.knowledgeSnapshotDigest,
  };
}

function unsupportedState(candidate, code, reason, capability) {
  return {
    ...candidate,
    kind: 'UNSUPPORTED',
    capability,
    active: false,
    records: [],
    unsupported: { code, reason },
  };
}

function deduplicateRecords(records) {
  const byId = new Map();
  for (const record of records) {
    const existing = byId.get(record.intent.intentId);
    if (existing && !canonicalEqual(existing.intent, record.intent)) {
      throw new TestPlannerError('INTENT_CONFLICT',
        'Different intent content produced the same deterministic intent identity', {
          intentId: record.intent.intentId,
        });
    }
    byId.set(record.intent.intentId, existing ?? record);
  }
  return [...byId.values()].sort((a, b) => a.intent.intentId.localeCompare(b.intent.intentId));
}

function deduplicateIntents(intents) {
  const byId = new Map();
  for (const intent of intents) {
    const existing = byId.get(intent.intentId);
    plannerInvariant(!existing || canonicalEqual(existing, intent), 'INTENT_CONFLICT',
      'Final intent set contains conflicting deterministic identities', { intentId: intent.intentId });
    byId.set(intent.intentId, existing ?? intent);
  }
  return [...byId.values()].sort((a, b) => a.intentId.localeCompare(b.intentId));
}

function normalizeTags(input) {
  plannerInvariant(Array.isArray(input), 'INVALID_PLANNING_STRATEGY_RESULT',
    'Intent spec tags must be an array');
  const values = input.map((item) => validateKind(item, 'intent.tags')).sort();
  return [...new Set(values)];
}

function matchesType(value, type) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isSafeInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'null') return value === null;
  return typeof value === type;
}

function compareKnowledge(a, b) {
  return a.boundaryKey.localeCompare(b.boundaryKey)
    || a.id.localeCompare(b.id)
    || a.version.localeCompare(b.version);
}

function compareCandidate(a, b) {
  return a.policyEntry.priority - b.policyEntry.priority
    || a.policyEntry.policyEntryId.localeCompare(b.policyEntry.policyEntryId)
    || a.knowledge.boundaryKey.localeCompare(b.knowledge.boundaryKey)
    || a.knowledge.id.localeCompare(b.knowledge.id)
    || a.target.targetId.localeCompare(b.target.targetId)
    || capabilityKey(a.capabilityRef).localeCompare(capabilityKey(b.capabilityRef));
}

function exemptionBinding(knowledgeId, knowledgeVersion, targetId, capabilityId, capabilityVersion) {
  return `${knowledgeId}@${knowledgeVersion}|${targetId}|${capabilityId}@${capabilityVersion}`;
}

function candidateBinding(candidate) {
  return `${candidate.target.targetId}|${capabilityKey(candidate.capabilityRef)}|${candidate.knowledge.id}@${candidate.knowledge.version}|${candidate.policyEntry.policyEntryId}`;
}

function obligationBinding(obligation) {
  const source = obligation.sourceKnowledge[0];
  return `${obligation.targetId}|${capabilityKey(obligation.capability)}|${source.knowledgeId}@${source.version}|${obligation.policyEntryId}`;
}

function canonicalEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function assertOnlyFields(input, allowed, code, label) {
  for (const field of Object.keys(input)) {
    plannerInvariant(allowed.has(field), code, `${label} contains unsupported field`, { field });
  }
}
