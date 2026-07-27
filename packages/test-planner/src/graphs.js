import { canonicalize, sha256 } from '@kdtp/knowledge-core';
import { clonePlanningJson } from '@kdtp/test-plan';
import {
  TEST_COVERAGE_MATRIX_SCHEMA_VERSION,
  TEST_DEPENDENCY_DAG_SCHEMA_VERSION,
  TEST_PROVENANCE_GRAPH_SCHEMA_VERSION,
} from './constants.js';
import { TestPlannerError, plannerInvariant } from './errors.js';

export function createDependencyDag(intents) {
  const ordered = [...intents].sort((a, b) => a.intentId.localeCompare(b.intentId));
  const byId = new Map(ordered.map((intent) => [intent.intentId, intent]));
  const nodes = ordered.map((intent) => ({
    intentId: intent.intentId,
    targetId: intent.targetId,
    capabilityId: intent.capability.capabilityId,
    capabilityVersion: intent.capability.version,
  }));
  const edges = [];
  const outgoing = new Map(nodes.map((node) => [node.intentId, []]));
  const indegree = new Map(nodes.map((node) => [node.intentId, 0]));
  for (const intent of ordered) {
    for (const dependency of intent.dependencies) {
      plannerInvariant(byId.has(dependency), 'UNKNOWN_INTENT_DEPENDENCY',
        'Dependency DAG references an unknown intent', { intentId: intent.intentId, dependency });
      plannerInvariant(dependency !== intent.intentId, 'DEPENDENCY_CYCLE',
        'Dependency DAG contains a self cycle', { intentId: intent.intentId });
      edges.push({ from: dependency, to: intent.intentId });
      outgoing.get(dependency).push(intent.intentId);
      indegree.set(intent.intentId, indegree.get(intent.intentId) + 1);
    }
  }
  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  for (const values of outgoing.values()) values.sort();
  const ready = nodes.map((node) => node.intentId).filter((id) => indegree.get(id) === 0).sort();
  const topologicalOrder = [];
  while (ready.length > 0) {
    const current = ready.shift();
    topologicalOrder.push(current);
    for (const dependent of outgoing.get(current)) {
      const next = indegree.get(dependent) - 1;
      indegree.set(dependent, next);
      if (next === 0) insertSorted(ready, dependent);
    }
  }
  if (topologicalOrder.length !== nodes.length) {
    const cycleIntentIds = nodes.map((node) => node.intentId)
      .filter((id) => indegree.get(id) > 0)
      .sort();
    throw new TestPlannerError('DEPENDENCY_CYCLE', 'Dependency DAG contains a cycle', {
      intentIds: cycleIntentIds,
    });
  }
  return digestPayload({
    schemaVersion: TEST_DEPENDENCY_DAG_SCHEMA_VERSION,
    nodes,
    edges,
    topologicalOrder,
  });
}

export function createCoverageMatrix(obligations) {
  const groups = new Map();
  for (const obligation of [...obligations].sort((a, b) => a.obligationId.localeCompare(b.obligationId))) {
    const key = `${obligation.targetId}|${obligation.capability.capabilityId}@${obligation.capability.version}`;
    const group = groups.get(key) ?? {
      targetId: obligation.targetId,
      capabilityId: obligation.capability.capabilityId,
      capabilityVersion: obligation.capability.version,
      obligationIds: [],
      intentIds: [],
      mandatory: false,
      statuses: [],
    };
    group.obligationIds.push(obligation.obligationId);
    group.intentIds.push(...obligation.intentIds);
    group.mandatory ||= obligation.mandatory;
    group.statuses.push(obligation.status);
    groups.set(key, group);
  }
  const cells = [...groups.values()].map((group) => {
    const statuses = [...new Set(group.statuses)].sort();
    return {
      targetId: group.targetId,
      capabilityId: group.capabilityId,
      capabilityVersion: group.capabilityVersion,
      mandatory: group.mandatory,
      status: statuses.length === 1 ? statuses[0] : 'PARTIAL',
      obligationIds: [...new Set(group.obligationIds)].sort(),
      intentIds: [...new Set(group.intentIds)].sort(),
    };
  }).sort(compareMatrixCell);
  const summary = {
    total: cells.length,
    mandatory: cells.filter((cell) => cell.mandatory).length,
    covered: cells.filter((cell) => cell.status === 'COVERED').length,
    partial: cells.filter((cell) => cell.status === 'PARTIAL').length,
    unplanned: cells.filter((cell) => cell.status === 'UNPLANNED').length,
    exempt: cells.filter((cell) => cell.status === 'EXEMPT').length,
  };
  return digestPayload({
    schemaVersion: TEST_COVERAGE_MATRIX_SCHEMA_VERSION,
    cells,
    summary,
  });
}

