export const T0 = '2026-07-27T12:00:00.000Z';
export const T1 = '2026-07-27T12:01:00.000Z';
export const T2 = '2026-07-27T12:02:00.000Z';
export const T3 = '2026-07-27T12:03:00.000Z';
export const T4 = '2026-07-27T12:04:00.000Z';

export function knowledge(overrides = {}) {
  return {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-SAMPLE-001',
    boundaryKey: 'sample.boundary',
    name: 'Sample knowledge',
    version: '1.0.0',
    status: 'DRAFT',
    scope: { level: 'PROJECT', key: 'approval-platform' },
    enforcement: 'default',
    overridePolicy: 'allow',
    enabled: true,
    value: { expected: true },
    owner: 'quality-platform-team',
    source: 'registry contract test',
    riskLevel: 'high',
    ...overrides,
  };
}

export function createCommand(overrides = {}) {
  return {
    knowledge: knowledge(),
    actor: 'quality-engineer',
    at: T0,
    reason: 'create draft',
    ...overrides,
  };
}

export function transitionCommand(record, toStatus, at, overrides = {}) {
  return {
    id: record.knowledge.id,
    version: record.knowledge.version,
    expectedRevision: record.revision,
    toStatus,
    actor: 'quality-reviewer',
    at,
    reason: `transition to ${toStatus}`,
    ...overrides,
  };
}
