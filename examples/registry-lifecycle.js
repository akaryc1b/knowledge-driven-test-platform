import { InMemoryKnowledgeRegistry } from '../packages/knowledge-registry/src/index.js';

const registry = new InMemoryKnowledgeRegistry();
let record = await registry.createDraft({
  knowledge: {
    schemaVersion: 'knowledge-rule/v1',
    id: 'GLOBAL-SECURITY-001',
    boundaryKey: 'security.secret-log-redaction',
    name: '日志敏感信息脱敏',
    version: '1.0.0',
    status: 'DRAFT',
    scope: { level: 'GLOBAL', key: 'company' },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: {
      redactHeaders: ['authorization', 'cookie'],
      redactFields: ['password', 'token', 'secret'],
    },
    owner: 'quality-platform-team',
    source: 'M1-A registry lifecycle example',
    riskLevel: 'critical',
  },
  actor: 'knowledge-author',
  at: '2026-07-27T12:00:00.000Z',
  reason: 'create global security baseline',
});

record = await registry.transition({
  id: record.knowledge.id,
  version: record.knowledge.version,
  expectedRevision: record.revision,
  toStatus: 'REVIEWING',
  actor: 'knowledge-author',
  at: '2026-07-27T12:01:00.000Z',
  reason: 'submit security baseline for review',
});

record = await registry.transition({
  id: record.knowledge.id,
  version: record.knowledge.version,
  expectedRevision: record.revision,
  toStatus: 'PUBLISHED',
  actor: 'knowledge-reviewer',
  at: '2026-07-27T12:02:00.000Z',
  reason: 'approve security baseline',
});

process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