export function createProvenanceGraph(plan) {
  const nodes = new Map();
  const edges = new Map();
  const addNode = (kind, ref) => {
    const payload = canonicalize({ kind, ref });
    const nodeId = `node-${sha256(payload).slice(0, 16)}`;
    nodes.set(nodeId, { nodeId, ...payload });
    return nodeId;
  };
  const addEdge = (kind, from, to) => {
    const payload = { kind, from, to };
    const edgeId = `edge-${sha256(payload).slice(0, 16)}`;
    edges.set(edgeId, { edgeId, ...payload });
  };
  const snapshotNode = addNode('snapshot', {
    snapshotId: plan.knowledgeSnapshot.snapshotId,
    digest: plan.knowledgeSnapshot.digest,
  });
  const catalogNode = addNode('capability-catalog', plan.capabilityCatalog);
  const provenanceByIntent = new Map();
  for (const item of plan.provenance) {
    const list = provenanceByIntent.get(item.intentId) ?? [];
    list.push(item);
    provenanceByIntent.set(item.intentId, list);
  }
  for (const intent of plan.intents) {
    const intentNode = addNode('intent', { intentId: intent.intentId });
    const targetNode = addNode('target', { targetId: intent.targetId });
    const capabilityNode = addNode('capability', intent.capability);
    const policyNode = addNode('planning-policy-entry', { policyEntryId: intent.policyEntryId });
    addEdge('TARGETS', targetNode, intentNode);
    addEdge('USES_CAPABILITY', capabilityNode, intentNode);
    addEdge('SELECTED_BY_POLICY', policyNode, intentNode);
    addEdge('BOUND_TO_SNAPSHOT', snapshotNode, intentNode);
    addEdge('BOUND_TO_CATALOG', catalogNode, intentNode);
    for (const item of (provenanceByIntent.get(intent.intentId) ?? []).sort(compareProvenance)) {
      const knowledgeNode = addNode('knowledge', {
        knowledgeId: item.knowledgeId,
        knowledgeVersion: item.knowledgeVersion,
        boundaryKey: item.boundaryKey,
      });
      addEdge('DERIVED_FROM_KNOWLEDGE', knowledgeNode, intentNode);
    }
  }
  return digestPayload({
    schemaVersion: TEST_PROVENANCE_GRAPH_SCHEMA_VERSION,
    nodes: [...nodes.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
    edges: [...edges.values()].sort((a, b) => a.edgeId.localeCompare(b.edgeId)),
  });
}

function compareMatrixCell(a, b) {
  return a.targetId.localeCompare(b.targetId)
    || a.capabilityId.localeCompare(b.capabilityId)
    || a.capabilityVersion.localeCompare(b.capabilityVersion);
}

function compareProvenance(a, b) {
  return a.knowledgeId.localeCompare(b.knowledgeId)
    || a.knowledgeVersion.localeCompare(b.knowledgeVersion)
    || a.boundaryKey.localeCompare(b.boundaryKey);
}

function insertSorted(items, value) {
  let index = 0;
  while (index < items.length && items[index].localeCompare(value) < 0) index += 1;
  items.splice(index, 0, value);
}

function digestPayload(payload) {
  const normalized = canonicalize(payload);
  return clonePlanningJson({ ...normalized, digest: sha256(normalized) });
}

