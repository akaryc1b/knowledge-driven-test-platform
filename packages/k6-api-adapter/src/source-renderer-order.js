import { cloneExecutionJson } from '@kdtp/execution-contract';
import { sourceRendererInvariant } from './errors.js';

export function orderGroups(groups) {
  return groups.map((group) => ({
    ...cloneExecutionJson(group),
    operations: orderOperations(group.operations),
  })).sort((left, right) => left.groupId.localeCompare(right.groupId));
}

function orderOperations(operations) {
  const byId = new Map(operations.map((operation) => [operation.operationId, operation]));
  const localIds = new Set(byId.keys());
  const indegree = new Map(operations.map((operation) => [operation.operationId, 0]));
  const dependants = new Map(operations.map((operation) => [operation.operationId, []]));
  for (const operation of operations) {
    for (const dependency of operation.dependencyOperationIds) {
      if (!localIds.has(dependency)) continue;
      indegree.set(operation.operationId, indegree.get(operation.operationId) + 1);
      dependants.get(dependency).push(operation.operationId);
    }
  }
  const ready = [...operations.filter((operation) => indegree.get(operation.operationId) === 0)]
    .sort((left, right) => left.operationId.localeCompare(right.operationId));
  const ordered = [];
  while (ready.length > 0) {
    const operation = ready.shift();
    ordered.push(operation);
    for (const dependantId of dependants.get(operation.operationId).sort()) {
      indegree.set(dependantId, indegree.get(dependantId) - 1);
      if (indegree.get(dependantId) === 0) {
        ready.push(byId.get(dependantId));
        ready.sort((left, right) => left.operationId.localeCompare(right.operationId));
      }
    }
  }
  sourceRendererInvariant(ordered.length === operations.length,
    'K6_API_SOURCE_DEPENDENCY_CYCLE', 'Operation dependency graph contains a cycle');
  return ordered;
}
