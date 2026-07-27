export function context(overrides = {}) {
  return {
    globalId: 'company',
    projectId: 'approval-platform',
    environmentId: 'staging',
    releaseId: 'R1',
    domainPacks: ['approval-workflow'],
    ...overrides,
  };
}

export function rule({
  id,
  boundaryKey = 'sample.boundary',
  level = 'GLOBAL',
  key = 'company',
  enforcement = 'default',
  overridePolicy = 'allow',
  enabled = true,
  value = { enabled: true },
  ...rest
}) {
  return {
    id,
    boundaryKey,
    name: id,
    version: '1.0.0',
    status: 'PUBLISHED',
    scope: { level, key },
    enforcement,
    overridePolicy,
    enabled,
    value,
    owner: 'quality-platform',
    source: 'test',
    ...rest,
  };
}
