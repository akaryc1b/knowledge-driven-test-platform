export function toKnowledgeSummary(record) {
  const knowledge = record.knowledge;
  return {
    key: record.key,
    id: knowledge.id,
    version: knowledge.version,
    name: knowledge.name,
    boundaryKey: knowledge.boundaryKey,
    status: knowledge.status,
    riskLevel: knowledge.riskLevel,
    owner: knowledge.owner,
    enabled: knowledge.enabled,
    scope: structuredClone(knowledge.scope),
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toKnowledgeDetail(record) {
  return {
    ...toKnowledgeSummary(record),
    description: record.knowledge.description ?? null,
    enforcement: record.knowledge.enforcement,
    overridePolicy: record.knowledge.overridePolicy,
    mergeStrategy: record.knowledge.mergeStrategy,
    overrideIntent: record.knowledge.overrideIntent ?? null,
    value: structuredClone(record.knowledge.value),
    source: record.knowledge.source,
    tags: structuredClone(record.knowledge.tags ?? []),
    references: structuredClone(record.knowledge.references ?? []),
    historyCount: record.history.length,
  };
}

export function toTimelineDto(timeline) {
  const registryEvents = timeline.events.filter((event) => event.kind === 'REGISTRY_EVENT');
  return {
    projectId: timeline.projectId,
    key: timeline.key,
    currentStatus: timeline.currentStatus,
    revision: timeline.revision,
    knowledge: {
      id: timeline.knowledge.id,
      version: timeline.knowledge.version,
      name: timeline.knowledge.name,
      boundaryKey: timeline.knowledge.boundaryKey,
      status: timeline.knowledge.status,
      riskLevel: timeline.knowledge.riskLevel,
      owner: timeline.knowledge.owner,
      scope: structuredClone(timeline.knowledge.scope),
    },
    createdAt: registryEvents[0]?.at ?? null,
    updatedAt: timeline.events.at(-1)?.at ?? null,
    events: timeline.events.map((event) => ({
      kind: event.kind,
      eventType: event.eventType,
      at: event.at,
      actor: event.actor,
      reason: event.reason,
      sequence: event.sequence ?? null,
      fromStatus: event.fromStatus ?? null,
      toStatus: event.toStatus ?? null,
      decisionId: event.decisionId ?? null,
      reviewRevision: event.reviewRevision ?? null,
    })),
  };
}

export function toSnapshotSummary(envelope) {
  return {
    snapshotId: envelope.snapshotId,
    digest: envelope.digest,
    projectId: envelope.projectId,
    environmentId: envelope.environmentId,
    releaseId: envelope.releaseId,
    createdBy: envelope.createdBy,
    createdAt: envelope.createdAt,
    reason: envelope.reason,
    ruleCount: envelope.snapshot.rules.length,
  };
}

export function toSnapshotDetail(envelope) {
  return {
    ...toSnapshotSummary(envelope),
    snapshot: structuredClone(envelope.snapshot),
  };
}
